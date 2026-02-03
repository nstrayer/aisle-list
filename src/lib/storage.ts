import type { GroceryItem } from "./types";

const STORAGE_KEY = "grocery_current_list";
const IMAGE_KEY = "grocery_current_image";

interface StoredListData {
  items: GroceryItem[];
  timestamp: number;
}

export function saveCurrentList(items: GroceryItem[]): void {
  const data: StoredListData = {
    items,
    timestamp: Date.now(),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function loadCurrentList(): GroceryItem[] | null {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    return null;
  }
  try {
    const data: StoredListData = JSON.parse(stored);
    return data.items;
  } catch {
    return null;
  }
}

export function clearCurrentList(): void {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(IMAGE_KEY);
}

export function saveCurrentImage(imageDataUrl: string): void {
  localStorage.setItem(IMAGE_KEY, imageDataUrl);
}

export function loadCurrentImage(): string | null {
  return localStorage.getItem(IMAGE_KEY);
}
