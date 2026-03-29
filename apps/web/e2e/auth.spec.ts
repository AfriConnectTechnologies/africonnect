import { test, expect } from "@playwright/test";

test.describe("Authentication Flow", () => {
  test("should display sign in page", async ({ page }) => {
    await page.goto("/sign-in");
    
    // Clerk sign-in form should be visible - use first() to avoid strict mode violation
    await expect(
      page.locator('[data-clerk-component="SignIn"]').first()
    ).toBeVisible({ timeout: 10000 });
  });

  test("should display sign up page", async ({ page }) => {
    await page.goto("/sign-up");
    
    // Clerk sign-up form should be visible - use first() to avoid strict mode violation
    await expect(
      page.locator('[data-clerk-component="SignUp"]').first()
    ).toBeVisible({ timeout: 10000 });
  });

  test("should redirect unauthenticated users to sign in", async ({ page }) => {
    await page.goto("/dashboard");
    
    // Should redirect to sign-in page
    await expect(page).toHaveURL(/sign-in/);
  });
});

test.describe("Landing Page", () => {
  test("should display landing page content", async ({ page }) => {
    await page.goto("/");
    
    // Check page loads successfully - app title is "AfriConnect"
    await expect(page).toHaveTitle(/AfriConnect/i);
  });

  test("should have navigation links", async ({ page }) => {
    await page.goto("/");
    
    // Check for sign in/up buttons in the header navigation
    const signInButton = page.getByRole("navigation").getByRole("button", { name: /sign in/i });
    
    await expect(signInButton).toBeVisible();
  });
});

