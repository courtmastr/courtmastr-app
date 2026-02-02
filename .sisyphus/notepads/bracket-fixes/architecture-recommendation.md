# CourtMaster Architecture - Working WITH brackets-manager

## The Core Problem

We've been fighting brackets-manager's data model instead of embracing it. Here's what's actually happening:

### brackets-manager's Mental Model
```
Tournament (arbitrary ID)
  ├── Stage (id: 0, 1, 2... per tournament)
  ├── Participant (id: 1, 2, 3... per tournament)
  └── Match (id: 0, 1, 2... per tournament)
```

**Key insight**: IDs are **relative to the tournament**, not global.

### Our Current (Broken) Implementation

```
Firestore Path: /tournaments/{tournamentId}/match/{matchId}

Category A (id: "cat1"):
  - Creates stage with id: "0", tournament_id: "cat1"
  - Creates matches with id: "0", "1", "2"... stage_id: "0"
  
Category B (id: "cat2"):
  - Creates stage with id: "0", tournament_id: "cat2"  
  - Creates matches with id: "0", "1", "2"... stage_id: "0"

Problem: Both categories write to SAME Firestore collection!
```

When the adapter queries for match id "0", it finds matches from BOTH categories because it doesn't filter by `tournament_id`.

## The Solution

### Option 1: Isolate by Firestore Path (Recommended)

Store each category's bracket in a separate subcollection:

```
/tournaments/{tournamentId}/categories/{categoryId}/stage/{stageId}
/tournaments/{tournamentId}/categories/{categoryId}/match/{matchId}
/tournaments/{tournamentId}/categories/{categoryId}/participant/{participantId}
```

**Changes needed**:
1. Update FirestoreAdapter to accept category-specific root path
2. Update useBracketGenerator to save to category subcollection
3. Update BracketsManagerViewer to read from category subcollection

**Pros**:
- True isolation - categories can't interfere with each other
- Works with existing brackets-manager logic
- Clean Firestore structure

**Cons**:
- Need to update multiple files
- Migration needed for existing data

### Option 2: Fix Adapter to Filter by tournament_id

Modify the FirestoreAdapter to ALWAYS include `tournament_id` filter:

```typescript
private tournamentId: string;

constructor(db: Firestore, rootPath: string, tournamentId: string) {
  this.db = db;
  this.rootPath = rootPath;
  this.tournamentId = tournamentId;
}

async select<T>(table: Table, arg?: number | string | Partial<T>) {
  let query = this.getCollectionRef(table)
    .where('tournament_id', '==', this.tournamentId);  // Always filter!
  
  if (typeof arg === 'number' || typeof arg === 'string') {
    query = query.where('id', '==', String(arg));
  }
  // ...
}
```

**Pros**:
- Minimal changes to existing code
- Keeps current Firestore structure

**Cons**:
- Requires composite indexes for all queries
- More complex queries
- Easy to forget the filter

### Option 3: Use brackets-manager's InMemoryDatabase Only

Don't store brackets-manager data in Firestore at all:

1. Generate bracket in memory using InMemoryDatabase
2. Export to our own simplified format
3. Store in Firestore as `/categories/{id}/bracketData`
4. Render using custom viewer

**Pros**:
- Complete control over data model
- No adapter complexity
- Simple queries

**Cons**:
- Lose brackets-viewer.js (need custom visualization)
- Need to implement advancement logic ourselves

## Recommendation: Option 1

Isolate each category's bracket data in its own subcollection. This is the cleanest solution that works WITH brackets-manager's design rather than against it.

### Implementation Plan

1. **Update FirestoreAdapter** to work with category-specific paths
2. **Update useBracketGenerator** to save to `/categories/{id}/...`
3. **Update BracketsManagerViewer** to read from `/categories/{id}/...`
4. **Update Cloud Function** to use category-specific adapter
5. **Migration**: Either regenerate brackets or move existing data

### New Data Structure

```
/tournaments/{tournamentId}
  /categories/{categoryId}
    - name: "Men's Singles"
    - format: "single_elimination"
    - status: "active"
    /stage/0
      - id: "0"
      - tournament_id: "0"  // brackets-manager uses stage 0
      - name: "Men's Singles"
      - type: "single_elimination"
    /match/0
      - id: "0"
      - stage_id: "0"
      - opponent1: { id: "1", ... }
      - opponent2: { id: "2", ... }
    /match/1
      - ...
    /participant/1
      - id: "1"
      - tournament_id: "0"
      - name: "player_name_or_id"
```

This way, each category is completely isolated, and brackets-manager can work as designed.
