"use client";

import { useState } from "react";

interface ApiKeyInputProps {
  onSave: (apiKey: string) => void;
}

export function ApiKeyInput({ onSave }: ApiKeyInputProps) {
  const [apiKey, setApiKey] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (apiKey.trim()) {
      onSave(apiKey.trim());
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 p-4 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
        <h1 className="text-2xl font-bold text-green-700 mb-2">
          Smart Grocery List
        </h1>
        <p className="text-gray-600 mb-6">Powered by Claude AI</p>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Anthropic API Key
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-ant-..."
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-2">
              Get your API key from{" "}
              <a
                href="https://console.anthropic.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                console.anthropic.com
              </a>
            </p>
          </div>

          <button
            type="submit"
            disabled={!apiKey.trim()}
            className="w-full bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 transition disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            Save & Continue
          </button>
        </form>

        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <p className="text-sm text-gray-700">
            <strong>How it works:</strong>
          </p>
          <ul className="text-sm text-gray-600 mt-2 space-y-1">
            <li>- Upload a photo of your handwritten grocery list</li>
            <li>- Claude AI reads and identifies sections</li>
            <li>- Choose which sections to include</li>
            <li>- Items are organized by Kroger store sections</li>
          </ul>
        </div>

        <p className="text-xs text-gray-400 mt-4">
          Your API key is stored locally in your browser and never sent anywhere
          except directly to Anthropic&apos;s API.
        </p>
      </div>
    </div>
  );
}
