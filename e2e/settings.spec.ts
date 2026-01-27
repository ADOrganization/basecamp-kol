import { test, expect } from '@playwright/test';

// Test credentials - will create or use existing user
const TEST_USER = {
  email: 'testuser@basecamp.test',
  password: 'testpassword123',
  name: 'Test User',
  organizationName: 'Test Agency'
};

test.describe('Settings Page', () => {
  test.beforeEach(async ({ page }) => {
    // Try to login first
    await page.goto('http://localhost:3000/login');
    await page.waitForLoadState('networkidle');

    await page.fill('#email', TEST_USER.email);
    await page.fill('#password', TEST_USER.password);
    await page.click('button[type="submit"]');

    // Wait for navigation
    try {
      await page.waitForURL(/\/(agency|client)\/dashboard/, { timeout: 5000 });
    } catch {
      // If login failed, register first
      console.log('Login failed, registering new user...');
      await page.goto('http://localhost:3000/register');
      await page.waitForLoadState('networkidle');

      await page.fill('#name', TEST_USER.name);
      await page.fill('#email', TEST_USER.email);
      await page.fill('#password', TEST_USER.password);
      await page.fill('#organizationName', TEST_USER.organizationName);

      // Organization type is already set to AGENCY by default
      await page.click('button[type="submit"]');

      // Wait for redirect after registration
      await page.waitForURL(/\/(agency|client)\/dashboard/, { timeout: 15000 });
    }

    console.log('Successfully logged in, current URL:', page.url());
  });

  test('should update profile name successfully', async ({ page }) => {
    // Navigate to settings
    await page.goto('http://localhost:3000/settings');
    await page.waitForLoadState('networkidle');

    // Wait for the form to load
    await expect(page.locator('h1:has-text("Settings")')).toBeVisible({ timeout: 10000 });
    console.log('Settings page loaded');

    // Wait for the Profile tab content to be visible
    await page.waitForSelector('#name', { state: 'visible', timeout: 10000 });

    // Find the name input and get current value
    const nameInput = page.locator('#name');
    const currentName = await nameInput.inputValue();
    console.log('Current name value:', currentName);

    // Set a new name with timestamp to ensure it's unique
    const newName = `Updated User ${Date.now()}`;
    await nameInput.fill(newName);
    console.log('Set new name to:', newName);

    // Click Save Changes button (first one, for Profile form)
    const saveButton = page.locator('button:has-text("Save Changes")').first();
    await saveButton.click();
    console.log('Clicked Save Changes');

    // Wait for the API call and check for success message
    await expect(page.locator('text=Profile updated successfully')).toBeVisible({ timeout: 10000 });
    console.log('SUCCESS: Saw success message!');

    // IMPORTANT: Wait for page refresh and verify sidebar shows new name
    await page.waitForTimeout(1000); // Give router.refresh() time to complete
    const sidebarName = page.locator(`button:has-text("${newName}")`).first();
    const sidebarUpdated = await sidebarName.isVisible({ timeout: 5000 }).catch(() => false);

    if (sidebarUpdated) {
      console.log('VERIFIED: Sidebar updated with new name!');
    } else {
      console.log('Sidebar may need page reload to update');
    }

    // Reload page and verify the name persisted
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('#name', { state: 'visible' });

    const updatedNameInput = page.locator('#name');
    const updatedName = await updatedNameInput.inputValue();
    console.log('After reload, name is:', updatedName);

    expect(updatedName).toBe(newName);
    console.log('VERIFIED: Name persisted after reload!');

    // Verify sidebar shows the new name after reload (user menu is below nav, look for button containing the name)
    const sidebarAfterReload = page.locator(`button:has-text("${newName}")`).first();
    await expect(sidebarAfterReload).toBeVisible({ timeout: 5000 });
    console.log('VERIFIED: Sidebar shows new name after reload!');
  });

  test('should show loading state when saving', async ({ page }) => {
    await page.goto('http://localhost:3000/settings');
    await page.waitForLoadState('networkidle');

    await page.waitForSelector('#name', { state: 'visible', timeout: 10000 });
    const nameInput = page.locator('#name');
    await nameInput.fill('Loading Test');

    const saveButton = page.locator('button:has-text("Save Changes")').first();

    // Click and immediately check for loading state
    await saveButton.click();

    // Check for loading state (button should show "Saving..." with spinner)
    const loadingButton = page.locator('button:has-text("Saving...")');
    await expect(loadingButton).toBeVisible({ timeout: 2000 });
    console.log('SUCCESS: Loading state visible!');
  });
});
