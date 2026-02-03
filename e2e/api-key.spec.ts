import { test, expect, setApiKey, clearStorage } from "./fixtures/test-fixtures";

test.describe("API Key Entry", () => {
  test("shows API key form on first visit", async ({ page }) => {
    await page.goto("/");
    await clearStorage(page);
    await page.reload();
    await expect(page.getByPlaceholder("sk-ant-...")).toBeVisible();
  });

  test("submit button is disabled without key", async ({ page }) => {
    await page.goto("/");
    await clearStorage(page);
    await page.reload();
    const submitButton = page.getByRole("button", { name: "Save & Continue" });
    await expect(submitButton).toBeDisabled();
  });

  test("enables submit when key is entered", async ({ page }) => {
    await page.goto("/");
    await clearStorage(page);
    await page.reload();
    const input = page.getByPlaceholder("sk-ant-...");
    await input.fill("sk-ant-test-key-123");

    const submitButton = page.getByRole("button", { name: "Save & Continue" });
    await expect(submitButton).toBeEnabled();
  });

  test("persists key to localStorage after submit", async ({ page }) => {
    await page.goto("/");
    await clearStorage(page);
    await page.reload();
    const input = page.getByPlaceholder("sk-ant-...");
    await input.fill("sk-ant-test-key-123");

    const submitButton = page.getByRole("button", { name: "Save & Continue" });
    await submitButton.click();

    const storedKey = await page.evaluate(() => localStorage.getItem("anthropic_api_key"));
    expect(storedKey).toBe("sk-ant-test-key-123");
  });

  test("skips to upload on return visit with saved key", async ({ page }) => {
    await page.goto("/");
    await setApiKey(page);
    await page.reload();

    // Should show upload area, not API key form
    // The upload "button" is actually a label for the hidden file input
    await expect(page.getByText("Upload Grocery List Photo")).toBeVisible();
    await expect(page.getByPlaceholder("sk-ant-...")).not.toBeVisible();
  });
});
