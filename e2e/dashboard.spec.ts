import { test, expect } from '@playwright/test';

const TEST_USER = {
  email: 'testuser@basecamp.test',
  password: 'testpassword123',
};

test.describe('Agency Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('http://localhost:3000/login');
    await page.waitForLoadState('networkidle');
    await page.fill('#email', TEST_USER.email);
    await page.fill('#password', TEST_USER.password);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(agency|client)\/dashboard/, { timeout: 10000 });
  });

  test('should load dashboard page', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard');
    await page.waitForLoadState('networkidle');

    // Dashboard should have some key elements
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 5000 });
    console.log('Dashboard page loaded');
  });

  test('should have sidebar navigation', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard');
    await page.waitForLoadState('networkidle');

    // Check sidebar navigation links exist (use nav element to target sidebar)
    const sidebar = page.locator('nav');
    await expect(sidebar.locator('a[href="/dashboard"]')).toBeVisible();
    await expect(sidebar.locator('a[href="/kols"]')).toBeVisible();
    await expect(sidebar.locator('a[href="/campaigns"]')).toBeVisible();
    await expect(sidebar.locator('a[href="/settings"]')).toBeVisible();

    console.log('All sidebar navigation links are visible');
  });

  test('should navigate to KOLs page from sidebar', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard');
    await page.waitForLoadState('networkidle');

    // Click on KOLs link in sidebar (use nav element to target sidebar)
    await page.locator('nav a[href="/kols"]').click();
    await page.waitForURL(/\/agency\/kols/, { timeout: 5000 });

    await expect(page.locator('h1:has-text("KOL Roster")')).toBeVisible();
    console.log('Navigated to KOLs page');
  });

  test('should navigate to Campaigns page from sidebar', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard');
    await page.waitForLoadState('networkidle');

    // Click on Campaigns link in sidebar (use nav element to target sidebar)
    await page.locator('nav a[href="/campaigns"]').click();
    await page.waitForURL(/\/agency\/campaigns/, { timeout: 5000 });

    await expect(page.locator('h1:has-text("Campaigns")')).toBeVisible();
    console.log('Navigated to Campaigns page');
  });

  test('should navigate to Settings page from sidebar', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard');
    await page.waitForLoadState('networkidle');

    // Click on Settings link in sidebar
    await page.locator('a[href="/settings"]').click();
    await page.waitForURL(/\/agency\/settings/, { timeout: 5000 });

    await expect(page.locator('h1:has-text("Settings")')).toBeVisible();
    console.log('Navigated to Settings page');
  });
});
