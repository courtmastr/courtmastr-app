# Complete Test Case Inventory - Based on Actual Codebase Features

**Date**: February 10, 2026  
**Based on**: Actual Vue components and views in the codebase

---

## CURRENT TEST CASES (79 total)

### 1. Smoke Tests (3 tests) ✅
| # | Test | Feature |
|---|------|---------|
| 1 | Basic page load test | HomeView |
| 2 | Login page loads | LoginView |
| 3 | Tournaments page requires auth | Route Guard |

### 2. Tournament Lifecycle (17 tests) ⏸️
| # | Test | Feature | Status |
|---|------|---------|--------|
| 1 | Navigate to tournament list | TournamentListView | Needs auth |
| 2 | Create a new tournament | TournamentCreateView | Needs auth |
| 3 | Add players to tournament | RegistrationManagementView | Needs auth |
| 4 | Register players for category | RegistrationManagementView | Needs auth |
| 5 | Check in participants | RegistrationManagementView | Needs auth |
| 6 | Undo check-in | RegistrationManagementView | ✅ New feature |
| 7 | Withdraw and reinstate | RegistrationManagementView | ✅ New feature |
| 8 | Generate brackets | TournamentDashboardView | Needs auth |
| 9 | Navigate to match control | MatchControlView | Needs auth |
| 10 | Auto-schedule matches | MatchControlView | Needs auth |
| 11 | Assign courts to matches | MatchControlView | Needs auth |
| 12 | Check public bracket page | PublicBracketView | ✅ Public |
| 13 | Check public live scores | PublicLiveScoresView | ✅ Public |
| 14 | Enter match scores manually | ScoringInterfaceView | Needs auth |
| 15 | Complete tournament | TournamentDashboardView | Needs auth |
| 16 | Verify notifications | Notification system | Needs auth |
| 17 | Verify activity feed | ActivityFeed | Needs auth |

### 3. Negative Tests (19 tests) ⚠️
Covers: Auth validation, Tournament creation validation, Registration errors, Match control errors, Public page 404s, Access control

### 4. Edge Cases (40 tests) ⚠️
Covers: Auth edge cases, Input validation, Network conditions, Security, Mobile responsive

---

## MISSING TEST CASES - Based on Actual Features in Codebase

### A. Tournament Settings (NOT COVERED)
**File**: `TournamentSettingsView.vue`
**Features**:
- [ ] Update tournament basic info (name, description, location, dates)
- [ ] Change tournament status (draft → registration → active → completed)
- [ ] Update scoring settings (games per match, points to win, must win by, max points)
- [ ] Apply scoring presets (Badminton Standard, Badminton Casual, Table Tennis)
- [ ] Update registration settings (allow self-registration, require approval)
- [ ] Delete tournament

### B. Category Management (NOT COVERED)
**File**: `CategoryManagement.vue`
**Features**:
- [ ] Add new category to existing tournament
- [ ] Edit category details (name, type, gender, age group, format)
- [ ] Set max participants per category
- [ ] Set minimum games guaranteed
- [ ] Enable/disable seeding for category
- [ ] Delete category

### C. Court Management (NOT COVERED)
**File**: `CourtManagement.vue`
**Features**:
- [ ] Add new court to tournament
- [ ] Edit court name and number
- [ ] Change court status (available, in_use, maintenance)
- [ ] Delete court
- [ ] View court status board

### D. Seeding Management (NOT COVERED)
**File**: `TournamentDashboardView.vue` (seeding dialog)
**Features**:
- [ ] Open seeding dialog for category
- [ ] Assign seed numbers to participants
- [ ] Auto-seed participants (randomize)
- [ ] Save seeding configuration
- [ ] View seeded bracket

### E. Export/Import (NOT COVERED)
**Files**: 
- `ExportScheduleDialog.vue`
- `RegistrationManagementView.vue` (import)
**Features**:
- [ ] Export schedule to PDF
- [ ] Export schedule to CSV
- [ ] Export schedule to Excel
- [ ] Import players from CSV
- [ ] Preview import data
- [ ] Handle import errors

### F. Search & Filter (NOT COVERED)
**Files**:
- `GlobalSearch.vue`
- `RegistrationManagementView.vue`
- `MatchControlView.vue`
**Features**:
- [ ] Global search across tournaments
- [ ] Filter registrations by category
- [ ] Filter registrations by status
- [ ] Search registrations by name
- [ ] Filter matches by category
- [ ] Filter matches by status
- [ ] Filter matches by court
- [ ] Search matches by participant name

### G. Match Control Advanced (NOT COVERED)
**File**: `MatchControlView.vue`
**Features**:
- [ ] View match queue (ready, scheduled, pending)
- [ ] View active matches
- [ ] View completed matches
- [ ] Manual court assignment
- [ ] Auto court assignment
- [ ] Start match from queue
- [ ] Mark match as ready
- [ ] Schedule match with specific time
- [ ] Reset schedule for category
- [ ] Handle match delay
- [ ] Assign walkover
- [ ] View match history log
- [ ] View match stats dashboard

### H. Scoring Interface (NOT COVERED)
**File**: `ScoringInterfaceView.vue`
**Features**:
- [ ] Start match
- [ ] Increment/decrement score
- [ ] Complete game
- [ ] Undo last action
- [ ] View match history
- [ ] Complete match
- [ ] View court name and category

### I. Tournament List & Archive (NOT COVERED)
**File**: `TournamentListView.vue`
**Features**:
- [ ] View active tournaments
- [ ] View archived tournaments
- [ ] Search tournaments
- [ ] Filter tournaments by status
- [ ] Navigate to tournament

### J. Real-time Features (NOT COVERED)
**Files**: Multiple components with Firestore listeners
**Features**:
- [ ] Real-time match score updates
- [ ] Real-time bracket updates
- [ ] Real-time activity feed updates
- [ ] Real-time court status updates
- [ ] Real-time registration updates

### K. Self Registration (NOT COVERED)
**File**: `SelfRegistrationView.vue`
**Features**:
- [ ] Player self-registration flow
- [ ] Select multiple categories
- [ ] Add partner for doubles
- [ ] Submit registration

### L. Public Views (PARTIALLY COVERED)
**Files**: 
- `PublicBracketView.vue` ✅
- `PublicLiveScoresView.vue` ✅
- `PublicScoringView.vue` ❌
**Missing**:
- [ ] Public scoring interface
- [ ] Public match list

---

## PRIORITY MATRIX

### P0 - Critical (Must Have)
1. Tournament Settings update
2. Category Management (add/edit/delete)
3. Court Management (add/edit/delete)
4. Seeding Management
5. Search & Filter (registrations, matches)

### P1 - Important (Should Have)
6. Export Schedule
7. Import Players CSV
8. Match Control advanced features
9. Scoring Interface detailed tests
10. Real-time updates verification

### P2 - Nice to Have (Could Have)
11. Tournament Archive
12. Self Registration flow
13. Public Scoring interface
14. Match statistics dashboard

---

## RECOMMENDED NEXT STEPS

1. **Add P0 tests** (Settings, Category, Court, Seeding, Search)
2. **Enable blocked tests** by creating test data factory
3. **Add P1 tests** for Import/Export
4. **Verify real-time features** work correctly

**Total Missing**: ~50+ test cases for complete coverage
