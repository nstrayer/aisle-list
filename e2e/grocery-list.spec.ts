import { test, expect, setApiKey, createTestImageFile } from "./fixtures/test-fixtures";

test.describe("Grocery List View", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await setApiKey(page);
    await page.reload();

    // Upload and process image
    const fileInput = page.locator('input[type="file"]');
    const testImage = createTestImageFile();
    await fileInput.setInputFiles({
      name: testImage.name,
      mimeType: testImage.mimeType,
      buffer: testImage.buffer,
    });

    // Wait for clarify screen
    await expect(page.getByRole("heading", { name: "Review Sections" })).toBeVisible({ timeout: 10000 });

    // Confirm selections (default: all except crossed_out)
    await page.getByRole("button", { name: "Add Selected to List" }).click();

    // Wait for list view - look for store section headers
    await expect(page.locator("h3").filter({ hasText: "Dairy & Eggs" })).toBeVisible({ timeout: 5000 });
  });

  test("items are grouped by store section", async ({ page }) => {
    // From mock data: milk, eggs, cheese -> Dairy & Eggs; bread, butter -> Bakery
    // Check for section headers (from store-sections.ts categories)
    await expect(page.locator("h3").filter({ hasText: "Dairy & Eggs" })).toBeVisible();
    await expect(page.locator("h3").filter({ hasText: "Bakery" })).toBeVisible();
  });

  test("items display correctly", async ({ page }) => {
    // Items from mock grocery sections - use exact: true to avoid matching section names
    await expect(page.getByText("milk", { exact: true })).toBeVisible();
    await expect(page.getByText("eggs", { exact: true })).toBeVisible();
    await expect(page.getByText("bread", { exact: true })).toBeVisible();
  });

  test("check/uncheck items works", async ({ page }) => {
    // Find the item row containing "milk"
    const milkItem = page.getByText("milk", { exact: true });
    // The checkbox wrapper div has onClick, find it via parent div structure
    const checkboxContainer = milkItem.locator("xpath=ancestor::div[contains(@class, 'flex items-center gap')]//div[contains(@class, 'cursor-pointer')]");
    const checkbox = milkItem.locator("xpath=ancestor::div[contains(@class, 'flex items-center gap')]//input[@type='checkbox']");

    // Initially unchecked
    await expect(checkbox).not.toBeChecked();

    // Click the checkbox container (the div that has onClick)
    await checkboxContainer.click();

    // Item should now be checked
    await expect(checkbox).toBeChecked();
    await expect(milkItem).toHaveClass(/line-through/);

    // Click again to uncheck
    await checkboxContainer.click();
    await expect(checkbox).not.toBeChecked();
    await expect(milkItem).not.toHaveClass(/line-through/);
  });

  test("progress updates when items checked", async ({ page }) => {
    // Click checkbox containers for two items
    const milkCheckbox = page.getByText("milk", { exact: true })
      .locator("xpath=ancestor::div[contains(@class, 'flex items-center gap')]//div[contains(@class, 'cursor-pointer')]");
    await milkCheckbox.click();

    const breadCheckbox = page.getByText("bread", { exact: true })
      .locator("xpath=ancestor::div[contains(@class, 'flex items-center gap')]//div[contains(@class, 'cursor-pointer')]");
    await breadCheckbox.click();

    // Progress should show some items checked
    // GroceryList shows "X of Y items checked"
    await expect(page.getByText(/2 of \d+ items checked/)).toBeVisible();
  });

  test("can start new list", async ({ page }) => {
    // Find new list button (desktop version)
    const newListButton = page.getByRole("button", { name: "New List" });
    await newListButton.click();

    // Should return to upload screen
    await expect(page.getByText("Upload Grocery List Photo")).toBeVisible();
  });
});
