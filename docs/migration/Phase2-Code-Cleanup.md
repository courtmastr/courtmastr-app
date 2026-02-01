# Phase 2: Code Cleanup

**Duration:** Days 4-5 | **Status:** ⏳ Not Started

---

## Overview

Remove all traces of the legacy `/matches` collection and standardize data access patterns:
1. Audit and remove all `/matches` references
2. Standardize status handling across codebase
3. Verify real-time subscriptions
4. Consolidate client/server adapters

---

## Prerequisites

- [ ] Phase 1 complete and signed off
- [ ] All Phase 1 changes committed
- [ ] All Cloud Functions deployed
- [ ] Integration test passed

---

## Step 2.1: Audit /matches References ⏱️ 2 hours

**Goal:** Find and remove all remaining references to `/matches` collection

### Tasks

- [ ] Run grep commands to find references
- [ ] Document all findings
- [ ] Update each file
- [ ] Verify zero references remain

<details>
<summary><strong>🔍 Grep Commands</strong></summary>

Run these commands from project root:

```bash
# Search for collection('matches') calls
grep -rn "collection('matches')" --include="*.ts" --include="*.js" src/ functions/

# Search for string references
grep -rn "'/matches'" --include="*.ts" --include="*.js" src/ functions/

# Search for template literals
grep -rn '`.*matches.*`' --include="*.ts" --include="*.js" src/ functions/

# Search for type definitions
grep -rn "matches" --include="*.ts" src/types/ functions/src/types/
```

</details>

### Document Findings

Create a checklist of all found references:

| File | Line | Reference | Action | Status |
|------|------|-----------|--------|--------|
| | | | | [ ] |
| | | | | [ ] |
| | | | | [ ] |

<details>
<summary><strong>📝 Common Fixes</strong></summary>

**For collection references:**
- Change `.collection('matches')` to `.collection('match')` or `.collection('match_scores')`
- Determine which collection based on purpose:
  - Bracket structure → use `/match`
  - Scores, courts, scheduling → use `/match_scores`

**For type imports:**
- Remove unused `Match` or `LegacyMatch` type imports
- Update to use current match types

**For comments:**
- Update outdated comments referring to `/matches`
- Add clarity about `/match` vs `/match_scores` distinction

</details>

### Verification

- [ ] Re-run all grep commands
- [ ] Verify zero results (except in docs/comments explaining the migration)
- [ ] Build succeeds: `npm run build && cd functions && npm run build`
- [ ] Run app and test match-related features
- [ ] Check Firestore emulator - no `/matches` collection created

### Commit

```bash
git add -A
git commit -m "refactor: remove all /matches collection references

- Remove legacy collection references from codebase
- Update to use /match (structure) and /match_scores (operational)
- Clean up unused types and imports
- Part of data model consolidation (Phase 2.1)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

- [ ] Commit hash: _______________

---

## Step 2.2: Standardize Status Handling ⏱️ 2 hours

**Goal:** Document and standardize how match status is handled

### Current Status System

- **/match.status** (number): 0=Locked, 1=Waiting, 2=Ready, 3=Running, 4=Completed
- **/match_scores.status** (string): "scheduled", "ready", "in_progress", "completed"

### Tasks

- [ ] Review status handling in key files
- [ ] Add documentation comments
- [ ] Ensure `/match_scores.status` takes precedence in UI
- [ ] Document conversion logic

<details>
<summary><strong>📝 Files to Review and Document</strong></summary>

**1. [src/stores/matches.ts](../../src/stores/matches.ts) (lines 120-121)**

Verify this logic (CORRECT):
```typescript
// This is CORRECT - match_scores status overrides brackets status
if (scoreData.status) adapted.status = scoreData.status;
```

Add comment above:
```typescript
// STATUS HANDLING:
// - /match.status (number 0-4) - brackets-manager internal use only
// - /match_scores.status (string) - authoritative for UI display
// - Always use match_scores.status when available
if (scoreData.status) adapted.status = scoreData.status;
```

**2. [src/stores/bracketMatchAdapter.ts](../../src/stores/bracketMatchAdapter.ts) (lines 109-123)**

Add comment above `convertBracketsStatus` function:
```typescript
// Converts brackets-manager numeric status to string status
// Only used for initial conversion when match_scores doesn't exist yet
// Once a match has operational data, match_scores.status takes precedence
function convertBracketsStatus(bracketsStatus: number): MatchStatus {
  switch (bracketsStatus) {
    case 0: case 1: return 'scheduled';
    case 2: return 'ready';
    case 3: return 'in_progress';
    case 4: return 'completed';
    default: return 'scheduled';
  }
}
```

**3. [functions/src/updateMatch.ts](../../functions/src/updateMatch.ts) (line 63)**

Verify status mapping logic is correct and add comment if needed.

</details>

### Verification

- [ ] All key files have status handling comments
- [ ] Status conversion logic is clear
- [ ] Test UI displays correct status:
  - [ ] Match without scores shows brackets-manager status
  - [ ] Match with scores shows match_scores status
  - [ ] Status updates propagate correctly

### Commit

```bash
git add src/stores/matches.ts src/stores/bracketMatchAdapter.ts
git commit -m "docs: standardize and document status handling

- Add comments explaining dual status system
- Document that /match_scores.status is authoritative for UI
- Clarify brackets-manager status is internal only
- Part of Phase 2.2 code cleanup

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

- [ ] Commit hash: _______________

---

## Step 2.3: Verify Real-Time Subscriptions ⏱️ 1 hour

**Goal:** Confirm real-time updates work correctly

### Tasks

- [ ] Review subscription code
- [ ] Test real-time updates
- [ ] Verify cleanup functions work

<details>
<summary><strong>📝 Code to Verify</strong></summary>

**[src/stores/matches.ts](../../src/stores/matches.ts) (lines 158-164)**

Verify both subscriptions exist:
```typescript
// Subscribe to /match collection (bracket structure)
const qMatch = collection(db, `tournaments/${tournamentId}/categories/${categoryId}/_data/match`);
const unsubMatch = onSnapshot(qMatch, () => refresh());

// Subscribe to /match_scores collection (operational data)
const qScores = collection(db, `tournaments/${tournamentId}/match_scores`);
const unsubScores = onSnapshot(qScores, () => refresh());
```

Verify cleanup (around lines 165-169):
```typescript
// Cleanup function
const unsubscribeAll = () => {
  if (unsubMatch) unsubMatch();
  if (unsubScores) unsubScores();
};

return unsubscribeAll;
```

</details>

### Testing Procedure

**Two-Tab Test:**
- [ ] Open app in Tab 1 (Scorer)
- [ ] Open app in Tab 2 (Viewer)
- [ ] In Tab 1: Start a match
- [ ] Verify Tab 2 shows match as "in_progress" within 2 seconds
- [ ] In Tab 1: Update score
- [ ] Verify Tab 2 shows updated score within 2 seconds
- [ ] In Tab 1: Complete match
- [ ] Verify Tab 2 shows match as "completed" and winner advanced

**Cleanup Test:**
- [ ] Open browser DevTools → Network tab
- [ ] Navigate away from matches page
- [ ] Verify WebSocket connections are closed
- [ ] Navigate back to matches page
- [ ] Verify new subscriptions are created

### Issues to Watch For

- Memory leaks (subscriptions not cleaned up)
- Multiple subscriptions to same collection
- Subscriptions triggering too frequently
- Race conditions during rapid updates

### Commit

If any fixes are needed:

```bash
git add src/stores/matches.ts
git commit -m "fix: ensure real-time subscriptions cleanup properly

- Verify both /match and /match_scores subscriptions active
- Ensure unsubscribeAll() cleans up both listeners
- Prevent memory leaks on navigation
- Part of Phase 2.3 verification

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

Otherwise, just verify and document:
- [ ] Real-time updates verified ✅
- [ ] No fixes needed ✅

---

## Step 2.4: Consolidate Adapters ⏱️ 2 hours

**Goal:** Ensure client and server adapters behave identically

### Tasks

- [ ] Compare both adapters side-by-side
- [ ] Document differences
- [ ] Add comments explaining intentional differences
- [ ] Verify ID handling is consistent

<details>
<summary><strong>📝 Adapter Comparison</strong></summary>

**Files to Compare:**
- [src/services/brackets-storage.ts](../../src/services/brackets-storage.ts) (Client)
- [functions/src/storage/firestore-adapter.ts](../../functions/src/storage/firestore-adapter.ts) (Server)

**Key Aspects:**

| Aspect | Client | Server | Match? |
|--------|--------|--------|--------|
| ID Type | String (after 1.1) | String | [ ] |
| normalizeReferences | String conversion | String conversion | [ ] |
| Collection Path | Category-isolated | Tournament-scoped | [ ] |
| Batch Operations | Supported | Supported | [ ] |
| Error Handling | Try/catch | Try/catch | [ ] |

</details>

### Path Differences (Intentional)

Document why paths differ:

**Client:** `/tournaments/{id}/categories/{id}/_data/{table}`
- Purpose: Category isolation for multi-category tournaments
- Allows different brackets per category in same tournament

**Server:** `/tournaments/{id}/{table}`
- Purpose: Tournament-scoped for Cloud Functions
- Simpler path for server-side operations

<details>
<summary><strong>📝 Comments to Add</strong></summary>

**Add to [src/services/brackets-storage.ts](../../src/services/brackets-storage.ts):**

```typescript
// ADAPTER CONSISTENCY:
// Both client (brackets-storage.ts) and server (firestore-adapter.ts)
// normalize all IDs to strings for Firestore compatibility.
//
// Path differences are intentional:
// - Client: /categories/{id}/_data/{table} (category isolation)
// - Server: /tournaments/{id}/{table} (tournament scope for CFs)
//
// Both adapters should handle IDs identically after Step 1.1.
```

**Add to [functions/src/storage/firestore-adapter.ts](../../functions/src/storage/firestore-adapter.ts):**

```typescript
// ADAPTER CONSISTENCY:
// This server adapter matches the client adapter (brackets-storage.ts)
// in ID handling - all IDs are normalized to strings.
//
// Path difference: Server uses tournament scope, client uses category isolation.
// This is intentional and does not affect data consistency.
```

</details>

### Verification

- [ ] Both adapters have consistency comments
- [ ] ID handling verified identical (both use strings)
- [ ] Path differences documented
- [ ] Test: Generate bracket client-side AND server-side
- [ ] Verify both produce identical document structures (except paths)

### Commit

```bash
git add src/services/brackets-storage.ts functions/src/storage/firestore-adapter.ts
git commit -m "docs: document adapter consistency and path differences

- Add comments explaining ID normalization consistency
- Document intentional path differences (category vs tournament scope)
- Clarify both adapters behave identically for ID handling
- Part of Phase 2.4 consolidation

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

- [ ] Commit hash: _______________

---

## Phase 2 Complete Checklist

- [ ] Step 2.1: All /matches references removed ✅
- [ ] Step 2.2: Status handling standardized and documented ✅
- [ ] Step 2.3: Real-time subscriptions verified ✅
- [ ] Step 2.4: Adapters consolidated and documented ✅
- [ ] All code changes committed
- [ ] Build succeeds without errors
- [ ] App runs without console errors
- [ ] No Firestore operations on `/matches` collection

---

## Rollback: Full Phase 2

If Phase 2 needs to be rolled back:

```bash
# Find Phase 2 commits
git log --oneline -10

# Revert entire phase
git revert <step-2.4-hash> <step-2.3-hash> <step-2.2-hash> <step-2.1-hash>

# Rebuild
npm run build
cd functions && npm run build
```

---

## Next Steps

When Phase 2 is complete:
- Proceed to [Phase 3: Verification](Phase3-Verification.md)
- Update [MASTER_PLAN.md](MASTER_PLAN.md) progress tracking

---

**Phase 2 Sign-Off**

- Completed By: _______________
- Date: ___/___/___
- Issues Encountered: _______________
