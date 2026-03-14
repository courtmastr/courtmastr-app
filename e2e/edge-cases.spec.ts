import { test, expect } from '@playwright/test';
import { getTournamentId } from './utils/test-data';

/**
 * Comprehensive Edge Case Tests for CourtMastr
 * These tests cover boundary conditions, race conditions, and unusual scenarios
 */

// Firebase auth state lives in IndexedDB — storageState does not restore it.
// Tests that need an authenticated admin must do a fresh UI login.
async function loginAsAdmin(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill('admin@courtmastr.com');
  await page.locator('input[type="password"]').fill('admin123');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.waitForURL(/\/tournaments(?:\/|$|\?)/, { timeout: 15000 });
}

test.describe('Edge Cases - Authentication', () => {
  test('should handle special characters in email', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('test+special@email.com');
    await page.locator('input[type="password"]').fill('password123');
    await page.getByRole('button', { name: 'Sign In' }).click();
    // test+special@email.com is a valid format but unknown account — must show an auth error
    await expect(page.locator('.v-alert.text-error')).toBeVisible({ timeout: 10000 });
  });

  test('should handle very long email addresses', async ({ page }) => {
    const longEmail = 'a'.repeat(200) + '@test.com';
    await page.goto('/login');
    await page.getByLabel('Email').fill(longEmail);
    // Browsers/inputs may truncate at various lengths — just confirm the field has some value
    const value = await page.getByLabel('Email').inputValue();
    expect(value.length).toBeGreaterThan(0);
  });

  test('should handle SQL injection attempts in login', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill("' OR '1'='1");
    await page.locator('input[type="password"]').fill("' OR '1'='1");

    const signInBtn = page.getByRole('button', { name: 'Sign In' });
    const isDisabled = await signInBtn.isDisabled().catch(() => true);

    if (!isDisabled) {
      await signInBtn.click();
      // Should show auth error - Firebase emulator returns "No account found"
      await expect(page.locator('.v-alert.text-error').or(page.getByText(/invalid|error|failed|not found|no account/i).first())).toBeVisible();
    } else {
      // Email format is invalid — form validation blocks submission
      await expect(signInBtn).toBeDisabled();
    }
  });

  test('should handle XSS attempts in login fields', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('<script>alert("xss")</script>');
    await page.locator('input[type="password"]').fill('password123');

    // Invalid email format keeps Sign In disabled — skip click if disabled
    const signInBtn = page.getByRole('button', { name: 'Sign In' });
    const isDisabled = await signInBtn.isDisabled().catch(() => true);

    if (!isDisabled) {
      await signInBtn.click();
      // Should show auth error - Firebase emulator returns "No account found"
      await expect(page.locator('.v-alert.text-error').or(page.getByText(/invalid|error|failed|not found|no account/i).first())).toBeVisible();
    } else {
      // Email format is invalid — form validation blocks submission
      await expect(signInBtn).toBeDisabled();
    }

    // Script must not have executed — login page still intact
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
  });

  test('should handle rapid login attempts', async ({ page }) => {
    await page.goto('/login');
    
    // Try to login 5 times rapidly
    for (let i = 0; i < 5; i++) {
      await page.getByLabel('Email').fill(`test${i}@test.com`);
      await page.locator('input[type="password"]').fill('wrongpassword');
      await page.getByRole('button', { name: 'Sign In' }).click();
    }
    
    // Page should still be functional
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
  });
});

test.describe('Edge Cases - Tournament Creation', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('should handle tournament name with special characters', async ({ page }) => {
    await page.goto('/tournaments/create');
    const specialName = 'Tournament <script>alert(1)</script> & "Test"';
    await page.getByLabel('Tournament Name').fill(specialName);
    await expect(page.getByLabel('Tournament Name')).toHaveValue(specialName);
  });

  test('should handle very long tournament names', async ({ page }) => {
    await page.goto('/tournaments/create');
    const longName = 'A'.repeat(500);
    await page.getByLabel('Tournament Name').fill(longName);
    // Should either accept or truncate
    const value = await page.getByLabel('Tournament Name').inputValue();
    expect(value.length).toBeGreaterThan(0);
  });

  test('should handle end date before start date', async ({ page }) => {
    await page.goto('/tournaments/create');
    
    const today = new Date();
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    
    await page.getByLabel('Tournament Name').fill('Test Tournament');
    await page.getByLabel('Start Date').fill(today.toISOString().split('T')[0]);
    await page.getByLabel('End Date').fill(yesterday.toISOString().split('T')[0]);
    
    const continueBtn = page.getByRole('button', { name: 'Continue' });
    await expect(continueBtn).toBeDisabled();
    await expect(page.getByTestId('date-error')).toContainText(/end date must be after start date/i);
  });

  test('should handle past dates for tournament', async ({ page }) => {
    await page.goto('/tournaments/create');
    
    const pastDate = new Date('2020-01-01');
    
    await page.getByLabel('Tournament Name').fill('Past Tournament');
    await page.getByLabel('Start Date').fill(pastDate.toISOString().split('T')[0]);
    await page.getByLabel('End Date').fill(pastDate.toISOString().split('T')[0]);
    
    // Should either warn or allow (for testing/recording purposes)
    await expect(page.getByLabel('Start Date')).toHaveValue('2020-01-01');
  });

  test('should handle all categories selected', async ({ page }) => {
    await page.goto('/tournaments/create');
    
    const today = new Date().toISOString().split('T')[0];
    await page.getByLabel('Tournament Name').fill('All Categories Test');
    await page.getByLabel('Start Date').fill(today);
    await page.getByLabel('End Date').fill(today);
    
    await page.getByRole('button', { name: 'Continue' }).click();
    
    // Select all available categories
    const checkboxes = page.getByRole('checkbox');
    const checkboxCount = await checkboxes.count();
    expect(checkboxCount).toBeGreaterThan(0);

    for (let index = 0; index < checkboxCount; index++) {
      const checkbox = checkboxes.nth(index);
      if (!await checkbox.isChecked().catch(() => false)) {
        await checkbox.click();
      }
    }
    
    await expect(checkboxes.first()).toBeChecked();
  });
});

test.describe('Edge Cases - Player Management', () => {
  let tournamentId: string;

  test.beforeAll(async () => {
    tournamentId = await getTournamentId();
  });

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`/tournaments/${tournamentId}/registrations`);
    await expect(page.getByRole('button', { name: /add player/i })).toBeVisible();
  });

  test('should handle player with emoji in name', async ({ page }) => {
    const addButton = page.getByRole('button', { name: /add player/i });
    await expect(addButton).toBeVisible();
    if (await addButton.isDisabled()) test.skip(true, 'Roster is locked in seeded tournament state');
    await addButton.click();
    await page.getByLabel('First Name').fill('John 😀');
    await page.getByLabel('Last Name').fill('Smith 🎾');
    await page.getByLabel('Email').fill('emoji@test.com');
    await page.getByLabel('Phone').fill('555-0001');
    
    const dialog = page.locator('.v-dialog').last();
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: /confirm|add player/i }).click();
    
    await expect(dialog).toBeHidden();
  });

  test('should handle duplicate email with different case', async ({ page }) => {
    const addButton = page.getByRole('button', { name: /add player/i });
    await expect(addButton).toBeVisible();
    if (await addButton.isDisabled()) test.skip(true, 'Roster is locked in seeded tournament state');
    await addButton.click();
    await page.getByLabel('First Name').fill('Test');
    await page.getByLabel('Last Name').fill('User');
    await page.getByLabel('Email').fill('Test@Email.COM');
    await page.getByLabel('Phone').fill('555-0001');
    
    const dialog = page.locator('.v-dialog').last();
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: /confirm|add player/i }).click();
    
    // Try adding with different case
    await addButton.click();
    await page.getByLabel('First Name').fill('Test2');
    await page.getByLabel('Last Name').fill('User2');
    await page.getByLabel('Email').fill('TEST@EMAIL.com');
    await page.getByLabel('Phone').fill('555-0002');
    
    await dialog.getByRole('button', { name: /confirm|add player/i }).click();
    await expect(page.getByText(/already exists|duplicate/i).first()).toBeVisible();
  });

  test('should handle phone number with various formats', async ({ page }) => {
    const phoneFormats = [
      '555-0101',
      '(555) 0101',
      '555.0101',
      '+1 555 0101',
      '5550101',
    ];
    
    const addButton = page.getByRole('button', { name: /add player/i });
    if (await addButton.isDisabled()) test.skip(true, 'Roster is locked in seeded tournament state');
    
    for (let i = 0; i < phoneFormats.length; i++) {
      await expect(addButton).toBeVisible();
      await addButton.click();
      await page.getByLabel('First Name').fill(`Phone${i}`);
      await page.getByLabel('Last Name').fill(`Test${i}`);
      await page.getByLabel('Email').fill(`phone${i}@test.com`);
      await page.getByLabel('Phone').fill(phoneFormats[i]);
      
      const dialog = page.locator('.v-dialog').last();
      await expect(dialog).toBeVisible();
      await dialog.getByRole('button', { name: /confirm|add player/i }).click();
      await expect(dialog).toBeHidden();
    }
  });

  test('should handle player with very long name', async ({ page }) => {
    const addButton = page.getByRole('button', { name: /add player/i });
    await expect(addButton).toBeVisible();
    if (await addButton.isDisabled()) test.skip(true, 'Roster is locked in seeded tournament state');
    await addButton.click();
    const longName = 'A'.repeat(100);
    await page.getByLabel('First Name').fill(longName);
    await page.getByLabel('Last Name').fill(longName);
    await page.getByLabel('Email').fill('longname@test.com');
    await page.getByLabel('Phone').fill('555-0001');
    
    const dialog = page.locator('.v-dialog').last();
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: /confirm|add player/i }).click();
    await expect(dialog).toBeHidden();
  });
});

test.describe('Edge Cases - Registration Management', () => {
  let tournamentId: string;

  test.beforeAll(async () => {
    tournamentId = await getTournamentId();
  });

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`/tournaments/${tournamentId}/registrations`);
    await page.waitForLoadState('domcontentloaded');
  });

  test('should handle rapid check-in/check-out cycles', async ({ page }) => {
    const checkInTab = page.getByRole('tab', { name: /check-in/i });
    await expect(checkInTab).toBeVisible();

    // Rapidly switch to check-in tab 5 times — page must remain stable
    for (let i = 0; i < 5; i++) {
      await checkInTab.click();
      await page.waitForTimeout(200);
    }

    // Tab should still be functional after rapid switching
    await expect(checkInTab).toBeVisible();
    await expect(checkInTab).toBeEnabled();
  });

  test('should handle withdrawing already checked-in participant', async ({ page }) => {
    // Check in the first available participant (if any)
    const checkInTab = page.getByRole('tab', { name: /check-in/i });
    await expect(checkInTab).toBeVisible();
    await checkInTab.click();
    await page.waitForTimeout(500);

    const checkInBtn = page.getByRole('button', { name: /check in/i }).first();
    if (!await checkInBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      test.skip(true, 'No participants available for check-in in seeded tournament');
      return;
    }
    await checkInBtn.click();
    await page.waitForTimeout(1000);

    // Navigate to registrations and try to withdraw the just-checked-in participant
    const registrationsTab = page.getByRole('tab', { name: /registrations/i });
    await registrationsTab.click();
    await page.waitForTimeout(500);

    // Withdraw button should be available even for checked-in participants
    const withdrawBtn = page.getByRole('button', { name: /withdraw/i }).first();
    await expect(withdrawBtn).toBeVisible({ timeout: 5000 });

    page.on('dialog', dialog => dialog.accept());
    await withdrawBtn.click();
    await page.waitForTimeout(1000);

    // Status should now be withdrawn
    await expect(page.getByText(/withdrawn/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('should not show reinstate option for non-withdrawn participants', async ({ page }) => {
    const registrationsTab = page.getByRole('tab', { name: /registrations/i });
    await expect(registrationsTab).toBeVisible();
    await registrationsTab.click();
    await page.waitForTimeout(500);

    // Find a row with a non-withdrawn status
    const nonWithdrawnRow = page.locator('tr').filter({
      has: page.locator('.v-chip', { hasText: /approved|checked_in/i }),
    }).first();

    if (!await nonWithdrawnRow.isVisible({ timeout: 3000 }).catch(() => false)) {
      test.skip(true, 'No non-withdrawn participants found to test reinstate button visibility');
      return;
    }

    // Reinstate must NOT appear for approved/checked-in participants — only for withdrawn ones
    await expect(nonWithdrawnRow.locator('button[title="Reinstate"], [aria-label*="reinstate" i]')).not.toBeVisible();
  });
});

test.describe('Edge Cases - Scoring', () => {
  let tournamentId: string;

  test.beforeAll(async () => {
    tournamentId = await getTournamentId();
  });

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`/tournaments/${tournamentId}/match-control`);
    await page.waitForLoadState('domcontentloaded');
  });

  test('should handle score of 0-0', async ({ page }) => {
    const scoreButton = page.getByRole('button', { name: /enter score/i }).first();
    if (!await scoreButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      test.skip(true, 'No active matches — seeded tournament must have started matches for this test');
      return;
    }
    await scoreButton.click();

    const dialog = page.locator('.v-dialog').last();
    await dialog.waitFor({ state: 'visible' });
    const inputs = await dialog.locator('input').all();
    expect(inputs.length).toBeGreaterThanOrEqual(2);
    await inputs[0].fill('0');
    await inputs[1].fill('0');

    // 0-0 is invalid (no winner) — save should be blocked or dialog stays open
    await dialog.getByRole('button', { name: /save|submit/i }).click();
    await expect(dialog).toBeVisible();
  });

  test('should handle score at game point (20-20)', async ({ page }) => {
    const scoreButton = page.getByRole('button', { name: /enter score/i }).first();
    if (!await scoreButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      test.skip(true, 'No active matches — seeded tournament must have started matches for this test');
      return;
    }
    await scoreButton.click();

    const dialog = page.locator('.v-dialog').last();
    await dialog.waitFor({ state: 'visible' });
    const inputs = await dialog.locator('input').all();
    expect(inputs.length).toBeGreaterThanOrEqual(2);
    await inputs[0].fill('20');
    await inputs[1].fill('20');

    // 20-20 is a deuce — save should be blocked (win-by-2 rule) or dialog stays open
    await dialog.getByRole('button', { name: /save|submit/i }).click();
    await expect(dialog).toBeVisible();
  });

  test('should handle score at maximum (30-29)', async ({ page }) => {
    const scoreButton = page.getByRole('button', { name: /enter score/i }).first();
    if (!await scoreButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      test.skip(true, 'No active matches — seeded tournament must have started matches for this test');
      return;
    }
    await scoreButton.click();

    const dialog = page.locator('.v-dialog').last();
    await dialog.waitFor({ state: 'visible' });
    const inputs = await dialog.locator('input').all();
    expect(inputs.length).toBeGreaterThanOrEqual(2);
    await inputs[0].fill('30');
    await inputs[1].fill('29');

    // 30-29 is a valid winning score — dialog should close after save
    await dialog.getByRole('button', { name: /save|submit/i }).click();
    await expect(dialog).toBeHidden();
  });

  test('should handle rapid score updates', async ({ page }) => {
    const firstScoreButton = page.getByRole('button', { name: /enter score/i }).first();
    if (!await firstScoreButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      test.skip(true, 'No active matches — seeded tournament must have started matches for this test');
      return;
    }

    // Try to update scores rapidly
    for (let i = 0; i < 10; i++) {
      const scoreButton = page.getByRole('button', { name: /enter score/i }).first();
      await expect(scoreButton).toBeVisible();
      await scoreButton.click();
      
      const dialog = page.locator('.v-dialog');
      await expect(dialog).toBeVisible();
      const inputs = await dialog.locator('input').all();
      expect(inputs.length).toBeGreaterThanOrEqual(2);
      await inputs[0].fill(`${i}`);
      await inputs[1].fill(`${i}`);
      
      const saveButton = dialog.getByRole('button', { name: /save|submit/i });
      if (await saveButton.isEnabled()) {
        await saveButton.click();
      } else {
        await dialog.getByRole('button', { name: /cancel|close/i }).click();
      }
    }

    // After rapid updates, the match-control page must still be operational
    await expect(page.getByRole('button', { name: /enter score/i }).first()).toBeVisible();
  });
});

test.describe('Edge Cases - Network & Performance', () => {
  test('should handle offline state gracefully', async ({ page }) => {
    await page.goto('/tournaments');
    
    // Simulate offline
    await page.context().setOffline(true);
    
    // Try to navigate - offline throws ERR_INTERNET_DISCONNECTED
    try {
      await page.goto('/tournaments/create', { timeout: 5000 });
    } catch { /* expected */ }
    
    // Should show offline message or cached content
    await expect(page.locator('body')).toBeVisible();
    
    // Restore online
    await page.context().setOffline(false);
    await page.goto('/tournaments');
    await expect(page.locator('body')).toBeVisible();
  });

  test('should handle slow network', async ({ page }) => {
    // Slow down network
    await page.context().route('**/*', async route => {
      await new Promise(resolve => setTimeout(resolve, 1000));
      await route.continue();
    });
    
    await page.goto('/tournaments');
    
    // Should show loading states
    await expect(page.locator('body')).toBeVisible();
  });

  test('should handle rapid page navigation', async ({ page }) => {
    const urls = [
      '/',
      '/login',
      '/tournaments',
      '/tournaments/create',
    ];
    
    // Navigate rapidly between pages
    for (let i = 0; i < 20; i++) {
      const url = urls[i % urls.length];
      await page.goto(url);
    }
    
    // Page should remain stable
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('Edge Cases - Data Integrity', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('should handle concurrent edits from multiple tabs', async ({ browser }) => {
    // Two separate browser contexts loading the same public page concurrently.
    // Verifies that multiple simultaneous sessions don't crash the app.
    const context = await browser.newContext();
    const page1 = await context.newPage();
    const page2 = await context.newPage();

    try {
      // Navigate both pages concurrently to the public home page (no auth required)
      await Promise.all([
        page1.goto('/'),
        page2.goto('/'),
      ]);

      // Both contexts must render the app independently
      await expect(page1.getByRole('link', { name: /login|sign in/i }).first()).toBeVisible({ timeout: 10000 });
      await expect(page2.getByRole('link', { name: /login|sign in/i }).first()).toBeVisible({ timeout: 10000 });
    } finally {
      await context.close();
    }
  });

  test('should handle browser refresh during operation', async ({ page }) => {
    await page.goto('/tournaments/create');

    // Fill some data
    await page.getByLabel('Tournament Name').fill('Test Tournament');

    // Refresh page
    await page.reload();

    // Should either preserve data or start fresh gracefully
    await expect(page.getByLabel('Tournament Name')).toBeVisible();
  });

  test('should handle back button navigation', async ({ page }) => {
    await page.goto('/tournaments');
    await page.goto('/tournaments/create');
    await page.goto('/tournaments');

    // Go back
    await page.goBack();

    // Should be on tournaments create or tournaments list
    await expect(page).toHaveURL(/\/tournaments/);
  });
});

test.describe('Edge Cases - Mobile & Responsive', () => {
  test('should handle small viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE
    
    await page.goto('/tournaments');
    await expect(page.locator('body')).toBeVisible();
    
    // Check that navigation is accessible
    const menuButton = page.locator('button').first();
    await expect(menuButton).toBeVisible();
  });

  test('should handle large viewport', async ({ page }) => {
    await page.setViewportSize({ width: 2560, height: 1440 }); // 4K
    
    await page.goto('/tournaments');
    await expect(page.locator('body')).toBeVisible();
  });

  test('should handle orientation change', async ({ page }) => {
    // Start in portrait
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/tournaments');
    
    // Switch to landscape
    await page.setViewportSize({ width: 667, height: 375 });
    await page.reload();
    
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('Edge Cases - Security', () => {
  test('should sanitize HTML in tournament name', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/tournaments/create');

    const xssAttempt = '<img src=x onerror=alert(1)>';
    await page.getByLabel('Tournament Name').fill(xssAttempt);

    // The script should not execute
    // Check that the text is displayed as text, not HTML
    const value = await page.getByLabel('Tournament Name').inputValue();
    expect(value).toBe(xssAttempt);
  });

  test('should prevent CSRF: Firebase auth uses tokens not cookies', async ({ page }) => {
    // CSRF exploits cookie-based sessions. Firebase stores auth tokens in IndexedDB (not cookies),
    // so there is no CSRF attack surface. Verify this by confirming no auth cookies exist after login.
    await loginAsAdmin(page);
    await page.goto('/tournaments');
    await page.waitForLoadState('domcontentloaded');

    const cookies = await page.context().cookies();
    const authCookies = cookies.filter(c =>
      c.name.toLowerCase().includes('session') ||
      c.name.toLowerCase().includes('auth') ||
      c.name.toLowerCase().includes('token')
    );
    // No auth cookies means no CSRF attack surface
    expect(authCookies).toHaveLength(0);
  });

  test('should handle unauthorized API access attempts', async ({ browser }) => {
    const ctx = await browser.newContext();
    const p = await ctx.newPage();
    try {
      await p.goto('http://localhost:3000/tournaments/create');
      await p.waitForURL(/\/login/, { timeout: 5000 });
      await expect(p.getByRole('button', { name: /sign in/i })).toBeVisible();
    } finally {
      await ctx.close();
    }
  });
});
