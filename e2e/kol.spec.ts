import { test, expect } from '@playwright/test';

const TEST_USER = {
  email: 'testuser@basecamp.test',
  password: 'testpassword123',
};

test.describe('KOL Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('http://localhost:3000/login');
    await page.waitForLoadState('networkidle');
    await page.fill('#email', TEST_USER.email);
    await page.fill('#password', TEST_USER.password);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(agency|client)\/dashboard/, { timeout: 10000 });
  });

  test('should load KOL list page', async ({ page }) => {
    await page.goto('http://localhost:3000/agency/kols');
    await page.waitForLoadState('networkidle');

    // Header says "KOL Roster"
    await expect(page.locator('h1:has-text("KOL Roster")')).toBeVisible();
    console.log('KOL page loaded');
  });

  test('should open and close create KOL form', async ({ page }) => {
    await page.goto('http://localhost:3000/agency/kols');
    await page.waitForLoadState('networkidle');

    // Click Add KOL button
    const addButton = page.locator('button:has-text("Add KOL")');
    await addButton.click();

    // Dialog should open with title "Add New KOL"
    await expect(page.locator('text=Add New KOL')).toBeVisible({ timeout: 5000 });
    console.log('Add KOL dialog opened');

    // Close dialog by clicking outside or pressing Escape
    await page.keyboard.press('Escape');
    await expect(page.locator('text=Add New KOL')).not.toBeVisible({ timeout: 3000 });
    console.log('Dialog closed');
  });

  test('should create a new KOL', async ({ page }) => {
    await page.goto('http://localhost:3000/agency/kols');
    await page.waitForLoadState('networkidle');

    // Click Add KOL button on the page
    await page.locator('button:has-text("Add KOL")').first().click();
    await expect(page.locator('text=Add New KOL')).toBeVisible({ timeout: 5000 });

    // Fill in KOL details in the dialog
    const timestamp = Date.now();
    const kolName = `Test KOL ${timestamp}`;

    // Use specific selectors within the dialog
    await page.locator('[role="dialog"] input#name').fill(kolName);
    await page.locator('[role="dialog"] input#twitterHandle').fill(`testkol${timestamp}`);

    // Click the submit button in the dialog (not the header button)
    const dialogSubmitButton = page.locator('[role="dialog"] button[type="submit"]');
    await dialogSubmitButton.click();

    // Wait for dialog to close
    await expect(page.locator('[role="dialog"]')).not.toBeVisible({ timeout: 10000 });
    console.log('Dialog closed after submit');

    // Wait for the page to update (router.refresh())
    await page.waitForLoadState('networkidle');
    console.log('Network idle after dialog close');

    // If KOL still not visible, reload the page
    let kolVisible = await page.locator(`text=${kolName}`).isVisible();
    if (!kolVisible) {
      console.log('KOL not visible, reloading page...');
      await page.reload();
      await page.waitForLoadState('networkidle');
    }

    // Verify KOL appears in the list
    await expect(page.locator(`text=${kolName}`)).toBeVisible({ timeout: 10000 });
    console.log('KOL created successfully:', kolName);
  });

  test('should refresh metrics for all KOLs', async ({ page }) => {
    await page.goto('http://localhost:3000/agency/kols');
    await page.waitForLoadState('networkidle');

    // Find and click Refresh Metrics button
    const refreshButton = page.locator('button:has-text("Refresh Metrics")');
    await expect(refreshButton).toBeVisible();
    console.log('Refresh Metrics button found');

    // Click the button
    await refreshButton.click();

    // Button should show "Refreshing..." state
    await expect(page.locator('button:has-text("Refreshing...")')).toBeVisible({ timeout: 5000 });
    console.log('Refresh started - button shows loading state');

    // Wait for refresh to complete (button returns to normal state)
    await expect(page.locator('button:has-text("Refresh Metrics")')).toBeVisible({ timeout: 60000 });
    console.log('Refresh completed - button returned to normal');

    // Check for success or status message
    const successMessage = page.locator('text=/Updated \\d+ of \\d+ KOLs/');
    const isSuccess = await successMessage.isVisible({ timeout: 3000 }).catch(() => false);

    if (isSuccess) {
      console.log('SUCCESS: Metrics refresh completed with status message');
    } else {
      console.log('Refresh completed (no KOLs to update or API issue)');
    }
  });
});
