# Architecture Explanation: Category-Isolated Brackets

## The Core Problem You Identified

You're correct - if we use IDs 1, 2, 3... for participants in EVERY category, they will conflict when stored in the same Firestore database.

## How The New Architecture Actually Works

### Firestore Path Isolation

**Before (Broken):**
```
/tournaments/{tournamentId}/match/{matchId}
/tournaments/{tournamentId}/participant/{participantId}
```
All categories mixed together in shared collections

**After (Fixed):**
```
/tournaments/{tournamentId}/categories/{categoryA}/participant/1
/tournaments/{tournamentId}/categories/{categoryA}/participant/2
/tournaments/{tournamentId}/categories/{categoryB}/participant/1  <-- Same ID, different path!
/tournaments/{tournamentId}/categories/{categoryB}/participant/2  <-- Same ID, different path!
```

Each category has its OWN subcollection. So:
- Category A's participant "1" is at: `/categories/categoryA/participant/1`
- Category B's participant "1" is at: `/categories/categoryB/participant/1`

These are completely separate documents because the path includes the categoryId.

## Why This Works

1. **Firestore paths are unique**: `/categories/catA/participant/1` ≠ `/categories/catB/participant/1`
2. **brackets-manager sees each category as a separate "tournament"**: It queries within the category's subcollection only
3. **Sequential IDs (1, 2, 3...) work fine** because they're scoped to the category subcollection

## The Data Flow

### When Generating Bracket for Category A:
```
1. Create participants: /categories/catA/participant/1, /categories/catA/participant/2...
2. Create stage: /categories/catA/stage/0
3. Create matches: /categories/catA/match/0, /categories/catA/match/1...
4. All IDs (1, 2, 3...) are scoped to catA's subcollection
```

### When Generating Bracket for Category B:
```
1. Create participants: /categories/catB/participant/1, /categories/catB/participant/2...
2. Create stage: /categories/catB/stage/0
3. Create matches: /categories/catB/match/0, /categories/catB/match/1...
4. Same IDs (1, 2, 3...) but scoped to catB's subcollection - NO CONFLICT!
```

## The Key Insight

The **FirestoreStorage adapter** is initialized with a **category-specific path**:
```typescript
const categoryPath = `tournaments/${tournamentId}/categories/${categoryId}`;
const storage = new ClientFirestoreStorage(db, categoryPath);
```

All queries and writes go through this adapter, which automatically scopes them to that category's subcollection.

## Participant ID Mapping

```
brackets-manager participant.id = 1
  ↓
Firestore document ID = "1" at path /categories/{catId}/participant/1
  ↓
participant.name = registrationId (e.g., "abc123xyz")
  ↓
Look up registration to get player name for display
```

## Summary

- **Same IDs (1, 2, 3...)** can exist in multiple categories
- **No conflicts** because they're in different Firestore paths
- **brackets-manager works as designed** with sequential IDs
- **Each category is completely isolated**

This is the correct architecture that solves the category isolation problem.
