import { useCallback, useState } from "react";
import { DarkModeToggle } from "./DarkModeToggle";
import { AnimatedTitle } from "./AnimatedTitle";

interface ImageUploadProps {
  onUpload: (imageBase64: string, mediaType: string) => void;
  isLoading: boolean;
  onChangeApiKey: () => void;
  isDark: boolean;
  onToggleDarkMode: () => void;
}

export function ImageUpload({
  onUpload,
  isLoading,
  onChangeApiKey,
  isDark,
  onToggleDarkMode,
}: ImageUploadProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const processFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith("image/")) {
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        setPreview(result);

        // Extract base64 data (remove data URL prefix)
        const base64Data = result.split(",")[1];
        onUpload(base64Data, file.type);
      };
      reader.readAsDataURL(file);
    },
    [onUpload]
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 dark:from-gray-900 dark:to-gray-950 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="text-3xl font-bold text-green-700 dark:text-green-400 mb-2">
                <AnimatedTitle />
              </h1>
              <p className="text-gray-600 dark:text-gray-300">
                Upload a photo of your handwritten list
              </p>
            </div>
            <div className="flex items-center gap-2">
              <DarkModeToggle isDark={isDark} onToggle={onToggleDarkMode} />
              <button
                onClick={onChangeApiKey}
                className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 underline"
              >
                Change API Key
              </button>
            </div>
          </div>

          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition ${
              isDragging
                ? "border-green-500 bg-green-100 dark:bg-green-900/30"
                : "border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20"
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
              id="image-upload"
              disabled={isLoading}
            />
            <label
              htmlFor="image-upload"
              className={`cursor-pointer inline-block min-h-[44px] bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 transition ${
                isLoading ? "opacity-50 cursor-not-allowed" : ""
              }`}
            >
              Upload Grocery List Photo
            </label>

            <p className="text-gray-500 dark:text-gray-400 mt-3">or drag and drop an image here</p>

            {isLoading && (
              <div className="mt-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
                <p className="text-green-700 dark:text-green-400 mt-2">
                  Reading your grocery list...
                </p>
              </div>
            )}
          </div>

          {preview && !isLoading && (
            <div className="mt-4">
              <img
                src={preview}
                alt="Uploaded list"
                className="max-h-64 mx-auto rounded border border-gray-200 dark:border-gray-700"
              />
            </div>
          )}
        </div>

        {!preview && !isLoading && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center text-gray-500 dark:text-gray-400 mt-6">
            <p className="text-lg">
              Upload a photo of your grocery list to get started!
            </p>
            <p className="text-sm mt-2">
              AI reads your handwriting and organizes items by store section.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
