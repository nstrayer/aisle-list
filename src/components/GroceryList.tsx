import { useState } from "react";
import type { GroceryItem } from "@/lib/types";
import { SECTION_ORDER, categorizeItem } from "@/lib/store-sections";
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
}

export function GroceryList({ items, onUpdateItems, onNewList, uploadedImage, isDark, onToggleDarkMode }: GroceryListProps) {
  const [editingItem, setEditingItem] = useState<string | null>(null);

  const toggleItem = (id: string) => {
    onUpdateItems(
      items.map((item) =>
        item.id === id ? { ...item, checked: !item.checked } : item
      )
    );
  };

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

  const sortedSections = SECTION_ORDER.filter(
    (section) => groupedItems[section]?.length > 0
  );

  const checkedCount = items.filter((i) => i.checked).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 dark:from-gray-900 dark:to-gray-950 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Your Shopping List</h2>
            <div className="flex items-center gap-2">
              <DarkModeToggle isDark={isDark} onToggle={onToggleDarkMode} />
              {uploadedImage && <ImageThumbnail imageDataUrl={uploadedImage} />}
              <button
                onClick={addItem}
                className="min-h-[44px] bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm"
              >
                + Add Item
              </button>
              <button
                onClick={onNewList}
                className="min-h-[44px] bg-gray-600 dark:bg-gray-700 text-white px-4 py-2 rounded hover:bg-gray-700 dark:hover:bg-gray-600 text-sm"
              >
                New List
              </button>
            </div>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            Items organized by store section. Click to edit, check off as you shop.
          </p>

          {sortedSections.map((section) => (
            <div key={section} className="mb-6">
              <h3 className="text-lg font-semibold text-green-700 dark:text-green-400 mb-3 flex items-center border-b-2 border-green-200 dark:border-green-800 pb-2">
                <span className="bg-green-100 dark:bg-green-900/50 px-3 py-1 rounded-full">{section}</span>
              </h3>
              <div className="space-y-2 pl-2">
                {groupedItems[section].map((item) => (
                  <SwipeableItem key={item.id} onDelete={() => deleteItem(item.id)}>
                    <div
                      className={`flex items-center gap-1 p-2 rounded-lg transition ${
                        item.checked ? "bg-gray-100 dark:bg-gray-700/50" : "bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
                      } border border-gray-200 dark:border-gray-700`}
                    >
                      <div
                        className="min-w-[44px] min-h-[44px] flex items-center justify-center cursor-pointer"
                        onClick={() => toggleItem(item.id)}
                      >
                        <input
                          type="checkbox"
                          checked={item.checked}
                          onChange={() => toggleItem(item.id)}
                          className="w-5 h-5 text-green-600 rounded focus:ring-green-500 pointer-events-none"
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
                        className="hidden sm:flex min-w-[44px] min-h-[44px] items-center justify-center text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                      >
                        x
                      </button>
                    </div>
                  </SwipeableItem>
                ))}
              </div>
            </div>
          ))}

          <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              <strong>{checkedCount}</strong> of <strong>{items.length}</strong> items
              checked
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
