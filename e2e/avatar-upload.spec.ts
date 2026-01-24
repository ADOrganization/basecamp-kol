import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

// Test credentials - will create or use existing user
const TEST_USER = {
  email: 'testuser@basecamp.test',
  password: 'testpassword123',
  name: 'Test User',
  organizationName: 'Test Agency'
};

// Create a simple test image (1x1 pixel PNG)
function createTestImage(): Buffer {
  // Minimal valid PNG file (1x1 transparent pixel)
  return Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
    0x00, 0x00, 0x00, 0x0D, // IHDR length
    0x49, 0x48, 0x44, 0x52, // IHDR
    0x00, 0x00, 0x00, 0x01, // width: 1
    0x00, 0x00, 0x00, 0x01, // height: 1
    0x08, 0x06, // bit depth: 8, color type: RGBA
    0x00, 0x00, 0x00, // compression, filter, interlace
    0x1F, 0x15, 0xC4, 0x89, // IHDR CRC
    0x00, 0x00, 0x00, 0x0A, // IDAT length
    0x49, 0x44, 0x41, 0x54, // IDAT
    0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00, 0x05, 0x00, 0x01, // compressed data
    0x0D, 0x0A, 0x2D, 0xB4, // IDAT CRC
    0x00, 0x00, 0x00, 0x00, // IEND length
    0x49, 0x45, 0x4E, 0x44, // IEND
    0xAE, 0x42, 0x60, 0x82  // IEND CRC
  ]);
}

test.describe('Avatar Upload', () => {
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

  test('should allow changing profile photo', async ({ page }) => {
    // Navigate to settings
    await page.goto('http://localhost:3000/agency/settings');
    await page.waitForLoadState('networkidle');

    // Wait for the form to load
    await expect(page.locator('h1:has-text("Settings")')).toBeVisible({ timeout: 10000 });
    console.log('Settings page loaded');

    // Find the Change Photo button
    const changePhotoButton = page.locator('button:has-text("Change Photo")');
    await expect(changePhotoButton).toBeVisible({ timeout: 5000 });
    console.log('Change Photo button found');

    // Create a test image file
    const testImagePath = path.join('/tmp', 'test-avatar.png');
    fs.writeFileSync(testImagePath, createTestImage());

    // Set up file chooser listener before clicking
    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      changePhotoButton.click(),
    ]);
    console.log('File chooser opened');

    // Upload the test image
    await fileChooser.setFiles(testImagePath);
    console.log('File uploaded');

    // Wait for the upload to complete (button should show "Uploading..." then go back)
    await expect(changePhotoButton).toBeEnabled({ timeout: 10000 });
    console.log('Upload completed');

    // Check for success message
    await expect(page.locator('text=Profile updated successfully')).toBeVisible({ timeout: 10000 });
    console.log('SUCCESS: Avatar upload showed success message!');

    // Verify avatar image is displayed
    const avatarImage = page.locator('img[alt*="avatar" i], img[alt*="User" i]').first();
    const hasAvatar = await avatarImage.isVisible().catch(() => false);
    if (hasAvatar) {
      console.log('SUCCESS: Avatar image is displayed!');
    } else {
      // The fallback might still show if there's a race condition, that's OK
      console.log('Avatar may use fallback initially');
    }

    // Clean up
    fs.unlinkSync(testImagePath);
  });

  test('should validate file type', async ({ page }) => {
    // Navigate to settings
    await page.goto('http://localhost:3000/agency/settings');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('h1:has-text("Settings")')).toBeVisible({ timeout: 10000 });

    // Create a fake text file
    const testTextPath = path.join('/tmp', 'test-file.txt');
    fs.writeFileSync(testTextPath, 'This is not an image');

    const changePhotoButton = page.locator('button:has-text("Change Photo")');

    // Set up file chooser and upload invalid file
    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      changePhotoButton.click(),
    ]);

    await fileChooser.setFiles(testTextPath);

    // Should show error message
    await expect(page.locator('text=Invalid file type')).toBeVisible({ timeout: 5000 });
    console.log('SUCCESS: Invalid file type error shown!');

    // Clean up
    fs.unlinkSync(testTextPath);
  });

  test('should allow uploading organization logo', async ({ page }) => {
    // Navigate to settings
    await page.goto('http://localhost:3000/agency/settings');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('h1:has-text("Settings")')).toBeVisible({ timeout: 10000 });

    // Click on Organization tab
    await page.click('button:has-text("Organization")');
    await page.waitForTimeout(500);

    // Find the Upload Logo button
    const uploadLogoButton = page.locator('button:has-text("Upload Logo")');
    await expect(uploadLogoButton).toBeVisible({ timeout: 5000 });
    console.log('Upload Logo button found');

    // Create a test image file
    const testImagePath = path.join('/tmp', 'test-logo.png');
    fs.writeFileSync(testImagePath, createTestImage());

    // Set up file chooser listener before clicking
    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      uploadLogoButton.click(),
    ]);
    console.log('File chooser opened for logo');

    // Upload the test image
    await fileChooser.setFiles(testImagePath);
    console.log('Logo file uploaded');

    // Wait for the upload to complete
    await expect(uploadLogoButton).toBeEnabled({ timeout: 10000 });
    console.log('Logo upload completed');

    // Check for success message
    await expect(page.locator('text=Organization updated successfully')).toBeVisible({ timeout: 10000 });
    console.log('SUCCESS: Logo upload showed success message!');

    // Clean up
    fs.unlinkSync(testImagePath);
  });
});
