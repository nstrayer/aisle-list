import { test, expect, setApiKey, createTestImageFile } from "./fixtures/test-fixtures";

test.describe("Image Upload", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await setApiKey(page);
    await page.reload();
  });

  test("shows upload area", async ({ page }) => {
    // The upload "button" is actually a label for the hidden file input
    await expect(page.getByText("Upload Grocery List Photo")).toBeVisible();
  });

  test("processes image and shows clarify screen", async ({ page }) => {
    // Find the file input
    const fileInput = page.locator('input[type="file"]');

    // Upload test image
    const testImage = createTestImageFile();
    await fileInput.setInputFiles({
      name: testImage.name,
      mimeType: testImage.mimeType,
      buffer: testImage.buffer,
    });

    // Should navigate to clarify screen
    await expect(page.getByRole("heading", { name: "Review Sections" })).toBeVisible({ timeout: 10000 });
  });

  test("shows loading state during processing", async ({ page }) => {
    // Slow down API response to observe loading state
    await page.route("https://api.anthropic.com/v1/messages", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "msg_mock",
          type: "message",
          role: "assistant",
          content: [
            {
              type: "tool_use",
              id: "toolu_mock",
              name: "grocery_sections",
              input: {
                sections: [{ name: "Test", type: "grocery", items: ["item1"] }],
              },
            },
          ],
          model: "claude-sonnet-4-5-20250929",
          stop_reason: "tool_use",
          usage: { input_tokens: 100, output_tokens: 50 },
        }),
      });
    });

    const fileInput = page.locator('input[type="file"]');
    const testImage = createTestImageFile();
    await fileInput.setInputFiles({
      name: testImage.name,
      mimeType: testImage.mimeType,
      buffer: testImage.buffer,
    });

    // Look for loading indicator - ImageUpload shows "Reading your grocery list..."
    await expect(page.getByText("Reading your grocery list...")).toBeVisible();
  });
});
