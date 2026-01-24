import { test, expect } from '@playwright/test';

const TEST_USER = {
  email: 'testuser@basecamp.test',
  password: 'testpassword123',
};

test.describe('Campaign Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('http://localhost:3000/login');
    await page.waitForLoadState('networkidle');
    await page.fill('#email', TEST_USER.email);
    await page.fill('#password', TEST_USER.password);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(agency|client)\/dashboard/, { timeout: 10000 });
  });

  test('should load campaigns page', async ({ page }) => {
    await page.goto('http://localhost:3000/agency/campaigns');
    await page.waitForLoadState('networkidle');

    // Header says "Campaigns"
    await expect(page.locator('h1:has-text("Campaigns")')).toBeVisible();
    console.log('Campaigns page loaded');
  });

  test('should open and close create campaign form', async ({ page }) => {
    await page.goto('http://localhost:3000/agency/campaigns');
    await page.waitForLoadState('networkidle');

    // Click New Campaign button
    const newCampaignButton = page.locator('button:has-text("New Campaign")');
    await newCampaignButton.click();

    // Dialog should open with title "Create New Campaign"
    await expect(page.locator('text=Create New Campaign')).toBeVisible({ timeout: 5000 });
    console.log('Create Campaign dialog opened');

    // Close dialog by pressing Escape
    await page.keyboard.press('Escape');
    await expect(page.locator('[role="dialog"]')).not.toBeVisible({ timeout: 3000 });
    console.log('Dialog closed');
  });

  test('should create a new campaign', async ({ page }) => {
    await page.goto('http://localhost:3000/agency/campaigns');
    await page.waitForLoadState('networkidle');

    // Click New Campaign button
    await page.locator('button:has-text("New Campaign")').first().click();
    await expect(page.locator('text=Create New Campaign')).toBeVisible({ timeout: 5000 });

    // Fill in campaign details in the dialog
    const timestamp = Date.now();
    const campaignName = `Test Campaign ${timestamp}`;

    // Fill form fields
    await page.locator('[role="dialog"] input#name').fill(campaignName);
    await page.locator('[role="dialog"] input#projectTwitterHandle').fill(`@TestProject${timestamp}`);
    await page.locator('[role="dialog"] textarea#description').fill('This is a test campaign created by Playwright');

    console.log('Filled campaign form');

    // Click the submit button in the dialog
    const dialogSubmitButton = page.locator('[role="dialog"] button[type="submit"]');
    await dialogSubmitButton.click();

    // Wait for dialog to close
    await expect(page.locator('[role="dialog"]')).not.toBeVisible({ timeout: 10000 });
    console.log('Dialog closed after submit');

    // Wait for the page to update
    await page.waitForLoadState('networkidle');

    // If campaign still not visible, reload the page
    let campaignVisible = await page.locator(`text=${campaignName}`).isVisible();
    if (!campaignVisible) {
      console.log('Campaign not visible, reloading page...');
      await page.reload();
      await page.waitForLoadState('networkidle');
    }

    // Verify campaign appears in the list
    await expect(page.locator(`text=${campaignName}`)).toBeVisible({ timeout: 10000 });
    console.log('Campaign created successfully:', campaignName);
  });

  test('should navigate to campaign detail page', async ({ page }) => {
    await page.goto('http://localhost:3000/agency/campaigns');
    await page.waitForLoadState('networkidle');

    // First create a campaign if none exist
    const noCampaignsMessage = page.locator('text=No campaigns found');
    if (await noCampaignsMessage.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log('No campaigns found, creating one...');
      await page.locator('button:has-text("Create Campaign")').click();
      await expect(page.locator('text=Create New Campaign')).toBeVisible({ timeout: 5000 });

      const timestamp = Date.now();
      const campaignName = `Navigation Test ${timestamp}`;
      await page.locator('[role="dialog"] input#name').fill(campaignName);
      await page.locator('[role="dialog"] button[type="submit"]').click();
      await expect(page.locator('[role="dialog"]')).not.toBeVisible({ timeout: 10000 });
      await page.waitForLoadState('networkidle');
    }

    // Click on the first campaign card to view details
    const campaignCard = page.locator('[class*="campaign"], a[href*="/agency/campaigns/"]').first();

    // Try clicking on the campaign name or card
    const viewButton = page.locator('text=View Campaign').first();
    if (await viewButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await viewButton.click();
    } else {
      // Try clicking on campaign card link
      const campaignLink = page.locator('a[href*="/agency/campaigns/"]').first();
      await campaignLink.click();
    }

    // Wait for navigation to campaign detail page
    await page.waitForURL(/\/agency\/campaigns\/[a-z0-9-]+$/, { timeout: 10000 });
    console.log('Navigated to campaign detail page:', page.url());
  });
});
