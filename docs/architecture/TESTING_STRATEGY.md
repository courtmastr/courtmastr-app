# Courtmaster Migration Testing Strategy

**Document Version:** 1.0
**Created:** February 1, 2026
**Status:** Ready for Implementation

---

## Overview

This document defines specific test cases for each phase of the data model migration. All tests should be run in the Firebase emulator environment before deploying to production.

---

## Pre-Migration Baseline Tests

Before starting migration, verify the current system state:

| Test | Command/Action | Expected Result |
|------|----------------|-----------------|
| Emulator starts | `firebase emulators:start` | All services running |
| Client connects | Open app in browser | No console errors |
| Can create tournament | Create new tournament | Tournament appears in Firestore |

---

## Phase 1: Critical Fixes

### Step 1.1: Unify ID Types

**Goal:** Ensure client-side bracket generation uses STRING IDs (matching server adapter)

#### Test 1.1.1: Client Bracket Generation with String IDs
```
SETUP:
1. Create tournament with category
2. Add 4 registrations (approved status)

ACTION:
1. Generate bracket using client-side useBracketGenerator

VERIFY:
- Open Firestore emulator UI
- Check /tournaments/{id}/match documents
- All `id` fields should be STRINGS (e.g., "0", "1", "2")
- All `stage_id`, `round_id`, `group_id` should be STRINGS
- opponent1.id and opponent2.id should be NUMBERS (seeding positions)

PASS CRITERIA:
- No numeric document IDs
- stage_id: "0" not stage_id: 0
```

#### Test 1.1.2: Client Generation + Server Update Compatibility
```
SETUP:
1. Generate bracket client-side (from Test 1.1.1)
2. Have a match ready to score

ACTION:
1. Start match (client - writes to /match_scores)
2. Complete match with scores (client - calls updateMatch CF)

VERIFY:
- updateMatch CF logs show winner ID matched correctly
- No "Winner ID did not match" warnings in CF logs
- Bracket advances to next round

PASS CRITERIA:
- Winner advances to next match
- No ID mismatch errors in logs
```

#### Test 1.1.3: ID Comparison Edge Cases
```
SETUP:
1. Generate bracket with 8+ players (creates multiple rounds)

ACTION:
1. Complete Round 1 Match 1 (winner = participant with lowest seed)
2. Complete Round 1 Match 2 (winner = participant with highest seed)

VERIFY:
- Both winners advance correctly
- IDs match regardless of numeric value

PASS CRITERIA:
- All bracket progressions work
- No silent failures
```

---

### Step 1.2: Fix advanceWinner Cloud Function

**Goal:** advanceWinner reads from `/match` instead of `/matches`

#### Test 1.2.1: Basic Winner Advancement
```
SETUP:
1. Generate bracket
2. Complete a match (sets winnerId)

ACTION:
1. Call advanceWinner CF with tournamentId, matchId, winnerId

VERIFY:
- CF reads from /match collection (check logs)
- Winner appears in next match's opponent slot
- No reads from /matches collection

PASS CRITERIA:
- Next match has winner in correct slot
- CF logs show /match reads, NOT /matches
```

#### Test 1.2.2: Double Elimination Loser Advancement
```
SETUP:
1. Create category with double_elimination format
2. Generate bracket
3. Complete a winners bracket match

ACTION:
1. Call advanceWinner CF

VERIFY:
- Winner advances in winners bracket
- Loser advances to losers bracket
- Both use /match collection

PASS CRITERIA:
- Both winner and loser placed correctly
- Losers bracket populated
```

#### Test 1.2.3: Grand Finals Handling
```
SETUP:
1. Double elimination bracket nearly complete
2. One match remaining (Grand Finals)

ACTION:
1. Complete semifinal matches
2. Verify grand finals participants

VERIFY:
- Grand finals has correct participants
- Reset bracket scenario works (if applicable)

PASS CRITERIA:
- Grand finals matchup is correct
```

---

### Step 1.3: Fix generateSchedule Cloud Function

**Goal:** generateSchedule reads from `/match` and writes to `/match_scores`

#### Test 1.3.1: Basic Schedule Generation
```
SETUP:
1. Generate bracket with 8 players
2. Create 2 courts
3. Matches are in status 0/1/2 (unplayed)

ACTION:
1. Call generateSchedule CF with tournamentId

VERIFY:
- CF reads from /match (check logs)
- CF writes to /match_scores (NOT /matches)
- Each match_scores document has: courtId, scheduledTime

PASS CRITERIA:
- /match_scores documents have scheduling data
- /matches collection NOT created/updated
- Courts assigned correctly
```

#### Test 1.3.2: Schedule Respects Match Dependencies
```
SETUP:
1. Bracket with Round 1 and Round 2 matches
2. Round 2 depends on Round 1 winners

ACTION:
1. Generate schedule

VERIFY:
- Round 1 matches scheduled first
- Round 2 matches not scheduled (no participants yet)
- OR Round 2 scheduled after Round 1 end times

PASS CRITERIA:
- Schedule respects bracket flow
```

#### Test 1.3.3: Client + Server Scheduling Alignment
```
SETUP:
1. Generate schedule using CF (generateSchedule)

ACTION:
1. Open app and view scheduled matches
2. Check useMatchScheduler reads the data correctly

VERIFY:
- UI shows scheduled times and courts
- Data comes from /match_scores (not /matches)
- Real-time updates work

PASS CRITERIA:
- UI displays scheduling from /match_scores
- Client and server aligned
```

---

## Phase 2: Data Consolidation

### Step 2.1: Audit /matches References

#### Test 2.1.1: Code Search Verification
```
ACTION:
1. Run: grep -r "collection('matches')" --include="*.ts" .
2. Run: grep -r "collection.*matches" --include="*.ts" .
3. Run: grep -r "/matches" --include="*.ts" .

VERIFY:
- Zero results (excluding docs/comments)
- All references removed or updated

PASS CRITERIA:
- No functional code references /matches
```

#### Test 2.1.2: Runtime Verification
```
SETUP:
1. Enable Firestore debug logging
2. Run full app workflow

ACTION:
1. Create tournament
2. Generate bracket
3. Schedule matches
4. Complete 3 matches
5. Check final standings

VERIFY:
- No Firestore operations on /matches collection
- All operations use /match or /match_scores

PASS CRITERIA:
- Zero /matches reads or writes in logs
```

---

### Step 2.2: Standardize Status Handling

#### Test 2.2.1: Status Source of Truth
```
SETUP:
1. Match exists in /match (status: 2 = ready)
2. Match has /match_scores document (status: "in_progress")

ACTION:
1. Load match in UI

VERIFY:
- UI shows "in_progress" (from /match_scores)
- NOT "ready" (from /match)

PASS CRITERIA:
- /match_scores.status takes precedence
```

#### Test 2.2.2: Status Updates Flow Correctly
```
ACTION:
1. Start match → status becomes "in_progress"
2. Complete match → status becomes "completed"

VERIFY:
- /match_scores.status updates
- UI reflects changes in real-time
- brackets-manager /match.status updates for progression

PASS CRITERIA:
- Both collections update appropriately
- UI shows correct status
```

---

### Step 2.3: Verify Real-Time Subscriptions

#### Test 2.3.1: Score Updates Propagate
```
SETUP:
1. Open match in two browser tabs
2. One tab is scorer, one is viewer

ACTION:
1. Scorer updates score

VERIFY:
- Viewer tab shows update within 2 seconds
- No page refresh required

PASS CRITERIA:
- Real-time sync works
```

#### Test 2.3.2: Public View Updates
```
SETUP:
1. Open public bracket view
2. Have admin complete a match

ACTION:
1. Complete match in admin view

VERIFY:
- Public view updates automatically
- Bracket progression visible

PASS CRITERIA:
- Public views have real-time updates
```

---

## Phase 3: Cleanup

### Step 3.1: Remove /matches Collection

#### Test 3.1.1: App Functions Without /matches
```
SETUP:
1. Ensure /matches collection doesn't exist
2. Fresh emulator with no data

ACTION:
1. Complete full tournament workflow:
   - Create tournament
   - Add categories
   - Register players
   - Generate brackets
   - Schedule matches
   - Score all matches
   - View final standings

VERIFY:
- All features work
- No errors related to /matches

PASS CRITERIA:
- Complete workflow succeeds
- No references to /matches in errors
```

---

### Step 3.2: Consolidate Adapters

#### Test 3.2.1: Client and Server Generate Identical Data
```
ACTION:
1. Generate bracket client-side for category A
2. Generate bracket server-side for category B
3. Compare document structures

VERIFY:
- Same ID formats (strings)
- Same field structures
- Same nested object formats

PASS CRITERIA:
- Documents are structurally identical
```

---

## Integration Tests

### Full Tournament Flow
```
SCENARIO: 16-player single elimination tournament

1. Create tournament with 2 categories
2. Register 16 players per category (32 total)
3. Generate brackets for both categories
4. Schedule all matches
5. Complete all matches with scores
6. Verify final standings

DURATION: ~30 minutes manual, ~5 minutes automated
PASS CRITERIA: No errors, correct winners
```

### Concurrent Scoring
```
SCENARIO: Multiple scorers on different matches

1. Create tournament with 8 matches ready
2. Open 4 different scoring sessions
3. Score matches simultaneously

DURATION: ~10 minutes
PASS CRITERIA: No data conflicts, all scores saved
```

---

## Load Tests

### Large Tournament
```
SCENARIO: 128-player double elimination

1. Generate bracket (creates 200+ matches)
2. Verify batch writes succeed
3. Load bracket view
4. Check UI performance

PASS CRITERIA:
- Bracket generates without timeout
- UI loads within 5 seconds
- No Firestore query limit errors
```

### Rapid Score Updates
```
SCENARIO: Simulate active tournament

1. 10 concurrent users updating scores
2. 50 score updates per minute
3. Run for 5 minutes

PASS CRITERIA:
- All updates persisted
- No race conditions
- Real-time sync maintains accuracy
```

---

## Test Environment Setup

### Firebase Emulator Configuration
```bash
# Start emulators
firebase emulators:start

# Emulator UI: http://localhost:4000
# Firestore: http://localhost:8080
# Functions: http://localhost:5001
```

### Test Data Scripts
```bash
# Seed test data (if available)
npm run seed:test

# Clear emulator data
firebase emulators:start --import=./test-data --export-on-exit
```

---

## Test Sign-Off Checklist

### Phase 1 Sign-Off
- [ ] Test 1.1.1 passed - Client IDs are strings
- [ ] Test 1.1.2 passed - Client/Server compatibility
- [ ] Test 1.2.1 passed - advanceWinner uses /match
- [ ] Test 1.2.2 passed - Double elimination works
- [ ] Test 1.3.1 passed - generateSchedule uses correct collections
- [ ] Test 1.3.3 passed - Client/Server scheduling aligned

**Phase 1 Approved By:** _______________ **Date:** _______________

### Phase 2 Sign-Off
- [ ] Test 2.1.1 passed - No /matches references in code
- [ ] Test 2.1.2 passed - No /matches operations at runtime
- [ ] Test 2.2.1 passed - Status source of truth correct
- [ ] Test 2.3.1 passed - Real-time updates work

**Phase 2 Approved By:** _______________ **Date:** _______________

### Phase 3 Sign-Off
- [ ] Test 3.1.1 passed - App works without /matches
- [ ] Test 3.2.1 passed - Adapters produce identical data
- [ ] Integration test passed - Full tournament flow
- [ ] Load test passed - 128 players, rapid updates

**Phase 3 Approved By:** _______________ **Date:** _______________

---

**Document maintained by:** Development Team
**Last updated:** February 1, 2026
