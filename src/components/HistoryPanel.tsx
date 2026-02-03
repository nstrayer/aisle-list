import { useState } from "react";
import type { SessionIndexEntry } from "@/lib/types";
import { SwipeableItem } from "./SwipeableItem";

interface HistoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  sessions: SessionIndexEntry[];
  currentSessionId: string | null;
  onLoadSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
  onRenameSession: (id: string, name: string) => void;
}

export function HistoryPanel({
  isOpen,
  onClose,
  sessions,
  currentSessionId,
  onLoadSession,
  onDeleteSession,
  onRenameSession,
}: HistoryPanelProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const handleStartEdit = (id: string, currentName: string) => {
    setEditingId(id);
    setEditName(currentName);
  };

  const handleSaveEdit = () => {
    if (editingId && editName.trim()) {
      onRenameSession(editingId, editName.trim());
    }
    setEditingId(null);
    setEditName("");
  };

  const handleLoad = (id: string) => {
    if (editingId) return;
    onLoadSession(id);
    onClose();
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 w-full max-w-sm bg-white dark:bg-gray-800 dark:card-depth shadow-xl z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
            List History
          </h2>
          <button
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 interactive-press"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {sessions.length === 0 ? (
            <div className="p-4 text-center text-gray-500 dark:text-gray-400">
              No saved lists yet
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {sessions.map((session) => {
                const progress = session.itemCount > 0
                  ? Math.round((session.checkedCount / session.itemCount) * 100)
                  : 0;

                return (
                  <SwipeableItem
                    key={session.id}
                    onDelete={() => onDeleteSession(session.id)}
                  >
                    <div
                      className={`p-4 cursor-pointer transition interactive-press ${
                        session.id === currentSessionId
                          ? "bg-green-50 dark:bg-green-900/20"
                          : "hover:bg-gray-50 dark:hover:bg-gray-700/50"
                      }`}
                      onClick={() => handleLoad(session.id)}
                    >
                      {editingId === session.id ? (
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onBlur={handleSaveEdit}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSaveEdit();
                            if (e.key === "Escape") {
                              setEditingId(null);
                              setEditName("");
                            }
                          }}
                          onClick={(e) => e.stopPropagation()}
                          autoFocus
                          className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 font-medium"
                        />
                      ) : (
                        <div className="flex items-center justify-between">
                          <h3
                            className="font-medium text-gray-800 dark:text-gray-100"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStartEdit(session.id, session.name);
                            }}
                          >
                            {session.name}
                            {session.id === currentSessionId && (
                              <span className="ml-2 text-xs text-green-600 dark:text-green-400">
                                (current)
                              </span>
                            )}
                          </h3>
                          {session.hasImage && (
                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          )}
                        </div>
                      )}
                      <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        {formatDate(session.createdAt)}
                      </div>
                      {/* Progress bar */}
                      <div className="mt-2 flex items-center gap-2">
                        <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
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
                        <span className="text-xs text-gray-500 dark:text-gray-400 w-12 text-right">
                          {session.checkedCount}/{session.itemCount}
                        </span>
                      </div>
                    </div>
                  </SwipeableItem>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
