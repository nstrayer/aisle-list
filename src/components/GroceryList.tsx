import { useState, useEffect, useRef, useLayoutEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import type { GroceryItem, CategorySuggestion } from "@/lib/types";
import { SECTION_ORDER, categorizeItem, getSectionColors } from "@/lib/store-sections";
import { ImageThumbnail } from "./ImageThumbnail";
import { DarkModeToggle } from "./DarkModeToggle";
import { SwipeableItem } from "./SwipeableItem";

interface GroceryListProps {
  items: GroceryItem[];
  onUpdateItems: (update: GroceryItem[] | ((prev: GroceryItem[]) => GroceryItem[])) => void;
  onNewList: () => void;
  uploadedImage?: string | null;
  isDark: boolean;
  onToggleDarkMode: () => void;
  sessionName?: string;
  onOpenHistory?: () => void;
  onRenameSession?: (name: string) => void;
  isSanityChecking?: boolean;
  pendingSuggestions?: CategorySuggestion[] | null;
  onAcceptSuggestions?: () => void;
  onRejectSuggestions?: () => void;
  sanityCheckError?: string | null;
  onDismissSanityError?: () => void;
  itemsChangedSinceCheck?: boolean;
  onRecategorize?: () => void;
}

// Progress Ring Component
function ProgressRing({
  progress,
  size = 80,
  strokeWidth = 6,
}: {
  progress: number;
  size?: number;
  strokeWidth?: number;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;
  const [animate, setAnimate] = useState(false);
  const [prevProg, setPrevProg] = useState(progress);

  // Detect progress change during render (React-approved pattern)
  if (progress !== prevProg) {
    setPrevProg(progress);
    setAnimate(true);
  }

  // Turn off animation after delay
  useEffect(() => {
    if (animate) {
      const timer = setTimeout(() => setAnimate(false), 400);
      return () => clearTimeout(timer);
    }
  }, [animate]);

  const isComplete = progress === 100;

  return (
    <div className={`relative ${isComplete && animate ? "celebrate" : ""}`}>
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-gray-200 dark:text-gray-700"
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={`progress-ring-circle ${
            isComplete
              ? "text-green-500"
              : progress > 50
              ? "text-blue-500"
              : "text-gray-400"
          }`}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span
          className={`text-lg font-bold ${
            isComplete
              ? "text-green-600 dark:text-green-400"
              : "text-gray-700 dark:text-gray-300"
          }`}
        >
          {progress}%
        </span>
      </div>
    </div>
  );
}

export function GroceryList({
  items,
  onUpdateItems,
  onNewList,
  uploadedImage,
  isDark,
  onToggleDarkMode,
  sessionName,
  onOpenHistory,
  onRenameSession,
  isSanityChecking,
  pendingSuggestions,
  onAcceptSuggestions,
  onRejectSuggestions,
  sanityCheckError,
  onDismissSanityError,
  itemsChangedSinceCheck,
  onRecategorize,
}: GroceryListProps) {
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [suggestionsExpanded, setSuggestionsExpanded] = useState(false);
  const [nameValue, setNameValue] = useState(sessionName ?? "");
  const [animatingCheckbox, setAnimatingCheckbox] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Category picker state
  const [recategorizingItem, setRecategorizingItem] = useState<string | null>(null);
  const [pickerPosition, setPickerPosition] = useState<{ top: number; left: number } | null>(null);
  const [customSection, setCustomSection] = useState("");
  const longPressTimer = useRef<number | null>(null);
  const longPressTriggered = useRef(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Settling state for delayed reorder animation
  const [settlingItems, setSettlingItems] = useState<Set<string>>(new Set());
  const settleTimers = useRef<Map<string, number>>(new Map());
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const prevPositions = useRef<Map<string, number>>(new Map());

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [menuOpen]);

  // Close category picker on click outside or Escape
  useEffect(() => {
    if (!recategorizingItem) return;
    function handleClickOutside(event: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setRecategorizingItem(null);
        setPickerPosition(null);
        setCustomSection("");
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setRecategorizingItem(null);
        setPickerPosition(null);
        setCustomSection("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [recategorizingItem]);

  // Clear long-press timer on unmount
  useEffect(() => {
    return () => {
      if (longPressTimer.current != null) {
        clearTimeout(longPressTimer.current);
      }
    };
  }, []);

  const openCategoryPicker = useCallback((itemId: string, x: number, y: number) => {
    // Clamp position so picker stays within viewport
    const pickerWidth = 220;
    const pickerHeight = 350;
    const clampedX = Math.min(x, window.innerWidth - pickerWidth - 8);
    const clampedY = Math.min(y, window.innerHeight - pickerHeight - 8);
    setRecategorizingItem(itemId);
    setPickerPosition({ top: Math.max(8, clampedY), left: Math.max(8, clampedX) });
    setCustomSection("");
  }, []);

  const recategorizeItem = useCallback((itemId: string, newCategory: string) => {
    const RESERVED_KEYS = ["__proto__", "constructor", "prototype"];
    if (RESERVED_KEYS.includes(newCategory)) return;

    onUpdateItems((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, category: newCategory } : item
      )
    );
    setRecategorizingItem(null);
    setPickerPosition(null);
    setCustomSection("");
  }, [onUpdateItems]);

  const toggleItem = useCallback((id: string) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;

    if (!item.checked) {
      // Checking: start checkbox animation and add to settling set
      setAnimatingCheckbox(id);
      setTimeout(() => setAnimatingCheckbox(null), 400);

      setSettlingItems((prev) => new Set(prev).add(id));
      const timer = window.setTimeout(() => {
        setSettlingItems((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        settleTimers.current.delete(id);
      }, 800);
      settleTimers.current.set(id, timer);
    } else {
      // Unchecking: if still settling, cancel the timer and remove from set
      if (settlingItems.has(id)) {
        const timer = settleTimers.current.get(id);
        if (timer != null) {
          clearTimeout(timer);
          settleTimers.current.delete(id);
        }
        setSettlingItems((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    }

    onUpdateItems((prev) =>
      prev.map((i) =>
        i.id === id ? { ...i, checked: !i.checked } : i
      )
    );
  }, [items, settlingItems, onUpdateItems]);

  const deleteItem = (id: string) => {
    onUpdateItems((prev) => prev.filter((item) => item.id !== id));
  };

  const updateItemName = (id: string, newName: string) => {
    onUpdateItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, name: newName, category: categorizeItem(newName) }
          : item
      )
    );
    setEditingItem(null);
  };

  const addItem = () => {
    const newItem: GroceryItem = {
      id: Date.now().toString(),
      name: "New item",
      category: "Other",
      checked: false,
    };
    onUpdateItems((prev) => [...prev, newItem]);
    setEditingItem(newItem.id);
    setEditingValue("New item");
  };

  // Group items by category (use null-prototype object to avoid __proto__ collisions)
  const groupedItems = items.reduce<Record<string, GroceryItem[]>>((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, Object.create(null) as Record<string, GroceryItem[]>);

  // Sort each section: unchecked first, checked last.
  // Items in settlingItems are treated as unchecked (stay in place during delay).
  const sortedGroupedItems: Record<string, GroceryItem[]> = Object.create(null) as Record<string, GroceryItem[]>;
  for (const section of Object.keys(groupedItems)) {
    const sectionItems = groupedItems[section];
    const unchecked = sectionItems.filter(
      (item) => !item.checked || settlingItems.has(item.id)
    );
    const checked = sectionItems.filter(
      (item) => item.checked && !settlingItems.has(item.id)
    );
    sortedGroupedItems[section] = [...unchecked, ...checked];
  }

  const knownSections = SECTION_ORDER.filter(
    (section) => section !== "Other" && sortedGroupedItems[section]?.length > 0
  );
  const dynamicSections = Object.keys(sortedGroupedItems)
    .filter((s) => !SECTION_ORDER.includes(s))
    .sort();
  const sortedSections = [
    ...knownSections,
    ...dynamicSections,
    ...(sortedGroupedItems["Other"]?.length > 0 ? ["Other"] : []),
  ];

  const checkedCount = items.filter((i) => i.checked).length;
  const progress = items.length > 0 ? Math.round((checkedCount / items.length) * 100) : 0;

  const handleSaveName = () => {
    if (nameValue.trim() && onRenameSession) {
      onRenameSession(nameValue.trim());
    }
    setEditingName(false);
  };

  // FLIP animation: compare positions before and after render
  useLayoutEffect(() => {
    // Skip FLIP calculations while any text input is active to avoid
    // synchronous layout reflows (getBoundingClientRect) on every keystroke.
    if (editingItem !== null || editingName || recategorizingItem !== null) {
      prevPositions.current = new Map();
      return;
    }

    const currentPositions = new Map<string, number>();
    itemRefs.current.forEach((el, id) => {
      currentPositions.set(id, el.getBoundingClientRect().top);
    });

    const prev = prevPositions.current;
    if (prev.size > 0) {
      currentPositions.forEach((newTop, id) => {
        const oldTop = prev.get(id);
        if (oldTop != null && oldTop !== newTop) {
          const delta = oldTop - newTop;
          const el = itemRefs.current.get(id);
          if (el) {
            // Place element at its old position
            el.style.transform = `translateY(${delta}px)`;
            el.style.transition = "none";

            requestAnimationFrame(() => {
              // Animate to new position
              el.classList.add("item-flip");
              el.style.transform = "";
              el.style.transition = "";

              const onEnd = () => {
                el.classList.remove("item-flip");
                el.removeEventListener("transitionend", onEnd);
              };
              el.addEventListener("transitionend", onEnd);
            });
          }
        }
      });
    }

    prevPositions.current = currentPositions;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 dark:from-gray-900 dark:to-gray-950 dark:dark-gradient-bg p-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white dark:bg-gray-800 dark:card-depth rounded-lg shadow-lg p-6">
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-4">
              {/* Progress Ring */}
              <ProgressRing progress={progress} />
              <div>
                <div className="flex items-center gap-2">
                  {editingName ? (
                    <input
                      type="text"
                      value={nameValue}
                      onChange={(e) => setNameValue(e.target.value)}
                      onBlur={handleSaveName}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSaveName();
                        if (e.key === "Escape") {
                          setNameValue(sessionName ?? "");
                          setEditingName(false);
                        }
                      }}
                      autoFocus
                      className="text-xl font-bold border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
                    />
                  ) : (
                    <h2
                      className="text-xl font-bold text-gray-800 dark:text-gray-100 cursor-pointer hover:text-gray-600 dark:hover:text-gray-300"
                      onClick={() => {
                        setNameValue(sessionName ?? "Your Shopping List");
                        setEditingName(true);
                      }}
                      title="Click to rename"
                    >
                      {sessionName || "Your Shopping List"}
                    </h2>
                  )}
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {progress === 100
                    ? "All done! Great shopping!"
                    : `${checkedCount} of ${items.length} items checked`}
                </p>
                {/* Brand mark - hidden on mobile */}
                <p className="hidden sm:block text-xs text-gray-400 dark:text-gray-500 mt-1">
                  AIsle List
                </p>
              </div>
            </div>
            {/* Desktop buttons */}
            <div className="hidden sm:flex items-center gap-2">
              <DarkModeToggle isDark={isDark} onToggle={onToggleDarkMode} />
              {onOpenHistory && (
                <button
                  onClick={onOpenHistory}
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 interactive-press"
                  title="View history"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </button>
              )}
              {uploadedImage && <ImageThumbnail imageDataUrl={uploadedImage} />}
              <button
                onClick={onNewList}
                className="min-h-[44px] bg-gray-600 dark:bg-gray-700 text-white px-4 py-2 rounded hover:bg-gray-700 dark:hover:bg-gray-600 text-sm interactive-press"
              >
                New List
              </button>
            </div>

            {/* Mobile hamburger menu */}
            <div className="sm:hidden relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 interactive-press"
                aria-label="Menu"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>

              {menuOpen && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-2 z-50">
                  <button
                    onClick={() => {
                      onNewList();
                      setMenuOpen(false);
                    }}
                    className="w-full px-4 py-3 text-left text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3"
                  >
                    <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    New List
                  </button>
                  {onOpenHistory && (
                    <button
                      onClick={() => {
                        onOpenHistory();
                        setMenuOpen(false);
                      }}
                      className="w-full px-4 py-3 text-left text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3"
                    >
                      <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      History
                    </button>
                  )}
                  <div className="border-t border-gray-200 dark:border-gray-700 my-2" />
                  <div className="px-4 py-3 flex items-center justify-between">
                    <span className="text-gray-700 dark:text-gray-200">Dark Mode</span>
                    <DarkModeToggle isDark={isDark} onToggle={onToggleDarkMode} />
                  </div>
                  {uploadedImage && (
                    <>
                      <div className="border-t border-gray-200 dark:border-gray-700 my-2" />
                      <div className="px-4 py-3 flex items-center justify-between">
                        <span className="text-gray-700 dark:text-gray-200">Original</span>
                        <ImageThumbnail imageDataUrl={uploadedImage} />
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* AI sanity check banner */}
          {isSanityChecking && (
            <div className="mb-4 flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-sm">
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Refining categories...
            </div>
          )}

          {sanityCheckError && (
            <div className="mb-4 flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm">
              <span>{sanityCheckError}</span>
              <button
                onClick={onDismissSanityError}
                className="shrink-0 p-0.5 rounded hover:bg-red-100 dark:hover:bg-red-800/30"
                aria-label="Dismiss"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          {pendingSuggestions && pendingSuggestions.length > 0 && (
            <div className="mb-4 rounded-lg border border-amber-300 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/20 overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2">
                <button
                  onClick={() => setSuggestionsExpanded(!suggestionsExpanded)}
                  className="flex items-center gap-2 text-sm font-medium text-amber-800 dark:text-amber-300"
                >
                  <svg
                    className={`w-4 h-4 transition-transform ${suggestionsExpanded ? "rotate-90" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  AI suggests {pendingSuggestions.length} category change{pendingSuggestions.length !== 1 ? "s" : ""}
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={onAcceptSuggestions}
                    className="px-3 py-1 text-xs font-medium rounded bg-amber-600 text-white hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-400 dark:text-gray-900"
                  >
                    Accept
                  </button>
                  <button
                    onClick={onRejectSuggestions}
                    className="px-3 py-1 text-xs font-medium rounded bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
              {suggestionsExpanded && (
                <div className="px-3 pb-3 space-y-1">
                  {pendingSuggestions.map((s, i) => (
                    <div key={i} className="text-xs text-amber-900 dark:text-amber-200 flex items-center gap-1">
                      <span className="font-medium">{s.name}:</span>
                      <span className="text-amber-600 dark:text-amber-400">{s.from}</span>
                      <svg className="w-3 h-3 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                      <span className="text-amber-700 dark:text-amber-300 font-medium">{s.to}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Re-categorize button when items changed since last check or previous check failed */}
          {(itemsChangedSinceCheck || sanityCheckError) && !isSanityChecking && onRecategorize && (
            <button
              onClick={onRecategorize}
              className="mb-4 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-blue-300 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-sm hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors interactive-press"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Re-categorize items with AI
            </button>
          )}

          {sortedSections.map((section) => {
            const colors = getSectionColors(section);
            return (
              <div key={section} className="mb-6">
                <h3 className={`text-lg font-semibold mb-3 flex items-center border-b-2 pb-2 ${colors.text} ${colors.darkText} ${colors.border} ${colors.darkBorder}`}>
                  <span className={`px-3 py-1 rounded-full ${colors.bg} ${colors.darkBg}`}>
                    {section}
                  </span>
                </h3>
                <div className="space-y-2">
                  {sortedGroupedItems[section].map((item) => (
                    <div
                      key={item.id}
                      ref={(el) => {
                        if (el) itemRefs.current.set(item.id, el);
                        else itemRefs.current.delete(item.id);
                      }}
                    >
                      <SwipeableItem onDelete={() => deleteItem(item.id)}>
                        <div
                          className={`flex items-center gap-1 p-2 rounded-lg transition border-l-4 ${colors.border} ${colors.darkBorder} ${
                            item.checked ? "bg-gray-100 dark:bg-gray-700/50" : "bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
                          } border border-gray-200 dark:border-gray-700`}
                        >
                          <div
                            className={`min-w-[44px] min-h-[44px] flex items-center justify-center cursor-pointer interactive-press ${
                              animatingCheckbox === item.id ? "checkbox-bounce" : ""
                            }`}
                            onClick={() => toggleItem(item.id)}
                          >
                            <input
                              type="checkbox"
                              checked={item.checked}
                              onChange={() => toggleItem(item.id)}
                              className={`w-5 h-5 rounded focus:ring-2 pointer-events-none ${colors.text}`}
                            />
                          </div>

                          {editingItem === item.id ? (
                            <input
                              type="text"
                              value={editingValue}
                              onChange={(e) => setEditingValue(e.target.value)}
                              onBlur={() => updateItemName(item.id, editingValue)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  updateItemName(item.id, editingValue);
                                }
                              }}
                              autoFocus
                              className="flex-1 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
                            />
                          ) : (
                            <span
                              onClick={() => {
                                if (longPressTriggered.current) {
                                  longPressTriggered.current = false;
                                  return;
                                }
                                setEditingItem(item.id);
                                setEditingValue(item.name);
                              }}
                              onContextMenu={(e) => {
                                e.preventDefault();
                                openCategoryPicker(item.id, e.clientX, e.clientY);
                              }}
                              onTouchStart={(e) => {
                                longPressTriggered.current = false;
                                const touch = e.touches[0];
                                const x = touch.clientX;
                                const y = touch.clientY;
                                longPressTimer.current = window.setTimeout(() => {
                                  longPressTriggered.current = true;
                                  openCategoryPicker(item.id, x, y);
                                  longPressTimer.current = null;
                                }, 500);
                              }}
                              onTouchEnd={() => {
                                if (longPressTimer.current != null) {
                                  clearTimeout(longPressTimer.current);
                                  longPressTimer.current = null;
                                }
                              }}
                              onTouchMove={() => {
                                if (longPressTimer.current != null) {
                                  clearTimeout(longPressTimer.current);
                                  longPressTimer.current = null;
                                }
                              }}
                              onTouchCancel={() => {
                                if (longPressTimer.current != null) {
                                  clearTimeout(longPressTimer.current);
                                  longPressTimer.current = null;
                                }
                              }}
                              className={`flex-1 cursor-pointer py-2 flex items-center gap-2 ${
                                item.checked ? "line-through text-gray-400 dark:text-gray-500" : "text-gray-800 dark:text-gray-100"
                              }`}
                            >
                              {item.name}
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 whitespace-nowrap select-none">
                                {item.category}
                              </span>
                            </span>
                          )}

                          {/* Desktop delete button - hidden on touch devices */}
                          <button
                            onClick={() => deleteItem(item.id)}
                            className="hidden sm:flex min-w-[44px] min-h-[44px] items-center justify-center text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 interactive-press"
                          >
                            x
                          </button>
                        </div>
                      </SwipeableItem>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Add Item button at bottom of list */}
          <button
            onClick={addItem}
            className="w-full min-h-11 flex items-center justify-center gap-2 p-3 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-blue-400 hover:text-blue-600 dark:hover:border-blue-500 dark:hover:text-blue-400 transition-colors interactive-press"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add item
          </button>
        </div>
      </div>

      {/* Category picker dropdown (portal) */}
      {recategorizingItem && pickerPosition && createPortal(
        <div
          ref={pickerRef}
          className="fixed z-[100] w-56 max-h-80 overflow-y-auto bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1"
          style={{ top: pickerPosition.top, left: pickerPosition.left }}
        >
          <div className="px-3 py-2 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">
            Move to section
          </div>
          {(() => {
            const currentItem = items.find((i) => i.id === recategorizingItem);
            const currentCategory = currentItem?.category;
            // Deduplicate: SECTION_ORDER + any dynamic sections present in items
            const presentSections = new Set(items.map((i) => i.category));
            const allSections = [...SECTION_ORDER];
            for (const s of presentSections) {
              if (!allSections.includes(s)) allSections.push(s);
            }
            return allSections.map((section) => {
              const sColors = getSectionColors(section);
              const isActive = section === currentCategory;
              return (
                <button
                  key={section}
                  onClick={() => recategorizeItem(recategorizingItem!, section)}
                  className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-700 ${
                    isActive ? "bg-gray-100 dark:bg-gray-700 font-medium" : ""
                  }`}
                >
                  <span className={`w-2.5 h-2.5 rounded-full ${sColors.bg} ${sColors.border} border ${sColors.darkBg} ${sColors.darkBorder}`} />
                  <span className="text-gray-700 dark:text-gray-200">{section}</span>
                  {isActive && (
                    <svg className="w-4 h-4 ml-auto text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              );
            });
          })()}
          <div className="border-t border-gray-200 dark:border-gray-700 mt-1 pt-1 px-2 pb-2">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const trimmed = customSection.trim();
                if (trimmed) {
                  recategorizeItem(recategorizingItem!, trimmed);
                }
              }}
            >
              <input
                type="text"
                value={customSection}
                onChange={(e) => setCustomSection(e.target.value)}
                placeholder="Custom section..."
                className="w-full text-sm px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-400"
                autoFocus
              />
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
