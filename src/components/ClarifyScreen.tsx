import { useState } from "react";
import type { GrocerySection } from "@/lib/types";
import { ImageThumbnail } from "./ImageThumbnail";

interface ClarifyScreenProps {
  sections: GrocerySection[];
  onConfirm: (selectedSections: GrocerySection[]) => void;
  onBack: () => void;
  uploadedImage?: string | null;
}

const TYPE_BADGES: Record<GrocerySection["type"], { label: string; color: string }> = {
  grocery: { label: "Grocery", color: "bg-green-100 text-green-800" },
  meal_plan: { label: "Meal Plan", color: "bg-purple-100 text-purple-800" },
  crossed_out: { label: "Crossed Out", color: "bg-gray-100 text-gray-600 line-through" },
  notes: { label: "Notes", color: "bg-yellow-100 text-yellow-800" },
};

export function ClarifyScreen({ sections, onConfirm, onBack, uploadedImage }: ClarifyScreenProps) {
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
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="text-3xl font-bold text-green-700 mb-2">
                Review Sections
              </h1>
              <p className="text-gray-600">
                We found {sections.length} section{sections.length !== 1 ? "s" : ""} in your list.
                Choose which ones to include.
              </p>
            </div>
            <div className="flex items-center gap-3">
              {uploadedImage && <ImageThumbnail imageDataUrl={uploadedImage} />}
              <button
                onClick={onBack}
                className="text-sm text-gray-500 hover:text-gray-700 underline"
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
                      ? "border-green-500 bg-green-50"
                      : "border-gray-200 bg-gray-50 opacity-60"
                  }`}
                  onClick={() => toggleSection(index)}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <input
                      type="checkbox"
                      checked={selected[index]}
                      onChange={() => toggleSection(index)}
                      className="w-5 h-5 text-green-600 rounded focus:ring-green-500"
                      onClick={(e) => e.stopPropagation()}
                    />
                    <h3 className="font-semibold text-gray-800">{section.name}</h3>
                    <span className={`text-xs px-2 py-1 rounded-full ${badge.color}`}>
                      {badge.label}
                    </span>
                    <span className="text-sm text-gray-500 ml-auto">
                      {section.items.length} item{section.items.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="ml-8 text-sm text-gray-600">
                    {section.items.slice(0, 5).join(", ")}
                    {section.items.length > 5 && (
                      <span className="text-gray-400">
                        {" "}and {section.items.length - 5} more...
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 flex justify-between items-center">
            <p className="text-sm text-gray-600">
              {selectedCount} of {sections.length} sections selected
            </p>
            <button
              onClick={handleConfirm}
              disabled={selectedCount === 0}
              className="bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 transition disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              Add Selected to List
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
