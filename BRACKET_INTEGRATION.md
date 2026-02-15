# Bracket Integration Guide

## Overview
Client-side bracket generation replaces Cloud Functions for instant tournament setup.

## Files Added

```
src/
├── composables/
│   ├── useBracketGenerator.ts    # Generate brackets using brackets-manager
│   ├── useMatchScheduler.ts      # Assign matches to courts
│   └── useTournamentSetup.ts     # Combined workflow
└── components/
    └── GenerateBracketDialog.vue # UI for generation
```

## How to Use

### 1. Generate Bracket (Admin Only)

```typescript
import { useTournamentSetup } from '@/composables/useTournamentSetup';

const setup = useTournamentSetup();

// In your component
async function onGenerate() {
  const result = await setup.setupCategory({
    tournamentId: 'tour_123',
    categoryId: 'cat_456',
    grandFinalReset: true,      // Double elimination reset
    thirdPlaceMatch: true,      // Consolation final
    autoSchedule: true,         // Auto-assign courts
    startTime: new Date(),
    courtIds: ['court_1', 'court_2']
  });
  
  console.log(`Generated ${result.bracket.matchCount} matches`);
  console.log(`Scheduled ${result.schedule.scheduled} to courts`);
}
```

### 2. Use the Dialog Component

```vue
<template>
  <v-btn @click="showDialog = true">Generate Bracket</v-btn>
  
  <GenerateBracketDialog
    v-model="showDialog"
    :tournament-id="tournamentId"
    :category-id="categoryId"
    :category-name="categoryName"
    :category-format="categoryFormat"
    @success="onSuccess"
  />
</template>
```

### 3. Store Integration (Updated)

```typescript
import { useTournamentStore } from '@/stores/tournaments';

const store = useTournamentStore();

// These now use client-side composables
await store.generateBracket(tournamentId, categoryId, {
  grandFinalReset: true,
  thirdPlaceMatch: true
});

await store.generateSchedule(tournamentId, {
  categoryId,
  courtIds: ['court_1']
});

await store.clearSchedule(tournamentId, categoryId);
```

## Supported Formats

| Format | Supported | Notes |
|--------|-----------|-------|
| Single Elimination | ✅ | Standard bracket |
| Double Elimination | ✅ | WB + LB + Finals |
| Round Robin | ✅ | Circle method |
| Pool to Elimination | ⚠️ | Uses SE as fallback |

## Variable Participant Count

Works for any number (2-128+):
- 2-4 players → 4 slots
- 5-8 players → 8 slots  
- 9-16 players → 16 slots
- etc.

BYEs are automatically assigned to top seeds.

## Real-time Updates

Viewers see updates live via existing `matchStore.subscribeMatches()`:

```typescript
// In your bracket view
const matchStore = useMatchStore();

onMounted(() => {
  matchStore.subscribeMatches(tournamentId, categoryId);
});

// matchStore.matches updates automatically when scores change
```

## Migration from Cloud Functions

The tournament store now uses local composables instead of Cloud Functions:

| Old | New |
|-----|-----|
| `httpsCallable(functions, 'generateBracket')` | `useBracketGenerator().generateBracket()` |
| `httpsCallable(functions, 'generateSchedule')` | `useMatchScheduler().scheduleMatches()` |

**Benefits:**
- Instant generation (no network round-trip)
- Works offline (queues to Firestore)
- Better error handling
- Progress tracking

## Testing

```bash
# Start dev server
npm run dev

# Generate a bracket via UI
# 1. Create tournament
# 2. Add category (e.g., "Men's Singles")
# 3. Add registrations (at least 2)
# 4. Click "Generate Bracket"
# 5. Check Firestore for stage/match/participant collections
```

## Troubleshooting

### "Need at least 2 participants"
Make sure registrations have status `approved` or `checked_in`.

### Bracket not showing
Verify the `bracketMatchAdapter.ts` is properly converting brackets-manager format to your Match type.

### Schedule not assigning courts
Check that courts exist and have status `available` or `in_use`.
