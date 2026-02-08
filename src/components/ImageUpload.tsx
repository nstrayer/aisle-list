import { useCallback, useState } from "react";
import { DarkModeToggle } from "./DarkModeToggle";
import { AnimatedTitle } from "./AnimatedTitle";
import { preprocessImageForApi } from "@/lib/image-processing";
import type { SessionIndexEntry } from "@/lib/types";

interface ImageUploadProps {
  onUpload: (imageBase64: string, mediaType: string) => void;
  isLoading: boolean;
  onChangeApiKey: () => void;
  isDark: boolean;
  onToggleDarkMode: () => void;
  onOpenHistory?: () => void;
  hasHistory?: boolean;
  recentSessions?: SessionIndexEntry[];
  onLoadSession?: (id: string) => void;
}

export function ImageUpload({
  onUpload,
  isLoading,
  onChangeApiKey,
  isDark,
  onToggleDarkMode,
  onOpenHistory,
  hasHistory,
  recentSessions = [],
  onLoadSession,
}: ImageUploadProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const processFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) {
        return;
      }

      try {
        const { base64, mediaType } = await preprocessImageForApi(file);
        const dataUrl = `data:${mediaType};base64,${base64}`;
        setPreview(dataUrl);
        onUpload(base64, mediaType);
      } catch {
        // Fallback to raw FileReader if preprocessing fails
        const reader = new FileReader();
        reader.onload = (event) => {
          const result = event.target?.result as string;
          setPreview(result);
          const base64Data = result.split(",")[1];
          onUpload(base64Data, file.type);
        };
        reader.readAsDataURL(file);
      }
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

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  const displaySessions = recentSessions.slice(0, 3);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 dark:from-gray-900 dark:to-gray-950 dark:dark-gradient-bg p-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white dark:bg-gray-800 dark:card-depth rounded-lg shadow-lg p-6">
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
              {hasHistory && onOpenHistory && (
                <button
                  onClick={onOpenHistory}
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                  title="View all history"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </button>
              )}
              <button
                onClick={onChangeApiKey}
                className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 underline"
              >
                Change API Key
              </button>
            </div>
          </div>

          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition interactive-press ${
              isDragging
                ? "border-green-500 bg-green-100 dark:bg-green-900/30"
                : "border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20"
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {/* Upload icon */}
            <div className="mb-4">
              <svg
                className="w-12 h-12 mx-auto text-green-500 dark:text-green-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>

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

            <p className="text-gray-500 dark:text-gray-400 mt-3 text-sm">
              or drag and drop an image here
            </p>
            <p className="text-gray-400 dark:text-gray-500 mt-1 text-xs">
              AI reads your handwriting and organizes items by store section
            </p>

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

        {/* Continue Previous List Section */}
        {!preview && !isLoading && hasHistory && displaySessions.length > 0 && onLoadSession && (
          <div className="bg-white dark:bg-gray-800 dark:card-depth rounded-lg shadow-lg p-6 mt-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <svg
                    className="w-5 h-5 text-blue-600 dark:text-blue-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <div>
                  <h2 className="font-semibold text-gray-800 dark:text-gray-100">
                    Continue a Previous List
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {recentSessions.length} saved {recentSessions.length === 1 ? "list" : "lists"}
                  </p>
                </div>
              </div>
              {onOpenHistory && (
                <button
                  onClick={onOpenHistory}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
                >
                  View All
                </button>
              )}
            </div>

            <div className="space-y-2">
              {displaySessions.map((session) => {
                const progress = session.itemCount > 0
                  ? Math.round((session.checkedCount / session.itemCount) * 100)
                  : 0;

                return (
                  <button
                    key={session.id}
                    onClick={() => onLoadSession(session.id)}
                    className="w-full text-left p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition interactive-press"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-gray-800 dark:text-gray-100 truncate">
                          {session.name}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {formatDate(session.createdAt)}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 ml-3">
                        {/* Mini progress indicator */}
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                progress === 100
                                  ? "bg-green-500"
                                  : progress > 50
                                  ? "bg-blue-500"
                                  : "bg-gray-400"
                              }`}
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-500 dark:text-gray-400 w-8">
                            {progress}%
                          </span>
                        </div>
                        <svg
                          className="w-5 h-5 text-gray-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 5l7 7-7 7"
                          />
                        </svg>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
