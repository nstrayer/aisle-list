import { useState, useEffect } from "react";
import { ApiKeyInput } from "@/components/ApiKeyInput";
import { ImageUpload } from "@/components/ImageUpload";
import { ClarifyScreen } from "@/components/ClarifyScreen";
import { GroceryList } from "@/components/GroceryList";
import { OfflineBanner } from "@/components/OfflineBanner";
import { HistoryPanel } from "@/components/HistoryPanel";
import type { GrocerySection, GroceryItem, SessionIndexEntry } from "@/lib/types";
import { categorizeItem } from "@/lib/store-sections";
import { analyzeGroceryImage } from "@/lib/anthropic-client";
import { useDarkMode } from "@/hooks/useDarkMode";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import {
  loadSessionsIndex,
  loadSession,
  loadSessionImage,
  createSession,
  updateSession,
  deleteSession,
  getCurrentSessionId,
  setCurrentSessionId,
  migrateFromLegacyStorage,
} from "@/lib/storage";

type AppState = "api_key" | "upload" | "clarify" | "list";

export default function App() {
  const [appState, setAppState] = useState<AppState>("api_key");
  const [apiKey, setApiKey] = useState<string>("");
  const [sections, setSections] = useState<GrocerySection[]>([]);
  const [items, setItems] = useState<GroceryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const { isDark, toggle: toggleDarkMode } = useDarkMode();
  const isOnline = useOnlineStatus();

  // Session state
  const [currentSessionId, setCurrentSessionIdState] = useState<string | null>(null);
  const [sessionsIndex, setSessionsIndex] = useState<SessionIndexEntry[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [sessionName, setSessionName] = useState<string>("");

  // Load API key and migrate/restore session on mount
  useEffect(() => {
    const savedKey = localStorage.getItem("anthropic_api_key");

    // Run migration for legacy storage
    const migratedSession = migrateFromLegacyStorage();

    // Load sessions index
    const index = loadSessionsIndex();
    setSessionsIndex(index);

    if (savedKey) {
      setApiKey(savedKey);

      // Try to restore current session
      const currentId = migratedSession?.id ?? getCurrentSessionId();
      if (currentId) {
        const session = loadSession(currentId);
        if (session && session.items.length > 0) {
          setCurrentSessionIdState(currentId);
          setItems(session.items);
          setSessionName(session.name);

          const image = loadSessionImage(currentId);
          if (image) {
            setUploadedImage(image);
          }
          setAppState("list");
          return;
        }
      }
      setAppState("upload");
    }
  }, []);

  // Save items to current session whenever they change
  useEffect(() => {
    if (currentSessionId && items.length > 0) {
      updateSession(currentSessionId, { items });
      // Update the index in state to reflect changes
      setSessionsIndex(loadSessionsIndex());
    }
  }, [items, currentSessionId]);

  const handleSaveApiKey = (key: string) => {
    localStorage.setItem("anthropic_api_key", key);
    setApiKey(key);
    setAppState("upload");
  };

  const handleClearApiKey = () => {
    localStorage.removeItem("anthropic_api_key");
    setApiKey("");
    setAppState("api_key");
  };

  const handleImageUpload = async (imageBase64: string, mediaType: string) => {
    setIsLoading(true);
    setError(null);
    setUploadedImage(`data:${mediaType};base64,${imageBase64}`);

    try {
      const sections = await analyzeGroceryImage(imageBase64, mediaType, apiKey);
      setSections(sections);
      setAppState("clarify");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmSections = (selectedSections: GrocerySection[]) => {
    // Flatten all items from selected sections and categorize them
    const allItems: GroceryItem[] = [];
    selectedSections.forEach((section) => {
      section.items.forEach((itemName, index) => {
        allItems.push({
          id: `${Date.now()}-${section.name}-${index}`,
          name: itemName,
          category: categorizeItem(itemName),
          checked: false,
        });
      });
    });

    // Create a new session
    const session = createSession(allItems, uploadedImage);
    setCurrentSessionIdState(session.id);
    setSessionName(session.name);
    setCurrentSessionId(session.id);
    setSessionsIndex(loadSessionsIndex());

    setItems(allItems);
    setAppState("list");
  };

  const handleNewList = () => {
    // Current session is already saved, just clear state
    setSections([]);
    setItems([]);
    setError(null);
    setUploadedImage(null);
    setCurrentSessionIdState(null);
    setSessionName("");
    setCurrentSessionId(null);
    setAppState("upload");
  };

  const handleBackToUpload = () => {
    setSections([]);
    setError(null);
    setUploadedImage(null);
    setAppState("upload");
  };

  const handleLoadSession = (id: string) => {
    const session = loadSession(id);
    if (!session) return;

    setCurrentSessionIdState(id);
    setCurrentSessionId(id);
    setItems(session.items);
    setSessionName(session.name);

    const image = loadSessionImage(id);
    setUploadedImage(image);

    setAppState("list");
  };

  const handleDeleteSession = (id: string) => {
    deleteSession(id);
    setSessionsIndex(loadSessionsIndex());

    // If deleting current session, clear state
    if (id === currentSessionId) {
      setItems([]);
      setUploadedImage(null);
      setCurrentSessionIdState(null);
      setSessionName("");
      setAppState("upload");
    }
  };

  const handleRenameSession = (id: string, name: string) => {
    updateSession(id, { name });
    setSessionsIndex(loadSessionsIndex());

    if (id === currentSessionId) {
      setSessionName(name);
    }
  };

  const handleOpenHistory = () => {
    setSessionsIndex(loadSessionsIndex());
    setIsHistoryOpen(true);
  };

  // Render based on app state
  if (appState === "api_key") {
    return (
      <>
        <OfflineBanner isOnline={isOnline} />
        <ApiKeyInput onSave={handleSaveApiKey} isDark={isDark} onToggleDarkMode={toggleDarkMode} />
      </>
    );
  }

  if (appState === "upload") {
    return (
      <>
        <OfflineBanner isOnline={isOnline} />
        <ImageUpload
          onUpload={handleImageUpload}
          isLoading={isLoading}
          onChangeApiKey={handleClearApiKey}
          isDark={isDark}
          onToggleDarkMode={toggleDarkMode}
          onOpenHistory={handleOpenHistory}
          hasHistory={sessionsIndex.length > 0}
          recentSessions={sessionsIndex}
          onLoadSession={handleLoadSession}
        />
        {error && (
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-red-100 dark:bg-red-900/50 border border-red-400 dark:border-red-600 text-red-700 dark:text-red-300 px-4 py-2 rounded">
            {error}
          </div>
        )}
        <HistoryPanel
          isOpen={isHistoryOpen}
          onClose={() => setIsHistoryOpen(false)}
          sessions={sessionsIndex}
          currentSessionId={currentSessionId}
          onLoadSession={handleLoadSession}
          onDeleteSession={handleDeleteSession}
          onRenameSession={handleRenameSession}
        />
      </>
    );
  }

  if (appState === "clarify") {
    return (
      <>
        <OfflineBanner isOnline={isOnline} />
        <ClarifyScreen
          sections={sections}
          onConfirm={handleConfirmSections}
          onBack={handleBackToUpload}
          uploadedImage={uploadedImage}
          isDark={isDark}
          onToggleDarkMode={toggleDarkMode}
        />
      </>
    );
  }

  return (
    <>
      <OfflineBanner isOnline={isOnline} />
      <GroceryList
        items={items}
        onUpdateItems={setItems}
        onNewList={handleNewList}
        uploadedImage={uploadedImage}
        isDark={isDark}
        onToggleDarkMode={toggleDarkMode}
        sessionName={sessionName}
        onOpenHistory={handleOpenHistory}
        onRenameSession={(name) => {
          if (currentSessionId) {
            handleRenameSession(currentSessionId, name);
          }
        }}
      />
      <HistoryPanel
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        sessions={sessionsIndex}
        currentSessionId={currentSessionId}
        onLoadSession={handleLoadSession}
        onDeleteSession={handleDeleteSession}
        onRenameSession={handleRenameSession}
      />
    </>
  );
}
