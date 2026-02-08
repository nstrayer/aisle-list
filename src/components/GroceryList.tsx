import { useState, useEffect, useRef, useLayoutEffect, useCallback } from "react";
import type { GroceryItem } from "@/lib/types";
import { SECTION_ORDER, SECTION_COLORS, categorizeItem } from "@/lib/store-sections";
import { ImageThumbnail } from "./ImageThumbnail";
import { DarkModeToggle } from "./DarkModeToggle";
import { SwipeableItem } from "./SwipeableItem";

interface GroceryListProps {
  items: GroceryItem[];
  onUpdateItems: (items: GroceryItem[]) => void;
  onNewList: () => void;
  uploadedImage?: string | null;
  isDark: boolean;
  onToggleDarkMode: () => void;
  sessionName?: string;
  onOpenHistory?: () => void;
  onRenameSession?: (name: string) => void;
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
  const prevProgress = useRef(progress);

  useEffect(() => {
    if (progress !== prevProgress.current) {
      setAnimate(true);
      const timer = setTimeout(() => setAnimate(false), 400);
      prevProgress.current = progress;
      return () => clearTimeout(timer);
    }
  }, [progress]);

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
}: GroceryListProps) {
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(sessionName ?? "");
  const [animatingCheckbox, setAnimatingCheckbox] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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

    onUpdateItems(
      items.map((i) =>
        i.id === id ? { ...i, checked: !i.checked } : i
      )
    );
  }, [items, settlingItems, onUpdateItems]);

  const deleteItem = (id: string) => {
    onUpdateItems(items.filter((item) => item.id !== id));
  };

  const updateItemName = (id: string, newName: string) => {
    onUpdateItems(
      items.map((item) =>
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
    onUpdateItems([...items, newItem]);
    setEditingItem(newItem.id);
  };

  // Group items by category
  const groupedItems = items.reduce<Record<string, GroceryItem[]>>((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {});

  // Sort each section: unchecked first, checked last.
  // Items in settlingItems are treated as unchecked (stay in place during delay).
  const sortedGroupedItems: Record<string, GroceryItem[]> = {};
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

  const sortedSections = SECTION_ORDER.filter(
    (section) => sortedGroupedItems[section]?.length > 0
  );

  const checkedCount = items.filter((i) => i.checked).length;
  const progress = items.length > 0 ? Math.round((checkedCount / items.length) * 100) : 0;

  const handleSaveName = () => {
    if (nameValue.trim() && onRenameSession) {
      onRenameSession(nameValue.trim());
    }
    setEditingName(false);
  };

  const getSectionColors = (section: string) => {
    return SECTION_COLORS[section] || SECTION_COLORS["Other"];
  };

  // FLIP animation: compare positions before and after render
  useLayoutEffect(() => {
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
                              value={item.name}
                              onChange={(e) =>
                                onUpdateItems(
                                  items.map((i) =>
                                    i.id === item.id ? { ...i, name: e.target.value } : i
                                  )
                                )
                              }
                              onBlur={() => updateItemName(item.id, item.name)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  updateItemName(item.id, item.name);
                                }
                              }}
                              autoFocus
                              className="flex-1 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
                            />
                          ) : (
                            <span
                              onClick={() => setEditingItem(item.id)}
                              className={`flex-1 cursor-pointer py-2 ${
                                item.checked ? "line-through text-gray-400 dark:text-gray-500" : "text-gray-800 dark:text-gray-100"
                              }`}
                            >
                              {item.name}
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
            className="w-full min-h-[44px] flex items-center justify-center gap-2 p-3 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-blue-400 hover:text-blue-600 dark:hover:border-blue-500 dark:hover:text-blue-400 transition-colors interactive-press"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add item
          </button>
        </div>
      </div>
    </div>
  );
}
