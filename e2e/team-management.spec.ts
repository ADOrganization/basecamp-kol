import { test, expect } from '@playwright/test';

// Test credentials - will create or use existing user
const TEST_USER = {
  email: 'testuser@basecamp.test',
  password: 'testpassword123',
  name: 'Test User',
  organizationName: 'Test Agency'
};

test.describe('Team Management', () => {
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

      await page.click('button[type="submit"]');
      await page.waitForURL(/\/(agency|client)\/dashboard/, { timeout: 15000 });
    }

    console.log('Successfully logged in, current URL:', page.url());
  });

  test('should display team members in Team tab', async ({ page }) => {
    await page.goto('http://localhost:3000/agency/settings');
    await page.waitForLoadState('networkidle');

    // Wait for settings page to load
    await expect(page.locator('h1:has-text("Settings")')).toBeVisible({ timeout: 10000 });

    // Click on Team tab
    await page.click('button:has-text("Team")');
    await page.waitForTimeout(500);

    // Verify Team Members card is visible
    await expect(page.locator('text=Team Members')).toBeVisible();
    await expect(page.locator('text=Manage who has access to your organization')).toBeVisible();
    console.log('Team Members section is visible');

    // Verify Invite Member button exists
    const inviteButton = page.locator('button:has-text("Invite Member")');
    await expect(inviteButton).toBeVisible();
    console.log('Invite Member button is visible');

    // Verify current user is shown (as OWNER)
    const ownerBadge = page.locator('div:has-text("OWNER")').first();
    await expect(ownerBadge).toBeVisible();
    console.log('OWNER badge is visible');
  });

  test('should open invite member dialog', async ({ page }) => {
    await page.goto('http://localhost:3000/agency/settings');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('h1:has-text("Settings")')).toBeVisible({ timeout: 10000 });

    // Click on Team tab
    await page.click('button:has-text("Team")');
    await page.waitForTimeout(500);

    // Click Invite Member button
    await page.click('button:has-text("Invite Member")');

    // Verify dialog opens
    await expect(page.locator('text=Invite Team Member')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Invite a new member to your organization')).toBeVisible();
    console.log('Invite Member dialog opened');

    // Verify form fields
    await expect(page.locator('#invite-name')).toBeVisible();
    await expect(page.locator('#invite-email')).toBeVisible();
    await expect(page.locator('#invite-role')).toBeVisible();
    console.log('All form fields are visible');

    // Cancel dialog
    await page.click('button:has-text("Cancel")');
    await expect(page.locator('text=Invite Team Member')).not.toBeVisible({ timeout: 3000 });
    console.log('Dialog closed successfully');
  });

  test('should invite a new team member', async ({ page }) => {
    await page.goto('http://localhost:3000/agency/settings');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('h1:has-text("Settings")')).toBeVisible({ timeout: 10000 });

    // Click on Team tab
    await page.click('button:has-text("Team")');
    await page.waitForTimeout(500);

    // Click Invite Member button
    await page.click('button:has-text("Invite Member")');
    await expect(page.locator('text=Invite Team Member')).toBeVisible({ timeout: 5000 });

    // Fill in the form
    const uniqueEmail = `invited-${Date.now()}@test.com`;
    const uniqueName = `Invited User ${Date.now()}`;

    await page.fill('#invite-name', uniqueName);
    await page.fill('#invite-email', uniqueEmail);

    // Select role (MEMBER is default)
    console.log('Filled in invite form');

    // Submit the form
    await page.click('button:has-text("Send Invite")');

    // Wait for success message
    await expect(page.locator(`text=${uniqueName} has been invited to the team`)).toBeVisible({ timeout: 10000 });
    console.log('SUCCESS: Team member invited!');

    // Verify the new member appears in the list (use exact match for the name in a p element)
    await expect(page.locator(`p.font-medium:has-text("${uniqueName}")`)).toBeVisible({ timeout: 5000 });
    await expect(page.locator(`p.text-sm:has-text("${uniqueEmail}")`)).toBeVisible();
    console.log('SUCCESS: New member appears in the list!');
  });

  test('should show remove confirmation dialog', async ({ page }) => {
    await page.goto('http://localhost:3000/agency/settings');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('h1:has-text("Settings")')).toBeVisible({ timeout: 10000 });

    // Click on Team tab
    await page.click('button:has-text("Team")');
    await page.waitForTimeout(500);

    // First invite a member so we have someone to remove
    await page.click('button:has-text("Invite Member")');
    await expect(page.locator('text=Invite Team Member')).toBeVisible({ timeout: 5000 });

    const uniqueEmail = `removable-${Date.now()}@test.com`;
    const uniqueName = `Removable User ${Date.now()}`;

    await page.fill('#invite-name', uniqueName);
    await page.fill('#invite-email', uniqueEmail);
    await page.click('button:has-text("Send Invite")');

    await expect(page.locator(`text=${uniqueName} has been invited to the team`)).toBeVisible({ timeout: 10000 });
    console.log('Member invited for removal test');

    // Find the Remove button for this member - use a more specific selector
    // Look for the member row that contains the email, then find the Remove button
    const removeButton = page.locator(`p.text-sm:has-text("${uniqueEmail}")`).locator('..').locator('..').locator('..').locator('button:has-text("Remove")');

    // Click Remove
    await removeButton.first().click();

    // Verify confirmation dialog appears
    await expect(page.locator('text=Remove Team Member')).toBeVisible({ timeout: 5000 });
    await expect(page.locator(`text=Are you sure you want to remove ${uniqueName}`)).toBeVisible();
    console.log('Remove confirmation dialog shown');

    // Cancel removal
    await page.click('button:has-text("Cancel")');
    await expect(page.locator('text=Remove Team Member')).not.toBeVisible({ timeout: 3000 });
    console.log('Cancellation works correctly');
  });
});
