# Score Correction System - Implementation Specification

## Overview

A score correction system that allows authorized users (admins and scorekeepers) to fix scoring errors after a match has been completed. This is essential for tournament integrity as mistakes can happen during fast-paced live scoring. The system maintains a complete audit trail of all corrections.

**Status:** Partially Implemented (Reset Only)  
**Priority:** High  
**Effort Estimate:** 1 day  
**Related Files:**
- `/src/stores/matches.ts` - Has `resetMatch()` function (lines 805-826)
- `/src/stores/matches.ts` - Has `submitManualScores()` for initial scoring
- `/src/features/scoring/views/ScoringInterfaceView.vue` - Scoring interface
- `/src/composables/useAdvanceWinner.ts` - Bracket advancement logic

---

## Current State Analysis

### What's Implemented

1. **Match Reset** (`/src/stores/matches.ts` lines 805-826)
   ```typescript
   async function resetMatch(
     tournamentId: string, 
     matchId: string, 
     categoryId?: string
   ): Promise<void> {
     await setDoc(
       doc(db, matchScoresPath, matchId),
       {
         scores: [],
         winnerId: null,
         status: 'scheduled',
         startedAt: null,
         completedAt: null,
         updatedAt: serverTimestamp(),
       },
       { merge: true }
     );
   }
   ```
   - Clears all scores
   - Resets match to 'scheduled' status
   - Does NOT revert bracket advancement

2. **Manual Score Entry** (`/src/stores/matches.ts` lines 923-979)
   - Allows entering scores game-by-game
   - Validates match completion
   - Advances bracket if match complete

3. **Walkover Recording** (`/src/stores/matches.ts` lines 733-803)
   - Records a match as walkover (forfeit)
   - Creates default 21-0 score
   - Advances bracket

### What's Missing

1. ❌ **No Score Correction UI** - Cannot edit completed match scores
2. ❌ **No Bracket Reversal** - Resetting match doesn't revert bracket
3. ❌ **No Audit Trail** - No record of who changed what and when
4. ❌ **No Correction Workflow** - No approval process for corrections
5. ❌ **No Bulk Correction** - Cannot fix multiple matches at once
6. ❌ **No Correction Validation** - No validation that correction is legitimate
7. ❌ **No Notification** - Players not notified of score changes

---

## Required Features

### Phase 1: Basic Score Correction (0.5 days)

#### 1.1 Score Correction Dialog
**Priority:** Critical  
**Effort:** 0.25 days

**Purpose:** Allow authorized users to edit scores of completed matches

**Features:**
- Edit game scores after match completion
- Add/remove games
- Change winner
- Add correction reason
- Require confirmation
- Show before/after comparison

**UI Flow:**
1. Admin views completed match
2. Clicks "Correct Score" button
3. Dialog opens with current scores editable
4. Admin makes changes
5. Enters reason for correction
6. Confirms correction
7. System updates scores and logs change

**UI Mockup:**
```
┌─────────────────────────────────────────────────────────────┐
│ Correct Match Score                                [X]      │
├─────────────────────────────────────────────────────────────┤
│ Match: John Smith vs Jane Doe                             │
│ Category: Men's Singles · Round 2                         │
│ Original completion: 10:30 AM                             │
├─────────────────────────────────────────────────────────────┤
│ Current Scores:                                             │
│                                                             │
│ Game 1: [21] - [15]  [🗑️]                                  │
│ Game 2: [18] - [21]  [🗑️]                                  │
│ Game 3: [15] - [21]  [🗑️]  ← Winner: Jane Doe              │
│                                                             │
│                    [+ Add Game]                             │
├─────────────────────────────────────────────────────────────┤
│ Winner: [Jane Doe ▼]                                       │
├─────────────────────────────────────────────────────────────┤
│ Reason for correction *                                     │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Incorrect game 2 score entered. Player confirmed       │ │
│ │ correct score was 21-18, not 18-21.                    │ │
│ └─────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│ ⚠️ This will update the bracket and notify players          │
├─────────────────────────────────────────────────────────────┤
│ [Cancel]                           [Confirm Correction]     │
└─────────────────────────────────────────────────────────────┘
```

**Component:** `/src/features/scoring/components/ScoreCorrectionDialog.vue`

**Implementation:**
```typescript
// /src/stores/matches.ts - Add new action

interface ScoreCorrection {
  originalScores: GameScore[];
  newScores: GameScore[];
  originalWinnerId?: string;
  newWinnerId?: string;
  reason: string;
  correctedBy: string;
  correctedAt: Date;
}

async function correctMatchScore(
  tournamentId: string,
  matchId: string,
  correction: Omit<ScoreCorrection, 'correctedBy' | 'correctedAt'>,
  categoryId?: string
): Promise<void> {
  const matchScoresPath = categoryId
    ? `tournaments/${tournamentId}/categories/${categoryId}/match_scores`
    : `tournaments/${tournamentId}/match_scores`;

  // 1. Get current match data
  const matchDoc = await getDoc(doc(db, matchScoresPath, matchId));
  const matchData = matchDoc.data();
  
  if (!matchData) throw new Error('Match not found');
  
  // 2. Create correction record
  const correctionRecord: ScoreCorrection = {
    ...correction,
    correctedBy: currentUser.value?.id || 'unknown',
    correctedAt: new Date(),
  };
  
  // 3. Update match scores
  const batch = writeBatch(db);
  
  batch.update(doc(db, matchScoresPath, matchId), {
    scores: correction.newScores,
    winnerId: correction.newWinnerId,
    status: correction.newWinnerId ? 'completed' : 'in_progress',
    corrected: true,
    correctionCount: increment(1),
    lastCorrectedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  
  // 4. Save correction to history
  const correctionPath = `${matchScoresPath}/${matchId}/corrections`;
  batch.set(doc(collection(db, correctionPath)), {
    ...correctionRecord,
    correctedAt: serverTimestamp(),
  });
  
  await batch.commit();
  
  // 5. Handle bracket changes if winner changed
  if (correction.originalWinnerId !== correction.newWinnerId) {
    await handleWinnerChange(
      tournamentId,
      matchId,
      correction.originalWinnerId,
      correction.newWinnerId,
      categoryId
    );
  }
  
  // 6. Log activity
  await activityStore.logScoreCorrection(tournamentId, matchId, correctionRecord);
}
```

#### 1.2 Bracket Reversal Logic
**Priority:** Critical  
**Effort:** 0.25 days

**Problem:** When a match winner changes, the bracket needs to be updated:
1. Remove old winner from subsequent matches
2. Add new winner to subsequent matches
3. Update all downstream matches

**Implementation:**
```typescript
// /src/composables/useAdvanceWinner.ts - Add reversal function

async function reverseWinnerAdvancement(
  tournamentId: string,
  matchId: string,
  oldWinnerId: string,
  categoryId?: string
): Promise<void> {
  // 1. Find all matches where oldWinner was advanced
  const nextMatchesQuery = query(
    collection(db, `tournaments/${tournamentId}/categories/${categoryId}/match`),
    where('opponent1.registrationId', '==', oldWinnerId)
  );
  
  const nextMatchesSnap = await getDocs(nextMatchesQuery);
  
  // 2. Remove oldWinner from those matches
  const batch = writeBatch(db);
  
  nextMatchesSnap.docs.forEach((matchDoc) => {
    const matchData = matchDoc.data();
    
    // Clear opponent slot
    if (matchData.opponent1?.registrationId === oldWinnerId) {
      batch.update(matchDoc.ref, {
        'opponent1.id': null,
        'opponent1.registrationId': null,
        updatedAt: serverTimestamp(),
      });
    }
    if (matchData.opponent2?.registrationId === oldWinnerId) {
      batch.update(matchDoc.ref, {
        'opponent2.id': null,
        'opponent2.registrationId': null,
        updatedAt: serverTimestamp(),
      });
    }
  });
  
  await batch.commit();
  
  // 3. Recursively reverse downstream matches
  for (const matchDoc of nextMatchesSnap.docs) {
    const matchData = matchDoc.data();
    if (matchData.status === 4) { // Completed in brackets-manager
      // This match was completed with wrong participant
      // Need to reset it too
      await reverseWinnerAdvancement(
        tournamentId,
        matchDoc.id,
        oldWinnerId,
        categoryId
      );
    }
  }
}

async function handleWinnerChange(
  tournamentId: string,
  matchId: string,
  oldWinnerId: string | undefined,
  newWinnerId: string | undefined,
  categoryId?: string
): Promise<void> {
  // 1. Reverse old winner's advancement
  if (oldWinnerId) {
    await reverseWinnerAdvancement(tournamentId, matchId, oldWinnerId, categoryId);
  }
  
  // 2. Advance new winner
  if (newWinnerId) {
    const advancer = useAdvanceWinner();
    await advancer.advanceWinner(tournamentId, categoryId!, matchId, newWinnerId);
  }
}
```

### Phase 2: Advanced Correction Features (0.5 days)

#### 2.1 Correction History
**Priority:** High  
**Effort:** 0.25 days

**Features:**
- View all corrections for a match
- See who made changes and when
- View correction reasons
- Rollback to previous version

**Data Model:**
```typescript
// Stored in: /tournaments/{id}/categories/{id}/match_scores/{id}/corrections/{id}
interface ScoreCorrectionRecord {
  id: string;
  matchId: string;
  originalScores: GameScore[];
  newScores: GameScore[];
  originalWinnerId?: string;
  newWinnerId?: string;
  reason: string;
  correctedBy: string;
  correctedByName: string;
  correctedAt: Date;
  ipAddress?: string;
  userAgent?: string;
}
```

**UI Component:**
```
┌─────────────────────────────────────────────────────────────┐
│ Correction History                                           │
├─────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 📅 Today, 2:30 PM by Admin User                          │ │
│ │ Reason: Incorrect game 2 score                          │ │
│ │ Change: 21-18, 18-21, 15-21 → 21-18, 21-18              │ │
│ │ Winner: Changed from Jane Doe to John Smith             │ │
│ │ [View Details] [Rollback to this version]               │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ 📅 Yesterday, 10:15 AM by Scorekeeper                    │ │
│ │ Reason: Initial score entry                             │ │
│ │ Original submission                                     │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

#### 2.2 Correction Validation
**Priority:** High  
**Effort:** 0.25 days

**Validations:**
1. **Score Validation**
   - Scores must follow game rules (21-point win, win by 2, max 30)
   - Match must have valid winner
   - Games must be sequential

2. **Timing Validation**
   - Cannot correct scores after tournament completion
   - Warning if next round has started
   - Block if finals completed

3. **Permission Validation**
   - Only admins and scorekeepers can correct
   - Cannot correct own matches (if player)
   - Require second approval for major changes

**Implementation:**
```typescript
interface CorrectionValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

function validateScoreCorrection(
  match: Match,
  newScores: GameScore[],
  newWinnerId: string
): CorrectionValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Validate game scores
  for (const game of newScores) {
    if (game.score1 < 0 || game.score2 < 0) {
      errors.push('Scores cannot be negative');
    }
    
    const maxScore = Math.max(game.score1, game.score2);
    const minScore = Math.min(game.score1, game.score2);
    
    if (maxScore < 21) {
      errors.push(`Game ${game.gameNumber}: Must reach 21 points`);
    }
    
    if (maxScore > 30) {
      errors.push(`Game ${game.gameNumber}: Cannot exceed 30 points`);
    }
    
    if (maxScore >= 21 && maxScore - minScore < 2 && maxScore < 30) {
      errors.push(`Game ${game.gameNumber}: Must win by 2 points`);
    }
  }
  
  // Validate match completion
  const gamesNeeded = Math.ceil(BADMINTON_CONFIG.gamesPerMatch / 2);
  const p1Wins = newScores.filter(g => g.winnerId === match.participant1Id).length;
  const p2Wins = newScores.filter(g => g.winnerId === match.participant2Id).length;
  
  if (p1Wins < gamesNeeded && p2Wins < gamesNeeded) {
    warnings.push('Match does not have a clear winner yet');
  }
  
  if (newWinnerId !== match.participant1Id && newWinnerId !== match.participant2Id) {
    errors.push('Winner must be one of the match participants');
  }
  
  return { isValid: errors.length === 0, errors, warnings };
}
```

---

## Technical Implementation

### New Files Required

```
src/
├── features/
│   └── scoring/
│       ├── components/
│       │   ├── ScoreCorrectionDialog.vue    # Main correction dialog
│       │   ├── CorrectionHistory.vue        # History list
│       │   └── GameScoreEditor.vue          # Individual game editor
│       └── composables/
│           └── useScoreCorrection.ts        # Correction logic
├── composables/
│   └── useBracketReversal.ts                # Bracket reversal
└── types/
    └── scoring.ts                           # Score correction types
```

### Store Extensions

```typescript
// /src/stores/matches.ts - Add to existing store

// State additions
const correctionHistory = ref<ScoreCorrectionRecord[]>([]);
const showCorrectionDialog = ref(false);
const matchBeingCorrected = ref<Match | null>(null);

// Actions additions
async function correctMatchScore(/* ... */);
async function fetchCorrectionHistory(tournamentId: string, matchId: string);
async function rollbackToVersion(correctionId: string);

// Getters
const canCorrectMatch = computed(() => {
  return currentUser.value?.role === 'admin' || 
         currentUser.value?.role === 'scorekeeper';
});

const hasCorrectionHistory = computed(() => {
  return correctionHistory.value.length > 0;
});
```

### Route Additions

```typescript
// Add to /src/router/index.ts
{
  path: '/tournaments/:tournamentId/matches/:matchId/correct',
  name: 'score-correction',
  component: () => import('@/features/scoring/views/ScoreCorrectionView.vue'),
  meta: { requiresAuth: true, requiresScorekeeper: true },
},
```

### Firestore Security Rules

Add to `/firestore.rules`:
```
// Allow score corrections by authorized users
match /tournaments/{tournamentId}/categories/{categoryId}/match_scores/{matchId} {
  allow update: if isScorekeeper()
    && request.resource.data.diff(resource.data).affectedKeys()
      .hasAny(['scores', 'winnerId', 'corrected', 'correctionCount'])
    && resource.data.status == 'completed';
}

// Corrections history
match /tournaments/{tournamentId}/categories/{categoryId}/match_scores/{matchId}/corrections/{correctionId} {
  allow read: if isAuthenticated();
  allow create: if isScorekeeper();
  allow update, delete: if false; // Immutable history
}
```

---

## UI/UX Design

### Score Correction Integration

**In Match View:**
```vue
<template>
  <v-card>
    <v-card-title>
      Match Result
      <v-spacer />
      
      <!-- Correction button -->
      <v-btn
        v-if="canCorrectMatch && match.status === 'completed'"
        color="warning"
        size="small"
        prepend-icon="mdi-pencil"
        @click="openCorrectionDialog"
      >
        Correct Score
      </v-btn>
    </v-card-title>
    
    <v-card-text>
      <!-- Show correction badge -->
      <v-alert
        v-if="match.corrected"
        type="info"
        density="compact"
        class="mb-4"
      >
        Score corrected {{ match.correctionCount }} time(s)
        <v-btn
          variant="text"
          size="small"
          @click="showHistory"
        >
          View History
        </v-btn>
      </v-alert>
      
      <!-- Match scores -->
      <!-- ... -->
    </v-card-text>
  </v-card>
  
  <!-- Correction Dialog -->
  <score-correction-dialog
    v-model="showCorrectionDialog"
    :match="match"
    @corrected="onScoreCorrected"
  />
</template>
```

### Game Score Editor

```vue
<template>
  <v-row
    v-for="(game, index) in editedScores"
    :key="index"
    align="center"
  >
    <v-col cols="2">
      <span>Game {{ game.gameNumber }}</span>
    </v-col>
    
    <v-col cols="3">
      <v-text-field
        v-model.number="game.score1"
        type="number"
        :label="participant1Name"
        :rules="[v => v >= 0 || 'Invalid score']"
        @input="updateWinner(game)"
      />
    </v-col>
    
    <v-col cols="1" class="text-center">
      <span>-</span>
    </v-col>
    
    <v-col cols="3">
      <v-text-field
        v-model.number="game.score2"
        type="number"
        :label="participant2Name"
        :rules="[v => v >= 0 || 'Invalid score']"
        @input="updateWinner(game)"
      />
    </v-col>
    
    <v-col cols="2">
      <v-chip
        v-if="game.isComplete"
        color="success"
        size="small"
      >
        {{ getWinnerName(game.winnerId) }} wins
      </v-chip>
    </v-col>
    
    <v-col cols="1">
      <v-btn
        icon="mdi-delete"
        size="small"
        variant="text"
        color="error"
        @click="removeGame(index)"
      />
    </v-col>
  </v-row>
  
  <v-btn
    color="primary"
    variant="text"
    prepend-icon="mdi-plus"
    @click="addGame"
  >
    Add Game
  </v-btn>
</template>
```

---

## Testing Requirements

### Unit Tests
- Score validation logic
- Bracket reversal functions
- Correction history tracking
- Winner change detection

### E2E Tests
- Correct a completed match score
- Change match winner
- View correction history
- Validation error display
- Bracket updates after correction

### Edge Cases
- Correcting already-corrected match
- Changing winner multiple times
- Network failure during correction
- Correcting after next round started
- Invalid score validation

---

## Acceptance Criteria

- [ ] Scorekeepers can open correction dialog
- [ ] Game scores can be edited
- [ ] Games can be added/removed
- [ ] Winner can be changed
- [ ] Correction reason is required
- [ ] Validation prevents invalid scores
- [ ] Bracket updates when winner changes
- [ ] Correction history is saved
- [ ] Players can view correction history
- [ ] Activity log records corrections
- [ ] Notifications sent for score changes
- [ ] Mobile-responsive interface

---

## Related Documentation

- [Scoring Interface](../src/features/scoring/) - Current scoring system
- [Match Store](../src/stores/matches.ts) - Match data management
- [Advance Winner Composable](../src/composables/useAdvanceWinner.ts) - Bracket advancement

---

**Document Version:** 1.0  
**Last Updated:** 2026-02-14  
**Author:** Sisyphus AI  
**Status:** Draft - Ready for Implementation
