# Bug Report: E2E Test Failures & Issues

**Report Date**: February 6, 2026
**Status**: Active - Awaiting Fixes

---

## Summary

During comprehensive E2E testing of the CourtMastr application, several issues were identified across authentication, tournament management, and testing infrastructure. This report documents all findings with severity levels and recommended fixes.

---

## Test Coverage Overview

### Tests Created
1. **smoke.spec.ts** (3 tests) - Basic functionality
2. **tournament-lifecycle.spec.ts** (17 tests) - Full user journey
3. **negative-tests.spec.ts** (19 tests) - Error handling
4. **edge-cases.spec.ts** (40+ tests) - Boundary conditions

### Current Test Status
- ✅ Smoke tests: **3/3 passing**
- ⚠️ Auth setup: **Failing** (requires test user seeding)
- ⚠️ Tournament lifecycle: **Blocked** (depends on auth)
- ⚠️ Negative tests: **Partially blocked** (depends on auth)

---

## Bug #1: Auth Setup Tests Failing - Missing Test Users

**Severity**: HIGH  
**Component**: Testing Infrastructure  
**Status**: Open

### Description
The Playwright auth setup tests fail because the admin@courtmaster.local and scorekeeper@courtmaster.local users don't exist in the Firebase emulator.

### Error Message
```
TimeoutError: page.waitForURL: Timeout 10000ms exceeded.
waiting for navigation to "/tournaments" until "load"
```

### Steps to Reproduce
1. Start Firebase emulators: `npm run emulators`
2. Start dev server: `npm run dev`
3. Run auth setup: `npx playwright test e2e/auth.setup.ts --project=setup`

### Expected Behavior
Test users should be automatically created in the emulator before tests run.

### Actual Behavior
Login fails because users don't exist.

### Fix Required
Create a test data seeding script that runs before E2E tests:

```typescript
// scripts/seed-test-users.ts
import { auth, db } from '../src/services/firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';

const testUsers = [
  {
    email: 'admin@courtmaster.local',
    password: 'admin123',
    role: 'admin',
    displayName: 'Admin User'
  },
  {
    email: 'scorekeeper@courtmaster.local',
    password: 'score123',
    role: 'scorekeeper',
    displayName: 'Scorekeeper User'
  }
];

async function seedTestUsers() {
  for (const user of testUsers) {
    try {
      const { user: firebaseUser } = await createUserWithEmailAndPassword(
        auth,
        user.email,
        user.password
      );
      
      await setDoc(doc(db, 'users', firebaseUser.uid), {
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      console.log(`✓ Created user: ${user.email}`);
    } catch (error) {
      console.error(`✗ Failed to create user ${user.email}:`, error);
    }
  }
}

seedTestUsers();
```

### Workaround
Manually create users through the UI before running tests.

---

## Bug #2: Password Field Selector Conflict

**Severity**: MEDIUM  
**Component**: E2E Tests  
**Status**: Fixed

### Description
The password field selector `getByLabel('Password')` matches both the input field and the visibility toggle button, causing strict mode violations.

### Error Message
```
Error: strict mode violation: getByLabel('Password') resolved to 2 elements:
  1) <input type="password" ...>
  2) <i role="button" aria-label="Password appended action" ...>
```

### Fix Applied
Changed selector from:
```typescript
await page.getByLabel('Password').fill('admin123');
```

To:
```typescript
await page.locator('input[type="password"]').fill('admin123');
```

### Files Updated
- `e2e/auth.setup.ts`
- `e2e/negative-tests.spec.ts`

---

## Bug #3: "Tournaments" Text Matcher Too Broad

**Severity**: LOW  
**Component**: E2E Tests  
**Status**: Fixed

### Description
The text matcher `getByText('Tournaments')` matches multiple elements on the page (heading, navigation, empty state).

### Error Message
```
Error: strict mode violation: getByText('Tournaments') resolved to 4 elements
```

### Fix Applied
Changed from:
```typescript
await expect(page.getByText('Tournaments')).toBeVisible();
```

To:
```typescript
await expect(page.getByRole('heading', { name: 'Tournaments' })).toBeVisible();
```

---

## Bug #4: Missing Data-TestId Attributes

**Severity**: MEDIUM  
**Component**: UI Components  
**Status**: Open

### Description
Many interactive elements lack `data-testid` attributes, making E2E tests brittle and dependent on text content that may change.

### Affected Components
- Login form inputs
- Tournament creation wizard steps
- Registration management buttons
- Match control actions
- Scoring interface controls

### Recommended Fix
Add `data-testid` attributes to key elements:

```vue
<!-- LoginView.vue -->
<v-text-field
  v-model="email"
  data-testid="login-email"
  label="Email"
  type="email"
/>

<v-text-field
  v-model="password"
  data-testid="login-password"
  label="Password"
  type="password"
/>

<v-btn
  data-testid="login-submit"
  type="submit"
>
  Sign In
</v-btn>
```

---

## Bug #5: No Input Validation on Tournament Dates

**Severity**: MEDIUM  
**Component**: Tournament Creation  
**Status**: Open (Needs Verification)

### Description
The tournament creation form may allow invalid date combinations (end date before start date, past dates).

### Test Case
```typescript
// edge-cases.spec.ts
test('should handle end date before start date', async ({ page }) => {
  await page.goto('/tournaments/create');
  
  const today = new Date();
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  
  await page.getByLabel('Tournament Name').fill('Test Tournament');
  await page.getByLabel('Start Date').fill(today.toISOString().split('T')[0]);
  await page.getByLabel('End Date').fill(yesterday.toISOString().split('T')[0]);
  
  // Should show validation error
  await expect(page.getByText(/invalid|error/i)).toBeVisible();
});
```

### Expected Behavior
Form should validate dates and show error messages.

### Actual Behavior
Unknown - needs verification.

---

## Bug #6: No Duplicate Email Validation

**Severity**: MEDIUM  
**Component**: Player Management  
**Status**: Open (Needs Verification)

### Description
The system may allow duplicate player registrations with the same email address.

### Test Case
```typescript
test('should not allow duplicate player registration', async ({ page }) => {
  await registrationPage.addPlayer('John', 'Doe', 'john@example.com', '555-0101');
  await registrationPage.addPlayer('John', 'Doe', 'john@example.com', '555-0101');
  
  // Should show error
  await expect(page.getByText(/error|already exists/i)).toBeVisible();
});
```

---

## Bug #7: Missing XSS Protection Tests

**Severity**: HIGH  
**Component**: Security  
**Status**: Open (Needs Verification)

### Description
Need to verify that user inputs are properly sanitized to prevent XSS attacks.

### Test Cases Needed
1. Tournament name with `<script>` tags
2. Player names with HTML entities
3. Description fields with JavaScript

### Test Case
```typescript
test('should sanitize HTML in tournament name', async ({ page }) => {
  await page.goto('/tournaments/create');
  
  const xssAttempt = '<img src=x onerror=alert(1)>';
  await page.getByLabel('Tournament Name').fill(xssAttempt);
  
  // Script should not execute
  await page.getByRole('button', { name: 'Continue' }).click();
  
  // Check that text is displayed as text, not HTML
  const displayText = await page.locator('.tournament-name').textContent();
  expect(displayText).toBe(xssAttempt); // Should be text, not executed
});
```

---

## Bug #8: No Offline Handling

**Severity**: LOW  
**Component**: PWA / Network  
**Status**: Open

### Description
The application doesn't gracefully handle offline states.

### Test Case
```typescript
test('should handle offline state gracefully', async ({ page }) => {
  await page.goto('/tournaments');
  await page.context().setOffline(true);
  
  await page.goto('/tournaments/create');
  
  // Should show offline message
  await expect(page.getByText(/offline|no connection/i)).toBeVisible();
});
```

---

## Bug #9: Missing Loading States

**Severity**: LOW  
**Component**: UI/UX  
**Status**: Open

### Description
Slow network conditions don't show appropriate loading indicators.

### Test Case
```typescript
test('should show loading states on slow network', async ({ page }) => {
  await page.context().route('**/*', async route => {
    await new Promise(resolve => setTimeout(resolve, 2000));
    await route.continue();
  });
  
  await page.goto('/tournaments');
  
  // Should show loading indicator
  await expect(page.locator('.v-progress-linear, .v-skeleton-loader')).toBeVisible();
});
```

---

## Bug #10: Auth State Persistence Issues

**Severity**: HIGH  
**Component**: Authentication  
**Status**: Open (Needs Investigation)

### Description
After login, the auth state may not persist correctly across page refreshes.

### Test Case
```typescript
test('should persist auth after refresh', async ({ page }) => {
  // Login
  await page.goto('/login');
  await page.fill('input[type="email"]', 'admin@courtmaster.local');
  await page.fill('input[type="password"]', 'admin123');
  await page.click('button[type="submit"]');
  await page.waitForURL('/tournaments');
  
  // Refresh
  await page.reload();
  
  // Should still be logged in
  await expect(page).toHaveURL('/tournaments');
});
```

---

## Priority Matrix

| Bug | Severity | Effort | Priority |
|-----|----------|--------|----------|
| #1 - Missing Test Users | HIGH | LOW | P0 |
| #7 - XSS Protection | HIGH | MEDIUM | P0 |
| #10 - Auth Persistence | HIGH | MEDIUM | P0 |
| #4 - Missing Test IDs | MEDIUM | LOW | P1 |
| #5 - Date Validation | MEDIUM | LOW | P1 |
| #6 - Duplicate Email | MEDIUM | LOW | P1 |
| #2 - Password Selector | MEDIUM | LOW | Fixed |
| #3 - Text Matcher | LOW | LOW | Fixed |
| #8 - Offline Handling | LOW | HIGH | P2 |
| #9 - Loading States | LOW | MEDIUM | P2 |

---

## Recommended Fix Order

### Phase 1 (Critical - This Week)
1. Fix Bug #1: Create test user seeding script
2. Fix Bug #10: Investigate auth persistence
3. Fix Bug #7: Add XSS protection and tests

### Phase 2 (Important - Next Week)
4. Fix Bug #4: Add data-testid attributes
5. Fix Bug #5: Add date validation
6. Fix Bug #6: Add duplicate email validation

### Phase 3 (Nice to Have - Future)
7. Fix Bug #8: Add offline handling
8. Fix Bug #9: Add loading states

---

## Files to Review

### Critical
- `src/features/auth/views/LoginView.vue`
- `src/stores/auth.ts`
- `src/services/firebase.ts`

### Important
- `src/features/tournaments/views/TournamentCreateView.vue`
- `src/features/registration/views/RegistrationManagementView.vue`
- `src/features/scoring/views/ScoringInterfaceView.vue`

### Testing
- `e2e/auth.setup.ts`
- `scripts/seed-emulator.ts`
- `playwright.config.ts`

---

## Next Steps

1. **Immediate**: Create test user seeding script (Bug #1)
2. **Today**: Verify XSS protection (Bug #7)
3. **This Week**: Add data-testid attributes (Bug #4)
4. **Next Week**: Implement validation improvements (Bugs #5, #6)

---

**Report Generated By**: OpenCode Agent  
**Test Run Date**: 2026-02-06  
**Total Tests**: 80+  
**Passing**: 3  
**Blocked**: 77 (due to auth issues)
