"use client";

import { useState, useEffect } from "react";
import { ApiKeyInput } from "@/components/ApiKeyInput";
import { ImageUpload } from "@/components/ImageUpload";
import { ClarifyScreen } from "@/components/ClarifyScreen";
import { GroceryList } from "@/components/GroceryList";
import type { GrocerySection, GroceryItem } from "@/lib/types";
import { categorizeItem } from "@/lib/store-sections";
import { analyzeGroceryImage } from "@/lib/anthropic-client";

type AppState = "api_key" | "upload" | "clarify" | "list";

export default function Home() {
  const [appState, setAppState] = useState<AppState>("api_key");
  const [apiKey, setApiKey] = useState<string>("");
  const [sections, setSections] = useState<GrocerySection[]>([]);
  const [items, setItems] = useState<GroceryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);

  // Load API key from localStorage on mount
  useEffect(() => {
    const savedKey = localStorage.getItem("anthropic_api_key");
    if (savedKey) {
      setApiKey(savedKey);
      setAppState("upload");
    }
  }, []);

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

    setItems(allItems);
    setAppState("list");
  };

  const handleNewList = () => {
    setSections([]);
    setItems([]);
    setError(null);
    setUploadedImage(null);
    setAppState("upload");
  };

  const handleBackToUpload = () => {
    setSections([]);
    setError(null);
    setUploadedImage(null);
    setAppState("upload");
  };

  // Render based on app state
  if (appState === "api_key") {
    return <ApiKeyInput onSave={handleSaveApiKey} />;
  }

  if (appState === "upload") {
    return (
      <>
        <ImageUpload
          onUpload={handleImageUpload}
          isLoading={isLoading}
          onChangeApiKey={handleClearApiKey}
        />
        {error && (
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded">
            {error}
          </div>
        )}
      </>
    );
  }

  if (appState === "clarify") {
    return (
      <ClarifyScreen
        sections={sections}
        onConfirm={handleConfirmSections}
        onBack={handleBackToUpload}
        uploadedImage={uploadedImage}
      />
    );
  }

  return (
    <GroceryList
      items={items}
      onUpdateItems={setItems}
      onNewList={handleNewList}
      uploadedImage={uploadedImage}
    />
  );
}
