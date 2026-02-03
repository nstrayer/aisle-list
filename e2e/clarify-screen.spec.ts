import { test, expect, setApiKey, createTestImageFile } from "./fixtures/test-fixtures";

test.describe("Clarify Screen", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await setApiKey(page);
    await page.reload();

    // Upload image to get to clarify screen
    const fileInput = page.locator('input[type="file"]');
    const testImage = createTestImageFile();
    await fileInput.setInputFiles({
      name: testImage.name,
      mimeType: testImage.mimeType,
      buffer: testImage.buffer,
    });

    // Wait for clarify screen
    await expect(page.getByRole("heading", { name: "Review Sections" })).toBeVisible({ timeout: 10000 });
  });

  test("displays all identified sections", async ({ page }) => {
    // From mock-responses.ts: 5 sections - use h3 headings for section names
    await expect(page.locator("h3").filter({ hasText: "Grocery list" })).toBeVisible();
    await expect(page.locator("h3").filter({ hasText: "Costco" })).toBeVisible();
    await expect(page.locator("h3").filter({ hasText: "Meal Plan" })).toBeVisible();
    await expect(page.locator("h3").filter({ hasText: "Already have" })).toBeVisible();
    await expect(page.locator("h3").filter({ hasText: "Notes" })).toBeVisible();
  });

  test("grocery sections are checked by default", async ({ page }) => {
    // "Grocery list" section should be checked
    const grocerySection = page.locator("div.border").filter({ hasText: "Grocery list" }).first();
    const checkbox = grocerySection.locator('input[type="checkbox"]');
    await expect(checkbox).toBeChecked();
  });

  test("crossed_out sections are unchecked by default", async ({ page }) => {
    // "Already have" section (type: crossed_out) should be unchecked
    const crossedOutSection = page.locator("div.border").filter({ hasText: "Already have" }).first();
    const checkbox = crossedOutSection.locator('input[type="checkbox"]');
    await expect(checkbox).not.toBeChecked();
  });

  test("toggle selection works", async ({ page }) => {
    // Find the Grocery list section container and click it
    const grocerySection = page.locator("div.border").filter({ hasText: "Grocery list" }).first();
    await grocerySection.click();

    // Checkbox should now be unchecked
    const checkbox = grocerySection.locator('input[type="checkbox"]');
    await expect(checkbox).not.toBeChecked();

    // Click again to re-check
    await grocerySection.click();
    await expect(checkbox).toBeChecked();
  });

  test("shows section item counts", async ({ page }) => {
    // Grocery list has 5 items in mock
    await expect(page.getByText("5 items")).toBeVisible();
    // Multiple sections have 3 items (Costco and Meal Plan), just check one exists
    await expect(page.getByText("3 items").first()).toBeVisible();
  });

  test("Add Selected to List navigates to list view", async ({ page }) => {
    const addButton = page.getByRole("button", { name: "Add Selected to List" });
    await addButton.click();

    // Should show the grocery list view with items grouped by section
    // Session names are date-based like "Monday, Jan 3", but we can check for section headers
    await expect(page.locator("h3").filter({ hasText: "Dairy & Eggs" })).toBeVisible({ timeout: 5000 });
  });

  test("shows selected count", async ({ page }) => {
    // Default: all except crossed_out (4 of 5)
    await expect(page.getByText("4 of 5 sections selected")).toBeVisible();
  });
});
