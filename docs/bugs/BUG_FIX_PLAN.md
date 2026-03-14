# Bug Fix Plan - CourtMastr E2E Issues

**Created**: February 6, 2026  
**Priority**: P0 (Critical) → P2 (Low)

---

## Executive Summary

We've created a comprehensive E2E test suite with **80+ tests** covering:
- Smoke tests (3 tests) ✅
- Tournament lifecycle (17 tests)
- Negative tests (19 tests)
- Edge cases (40+ tests)

**Current Status**: Only 3 tests passing due to auth infrastructure issues.

---

## Critical Issues (Fix This Week)

### 🔴 Bug #1: Missing Test Users in Firebase Emulator

**Impact**: Blocks 77+ tests  
**Effort**: 2 hours  
**Owner**: TBD

#### Problem
E2E tests can't login because test users don't exist in the Firebase emulator.

#### Solution
Create a test data seeding script:

```typescript
// scripts/seed-test-users.ts
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, setDoc } from 'firebase/firestore';

const firebaseConfig = {
  // emulator config
  projectId: 'demo-courtmaster',
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const testUsers = [
  { email: 'admin@courtmaster.local', password: 'admin123', role: 'admin', displayName: 'Admin' },
  { email: 'scorekeeper@courtmaster.local', password: 'score123', role: 'scorekeeper', displayName: 'Scorekeeper' },
];

async function seed() {
  for (const user of testUsers) {
    try {
      const { user: fbUser } = await createUserWithEmailAndPassword(auth, user.email, user.password);
      await setDoc(doc(db, 'users', fbUser.uid), {
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        createdAt: new Date(),
      });
      console.log(`✓ Created ${user.email}`);
    } catch (e) {
      console.log(`✗ ${user.email}: ${e.message}`);
    }
  }
}

seed();
```

#### Action Items
- [ ] Create `scripts/seed-test-users.ts`
- [ ] Add to playwright.config.ts webServer setup
- [ ] Test auth setup passes

---

### 🔴 Bug #7: XSS Protection Verification

**Impact**: Security risk  
**Effort**: 4 hours  
**Owner**: TBD

#### Problem
Need to verify user inputs are properly sanitized.

#### Solution
1. Test XSS attempts in all input fields
2. Verify Vue's auto-escaping works
3. Add CSP headers if missing

#### Action Items
- [ ] Run XSS test cases
- [ ] Verify no script execution
- [ ] Document security measures

---

### 🔴 Bug #10: Auth State Persistence

**Impact**: User experience  
**Effort**: 4 hours  
**Owner**: TBD

#### Problem
Auth state may not persist across page refreshes.

#### Solution
1. Check Firebase Auth persistence setting
2. Verify localStorage/sessionStorage usage
3. Test refresh scenarios

#### Action Items
- [ ] Investigate auth persistence
- [ ] Add persistence tests
- [ ] Fix if broken

---

## Important Issues (Fix Next Week)

### 🟡 Bug #4: Missing data-testid Attributes

**Impact**: Test brittleness  
**Effort**: 8 hours  
**Owner**: TBD

#### Components to Update
- [ ] LoginView.vue
- [ ] TournamentCreateView.vue
- [ ] RegistrationManagementView.vue
- [ ] MatchControlView.vue
- [ ] ScoringInterfaceView.vue

#### Example
```vue
<v-text-field
  v-model="email"
  data-testid="login-email"
  label="Email"
/>
```

---

### 🟡 Bug #5: Date Validation Missing

**Impact**: Data integrity  
**Effort**: 2 hours  
**Owner**: TBD

#### Validation Rules Needed
- [ ] End date must be after start date
- [ ] Start date should be in future (or warn)
- [ ] Registration deadline before start date

---

### 🟡 Bug #6: Duplicate Email Validation

**Impact**: Data integrity  
**Effort**: 2 hours  
**Owner**: TBD

#### Solution
Add unique constraint on email field in player creation.

---

## Fixed Issues ✅

### ✅ Bug #2: Password Field Selector
**Fixed**: Changed to `input[type="password"]`

### ✅ Bug #3: Text Matcher Too Broad
**Fixed**: Changed to `getByRole('heading')`

---

## Test Coverage Matrix

| Feature | Smoke | Lifecycle | Negative | Edge | Total |
|---------|-------|-----------|----------|------|-------|
| Authentication | 2 | 0 | 4 | 5 | 11 |
| Tournament Creation | 0 | 1 | 4 | 5 | 10 |
| Player Management | 0 | 2 | 3 | 4 | 9 |
| Registration | 0 | 3 | 3 | 3 | 9 |
| Brackets | 0 | 1 | 0 | 2 | 3 |
| Scoring | 0 | 2 | 3 | 4 | 9 |
| Match Control | 0 | 2 | 2 | 3 | 7 |
| Public Pages | 1 | 2 | 3 | 3 | 9 |
| Access Control | 0 | 0 | 2 | 2 | 4 |
| Network/Performance | 0 | 0 | 0 | 4 | 4 |
| Security | 0 | 0 | 0 | 3 | 3 |
| **TOTAL** | **3** | **17** | **19** | **40** | **79** |

---

## Implementation Timeline

### Week 1 (Feb 6-12)
- [ ] Day 1-2: Fix Bug #1 (Test Users)
- [ ] Day 3: Verify Bug #7 (XSS)
- [ ] Day 4-5: Investigate Bug #10 (Auth Persistence)

### Week 2 (Feb 13-19)
- [ ] Day 1-3: Fix Bug #4 (data-testid)
- [ ] Day 4: Fix Bug #5 (Date Validation)
- [ ] Day 5: Fix Bug #6 (Duplicate Email)

### Week 3 (Feb 20-26)
- [ ] Day 1-2: Fix Bug #8 (Offline)
- [ ] Day 3-4: Fix Bug #9 (Loading States)
- [ ] Day 5: Full test suite run

---

## Success Criteria

- [ ] All 79 tests passing
- [ ] Test execution time < 10 minutes
- [ ] No flaky tests
- [ ] CI/CD integration complete

---

## Resources Needed

- 1 Backend Developer (Firebase/Auth)
- 1 Frontend Developer (Vue/Vuetify)
- 1 QA Engineer (Test validation)
- ~40 hours total effort

---

## Questions?

Contact the development team or review the detailed bug report:
`docs/bugs/E2E_TEST_BUGS.md`
