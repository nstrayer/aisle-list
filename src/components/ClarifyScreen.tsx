import { useState } from "react";
import type { GrocerySection } from "@/lib/types";
import { ImageThumbnail } from "./ImageThumbnail";
import { DarkModeToggle } from "./DarkModeToggle";

interface ClarifyScreenProps {
  sections: GrocerySection[];
  onConfirm: (selectedSections: GrocerySection[]) => void;
  onBack: () => void;
  uploadedImage?: string | null;
  isDark: boolean;
  onToggleDarkMode: () => void;
}

const TYPE_BADGES: Record<GrocerySection["type"], { label: string; lightColor: string; darkColor: string }> = {
  grocery: { label: "Grocery", lightColor: "bg-green-100 text-green-800", darkColor: "dark:bg-green-900/50 dark:text-green-300" },
  meal_plan: { label: "Meal Plan", lightColor: "bg-purple-100 text-purple-800", darkColor: "dark:bg-purple-900/50 dark:text-purple-300" },
  crossed_out: { label: "Crossed Out", lightColor: "bg-gray-100 text-gray-600 line-through", darkColor: "dark:bg-gray-700 dark:text-gray-400" },
  notes: { label: "Notes", lightColor: "bg-yellow-100 text-yellow-800", darkColor: "dark:bg-yellow-900/50 dark:text-yellow-300" },
};

export function ClarifyScreen({ sections, onConfirm, onBack, uploadedImage, isDark, onToggleDarkMode }: ClarifyScreenProps) {
  const [selected, setSelected] = useState<Record<number, boolean>>(() => {
    // Default: select grocery sections, deselect crossed_out
    const initial: Record<number, boolean> = {};
    sections.forEach((section, index) => {
      initial[index] = section.type !== "crossed_out";
    });
    return initial;
  });

  const toggleSection = (index: number) => {
    setSelected((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  const handleConfirm = () => {
    const selectedSections = sections.filter((_, index) => selected[index]);
    onConfirm(selectedSections);
  };

  const selectedCount = Object.values(selected).filter(Boolean).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 dark:from-gray-900 dark:to-gray-950 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="text-3xl font-bold text-green-700 dark:text-green-400 mb-2">
                Review Sections
              </h1>
              <p className="text-gray-600 dark:text-gray-300">
                We found {sections.length} section{sections.length !== 1 ? "s" : ""} in your list.
                Choose which ones to include.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <DarkModeToggle isDark={isDark} onToggle={onToggleDarkMode} />
              {uploadedImage && <ImageThumbnail imageDataUrl={uploadedImage} />}
              <button
                onClick={onBack}
                className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 underline"
              >
                Upload Different Image
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {sections.map((section, index) => {
              const badge = TYPE_BADGES[section.type];
              return (
                <div
                  key={index}
                  className={`border rounded-lg p-4 transition cursor-pointer ${
                    selected[index]
                      ? "border-green-500 bg-green-50 dark:bg-green-900/20"
                      : "border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 opacity-60"
                  }`}
                  onClick={() => toggleSection(index)}
                >
                  <div className="flex items-center gap-1 mb-2">
                    <div
                      className="min-w-[44px] min-h-[44px] flex items-center justify-center"
                    >
                      <input
                        type="checkbox"
                        checked={selected[index]}
                        onChange={() => toggleSection(index)}
                        className="w-5 h-5 text-green-600 rounded focus:ring-green-500 pointer-events-none"
                      />
                    </div>
                    <h3 className="font-semibold text-gray-800 dark:text-gray-100">{section.name}</h3>
                    <span className={`text-xs px-2 py-1 rounded-full ${badge.lightColor} ${badge.darkColor}`}>
                      {badge.label}
                    </span>
                    <span className="text-sm text-gray-500 dark:text-gray-400 ml-auto">
                      {section.items.length} item{section.items.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="ml-[52px] text-sm text-gray-600 dark:text-gray-300">
                    {section.items.slice(0, 5).join(", ")}
                    {section.items.length > 5 && (
                      <span className="text-gray-400 dark:text-gray-500">
                        {" "}and {section.items.length - 5} more...
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 flex justify-between items-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {selectedCount} of {sections.length} sections selected
            </p>
            <button
              onClick={handleConfirm}
              disabled={selectedCount === 0}
              className="min-h-[44px] bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 transition disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed"
            >
              Add Selected to List
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
