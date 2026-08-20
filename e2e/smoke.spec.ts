import { test, expect } from "@playwright/test";

test.describe("RefurbCompare smoke", () => {
  test("home page renders catalogue and demo notice", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/RefurbCompare/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Compare refurbished",
    );
    await expect(page.getByText("Demo mode")).toBeVisible();
    await expect(page.getByRole("link", { name: /iPhone 13/ }).first()).toBeVisible();
  });

  test("phone listing page supports brand filter", async ({ page }) => {
    await page.goto("/phones");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "All refurbished phones",
    );
    await page.getByRole("button", { name: /Apple/ }).click();
    await expect(page).toHaveURL(/brand=Apple/);
    await expect(page.getByText("Apple iPhone 13 (128 GB)")).toBeVisible();
  });

  test("product page shows offers and price history", async ({ page }) => {
    await page.goto("/phones/apple-iphone-13-128gb");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Apple iPhone 13",
    );
    await expect(page.getByText("Compare offers")).toBeVisible();
    await expect(page.getByText("30-day price history")).toBeVisible();
  });

  test("deals page lists discounted offers", async ({ page }) => {
    await page.goto("/deals");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Best refurbished phone deals",
    );
    await expect(page.locator("text=Deals #1")).toBeVisible();
  });

  test("search returns matching products", async ({ page }) => {
    await page.goto("/search?q=galaxy");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      'Results for "galaxy"',
    );
    await expect(page.getByText("Samsung Galaxy S22 (128 GB)").first()).toBeVisible();
  });

  test("buy button on product page navigates to redirect route", async ({ page }) => {
    await page.goto("/phones/apple-iphone-13-128gb");
    const view = page.getByRole("link", { name: "View" }).first();
    await expect(view).toBeVisible();
    await view.click();
    await expect(page).toHaveURL(/\/go\/listing_/);
  });
});