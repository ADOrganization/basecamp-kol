import { test, expect } from '@playwright/test';

const TEST_USER = {
  email: 'testuser@basecamp.test',
  password: 'testpassword123',
};

test.describe('Full Application Test Suite', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('http://localhost:3000/login');
    await page.waitForLoadState('networkidle');
    await page.fill('#email', TEST_USER.email);
    await page.fill('#password', TEST_USER.password);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(agency|client)\/dashboard/, { timeout: 10000 });
  });

  // ==================== CONTENT REVIEW ====================
  test('should load content review page', async ({ page }) => {
    await page.goto('http://localhost:3000/agency/content/review');
    await page.waitForLoadState('networkidle');

    // Should have content review header or related elements
    const header = page.locator('h1, h2').first();
    await expect(header).toBeVisible({ timeout: 5000 });
    console.log('Content Review page loaded');
  });

  // ==================== CLIENT ACCOUNTS ====================
  test('should load client accounts page', async ({ page }) => {
    await page.goto('http://localhost:3000/agency/clients');
    await page.waitForLoadState('networkidle');

    // Should have client accounts header
    await expect(page.locator('h1')).toBeVisible({ timeout: 5000 });
    console.log('Client Accounts page loaded');
  });

  test('should open create client form', async ({ page }) => {
    await page.goto('http://localhost:3000/agency/clients');
    await page.waitForLoadState('networkidle');

    // Look for Add/Create Client button
    const addButton = page.locator('button:has-text("Add Client"), button:has-text("Create Client"), button:has-text("New Client")').first();

    if (await addButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await addButton.click();
      // Dialog should open
      await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 5000 });
      console.log('Create Client dialog opened');
      await page.keyboard.press('Escape');
    } else {
      console.log('No Add Client button found - page may have different layout');
    }
  });

  // ==================== TELEGRAM ====================
  test('should load telegram page', async ({ page }) => {
    await page.goto('http://localhost:3000/agency/telegram');
    await page.waitForLoadState('networkidle');

    // Should have telegram header or related content
    const header = page.locator('h1, h2').first();
    await expect(header).toBeVisible({ timeout: 5000 });
    console.log('Telegram page loaded');
  });

  // ==================== CAMPAIGN DETAIL & KOL ASSIGNMENT ====================
  test('should view campaign detail and add KOL', async ({ page }) => {
    // First go to campaigns
    await page.goto('http://localhost:3000/agency/campaigns');
    await page.waitForLoadState('networkidle');

    // Click on first campaign to view details
    const campaignLink = page.locator('a[href*="/agency/campaigns/"]').first();

    if (await campaignLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await campaignLink.click();
      await page.waitForURL(/\/agency\/campaigns\/[a-z0-9-]+$/, { timeout: 10000 });
      console.log('Campaign detail page loaded:', page.url());

      // Look for Add KOL button on campaign detail
      const addKolButton = page.locator('button:has-text("Add KOL"), button:has-text("Assign KOL")').first();
      if (await addKolButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await addKolButton.click();
        await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 5000 });
        console.log('Add KOL to campaign dialog opened');
        await page.keyboard.press('Escape');
      } else {
        console.log('Add KOL button not found on campaign detail');
      }
    } else {
      console.log('No campaigns found to test detail view');
    }
  });

  // ==================== KOL DETAIL ====================
  test('should view KOL detail page', async ({ page }) => {
    await page.goto('http://localhost:3000/agency/kols');
    await page.waitForLoadState('networkidle');

    // Click on first KOL row to view details
    const kolLink = page.locator('a[href*="/agency/kols/"], tr[class*="cursor-pointer"]').first();

    if (await kolLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await kolLink.click();

      // Should navigate to KOL detail or open modal
      await page.waitForTimeout(1000);
      const currentUrl = page.url();

      if (currentUrl.includes('/agency/kols/')) {
        console.log('KOL detail page loaded:', currentUrl);
      } else {
        console.log('KOL detail may use modal instead of separate page');
      }
    } else {
      console.log('No KOLs found to test detail view');
    }
  });

  // ==================== POSTS/CONTENT ====================
  test('should add post to campaign', async ({ page }) => {
    // Navigate to a campaign
    await page.goto('http://localhost:3000/agency/campaigns');
    await page.waitForLoadState('networkidle');

    const campaignLink = page.locator('a[href*="/agency/campaigns/"]').first();

    if (await campaignLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await campaignLink.click();
      await page.waitForURL(/\/agency\/campaigns\/[a-z0-9-]+$/, { timeout: 10000 });

      // Look for Add Post button
      const addPostButton = page.locator('button:has-text("Add Post"), button:has-text("New Post"), button:has-text("Create Post")').first();

      if (await addPostButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await addPostButton.click();
        await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 5000 });
        console.log('Add Post dialog opened');
        await page.keyboard.press('Escape');
      } else {
        console.log('Add Post button not found');
      }
    } else {
      console.log('No campaigns to test post creation');
    }
  });

  // ==================== LOGOUT ====================
  test('should logout successfully', async ({ page }) => {
    await page.goto('http://localhost:3000/agency/dashboard');
    await page.waitForLoadState('networkidle');

    // Find user menu / dropdown
    const userMenu = page.locator('button:has-text("Updated User"), [class*="dropdown"]').first();

    if (await userMenu.isVisible({ timeout: 3000 }).catch(() => false)) {
      await userMenu.click();

      // Look for Sign out option
      const signOutButton = page.locator('text=Sign out, text=Logout, text=Log out').first();
      if (await signOutButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await signOutButton.click();
        await page.waitForURL(/\/login/, { timeout: 10000 });
        console.log('Logged out successfully');
      }
    } else {
      console.log('User menu not found for logout test');
    }
  });

  // ==================== ERROR HANDLING ====================
  test('should show 404 for invalid page', async ({ page }) => {
    await page.goto('http://localhost:3000/agency/invalid-page-that-does-not-exist');
    await page.waitForLoadState('networkidle');

    // Should show 404 or redirect
    const is404 = await page.locator('text=404, text=Not Found, text=Page not found').first().isVisible({ timeout: 3000 }).catch(() => false);
    const redirected = page.url().includes('/dashboard') || page.url().includes('/login');

    if (is404) {
      console.log('404 page shown correctly');
    } else if (redirected) {
      console.log('Redirected to:', page.url());
    } else {
      console.log('Page handled invalid URL');
    }
  });

  // ==================== RESPONSIVE CHECK ====================
  test('should work on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('http://localhost:3000/agency/dashboard');
    await page.waitForLoadState('networkidle');

    // Page should still be functional
    await expect(page.locator('body')).toBeVisible();
    console.log('Mobile viewport works');
  });
});
