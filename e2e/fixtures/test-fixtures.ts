import { test as base, Page } from "@playwright/test";
import { createMockApiResponse, mockSections } from "./mock-responses";
import type { GrocerySection } from "../../src/lib/types";

// Custom fixture type
type TestFixtures = {
  mockApi: {
    setResponse: (sections?: GrocerySection[]) => void;
  };
};

// Extend base test with API mocking
export const test = base.extend<TestFixtures>({
  mockApi: [
    async ({ page }, use) => {
      let customSections: GrocerySection[] | undefined;

      // Intercept Anthropic API calls
      await page.route("https://api.anthropic.com/v1/messages", async (route) => {
        const response = createMockApiResponse(customSections ?? mockSections);
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(response),
        });
      });

      await use({
        setResponse: (sections) => {
          customSections = sections;
        },
      });
    },
    { auto: true },
  ],
});

export { expect } from "@playwright/test";

// Helper to set up a test API key in localStorage
export async function setApiKey(page: Page, key = "test-api-key-123") {
  await page.evaluate((k) => {
    localStorage.setItem("anthropic_api_key", k);
  }, key);
}

// Helper to clear all localStorage
export async function clearStorage(page: Page) {
  await page.evaluate(() => {
    localStorage.clear();
  });
}

// Create a minimal valid JPEG as a data URL
export function createTestImageDataUrl(): string {
  // Minimal valid JPEG (1x1 red pixel)
  const jpegBase64 =
    "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRof" +
    "Hh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwh" +
    "MjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAAR" +
    "CAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAACAn/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBEQCEAwAAUAB//9k=";
  return `data:image/jpeg;base64,${jpegBase64}`;
}

// Create a File object for upload tests
export function createTestImageFile(): { buffer: Buffer; name: string; mimeType: string } {
  const base64 =
    "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRof" +
    "Hh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwh" +
    "MjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAAR" +
    "CAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAACAn/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBEQCEAwAAUAB//9k=";
  return {
    buffer: Buffer.from(base64, "base64"),
    name: "test-grocery-list.jpg",
    mimeType: "image/jpeg",
  };
}
