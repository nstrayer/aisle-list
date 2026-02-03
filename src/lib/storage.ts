import type { GroceryItem, ListSession, SessionIndexEntry } from "./types";

// Legacy storage keys (for migration)
const LEGACY_LIST_KEY = "grocery_current_list";
const LEGACY_IMAGE_KEY = "grocery_current_image";

// Session storage keys
const SESSIONS_INDEX_KEY = "grocery_sessions_index";
const CURRENT_SESSION_KEY = "grocery_current_session_id";

function getSessionKey(id: string): string {
  return `grocery_session_${id}`;
}

function getSessionImageKey(id: string): string {
  return `grocery_session_image_${id}`;
}

// Session index operations
export function loadSessionsIndex(): SessionIndexEntry[] {
  const stored = localStorage.getItem(SESSIONS_INDEX_KEY);
  if (!stored) return [];
  try {
    return JSON.parse(stored);
  } catch {
    return [];
  }
}

export function saveSessionsIndex(index: SessionIndexEntry[]): void {
  localStorage.setItem(SESSIONS_INDEX_KEY, JSON.stringify(index));
}

// Current session tracking
export function getCurrentSessionId(): string | null {
  return localStorage.getItem(CURRENT_SESSION_KEY);
}

export function setCurrentSessionId(id: string | null): void {
  if (id) {
    localStorage.setItem(CURRENT_SESSION_KEY, id);
  } else {
    localStorage.removeItem(CURRENT_SESSION_KEY);
  }
}

// Session CRUD operations
export function loadSession(id: string): ListSession | null {
  const stored = localStorage.getItem(getSessionKey(id));
  if (!stored) return null;
  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

export function saveSession(session: ListSession): void {
  localStorage.setItem(getSessionKey(session.id), JSON.stringify(session));

  // Update index entry
  const index = loadSessionsIndex();
  const entryIndex = index.findIndex((e) => e.id === session.id);
  const entry: SessionIndexEntry = {
    id: session.id,
    name: session.name,
    createdAt: session.createdAt,
    itemCount: session.items.length,
    checkedCount: session.items.filter((i) => i.checked).length,
    hasImage: session.hasImage,
  };

  if (entryIndex >= 0) {
    index[entryIndex] = entry;
  } else {
    index.unshift(entry);
  }
  saveSessionsIndex(index);
}

export function deleteSession(id: string): void {
  localStorage.removeItem(getSessionKey(id));
  localStorage.removeItem(getSessionImageKey(id));

  const index = loadSessionsIndex();
  saveSessionsIndex(index.filter((e) => e.id !== id));

  // Clear current session if it was deleted
  if (getCurrentSessionId() === id) {
    setCurrentSessionId(null);
  }
}

export function updateSession(id: string, updates: Partial<ListSession>): void {
  const session = loadSession(id);
  if (!session) return;

  const updated: ListSession = {
    ...session,
    ...updates,
    updatedAt: Date.now(),
  };
  saveSession(updated);
}

// Session image operations
export function loadSessionImage(id: string): string | null {
  return localStorage.getItem(getSessionImageKey(id));
}

export function saveSessionImage(id: string, imageDataUrl: string): void {
  localStorage.setItem(getSessionImageKey(id), imageDataUrl);
}

// Image compression utility
export function compressImage(dataUrl: string, maxWidth = 400): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let width = img.width;
      let height = img.height;

      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Could not get canvas context"));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", 0.7));
    };
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = dataUrl;
  });
}

// Session name generation
export function generateSessionName(existingNames: string[]): string {
  const now = new Date();
  const baseName = now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  // Check for duplicates and add suffix if needed
  let name = baseName;
  let suffix = 1;
  while (existingNames.includes(name)) {
    suffix++;
    name = `${baseName} (${suffix})`;
  }

  return name;
}

// Create a new session
export function createSession(
  items: GroceryItem[],
  imageDataUrl?: string | null
): ListSession {
  const index = loadSessionsIndex();
  const existingNames = index.map((e) => e.name);

  const session: ListSession = {
    id: Date.now().toString(),
    name: generateSessionName(existingNames),
    items,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    hasImage: !!imageDataUrl,
  };

  saveSession(session);
  setCurrentSessionId(session.id);

  if (imageDataUrl) {
    // Save image asynchronously - compress first
    compressImage(imageDataUrl)
      .then((compressed) => saveSessionImage(session.id, compressed))
      .catch(() => {
        // Fall back to original if compression fails
        saveSessionImage(session.id, imageDataUrl);
      });
  }

  return session;
}

// Migration from legacy storage
export function migrateFromLegacyStorage(): ListSession | null {
  const legacyList = localStorage.getItem(LEGACY_LIST_KEY);
  const legacyImage = localStorage.getItem(LEGACY_IMAGE_KEY);

  if (!legacyList) return null;

  try {
    const data = JSON.parse(legacyList);
    const items: GroceryItem[] = data.items;

    if (!items || items.length === 0) return null;

    // Create a session from legacy data
    const session = createSession(items, legacyImage);

    // Clear legacy storage
    localStorage.removeItem(LEGACY_LIST_KEY);
    localStorage.removeItem(LEGACY_IMAGE_KEY);

    return session;
  } catch {
    return null;
  }
}

// Legacy compatibility functions (deprecated, but kept for gradual migration)
export function saveCurrentList(items: GroceryItem[]): void {
  const currentId = getCurrentSessionId();
  if (currentId) {
    updateSession(currentId, { items });
  }
}

export function loadCurrentList(): GroceryItem[] | null {
  const currentId = getCurrentSessionId();
  if (!currentId) return null;

  const session = loadSession(currentId);
  return session?.items ?? null;
}

export function clearCurrentList(): void {
  setCurrentSessionId(null);
}

export function saveCurrentImage(imageDataUrl: string): void {
  const currentId = getCurrentSessionId();
  if (currentId) {
    compressImage(imageDataUrl)
      .then((compressed) => {
        saveSessionImage(currentId, compressed);
        updateSession(currentId, { hasImage: true });
      })
      .catch(() => {
        saveSessionImage(currentId, imageDataUrl);
        updateSession(currentId, { hasImage: true });
      });
  }
}

export function loadCurrentImage(): string | null {
  const currentId = getCurrentSessionId();
  if (!currentId) return null;
  return loadSessionImage(currentId);
}
