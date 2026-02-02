# CourtMaster Architecture Analysis

## Current Data Model Issues

### 1. **Category Isolation Problem**
**Issue**: All categories store matches in the same `match` collection with `stage_id` starting from 0.

**Current Structure**:
```
/tournaments/{tournamentId}/match/{matchId}
  - stage_id: "0"  // Same for ALL categories!
  - opponent1: { id: "1", ... }
  - opponent2: { id: "2", ... }
```

**Problem**: When Category A and Category B both generate brackets, they both create matches with `stage_id: "0"`. The viewer can't distinguish which match belongs to which category.

**Impact**: 
- Viewing Category A shows matches from Category B
- Match counts are wrong
- Participant IDs conflict between categories

### 2. **Dual ID System Complexity**
**Current System**:
- `opponent.id`: Sequential number (1, 2, 3...) for brackets-manager
- `opponent.registrationId`: Actual Firestore registration ID
- Participant names resolved at runtime

**Problems**:
- Need to maintain mapping between sequential IDs and registration IDs
- Viewer must reconstruct participant list every time
- BYE handling is complex (IDs exist but no registration)

### 3. **Mixed Collection Schema**
**Current Collections**:
- `stage` - bracket metadata
- `match` - bracket matches (with our custom fields added)
- `match_scores` - scoring data (separate collection)
- `registrations` - participant data

**Issues**:
- Data split across multiple collections
- Need multiple queries to get complete match info
- Real-time updates require multiple listeners

### 4. **brackets-manager Integration Pain Points**
**Current Approach**:
- Use brackets-manager for bracket generation
- Store in Firestore using custom adapter
- Use brackets-viewer.js for display

**Issues**:
- brackets-manager expects its own data format
- We keep adding fields to match documents to maintain compatibility
- Cloud Function needs to understand brackets-manager IDs

## Proposed Architecture Changes

### Option A: Minimal Fix (Keep Current Schema, Fix Isolation)
**Changes**:
1. Add `category_id` to all match documents (already done)
2. Ensure viewer filters by `category_id`
3. Keep all other logic the same

**Pros**:
- Minimal changes
- Backward compatible

**Cons**:
- Still have dual ID complexity
- Still split across collections
- Still dependent on brackets-manager internals

### Option B: Simplified Schema (Recommended)
**New Structure**:
```
/tournaments/{tournamentId}/categories/{categoryId}
  - bracket: {
      format: 'single_elimination' | 'double_elimination',
      size: 8 | 16 | 32,
      matches: [  // Embedded match array
        {
          id: 'match_0',  // Simple ID
          round: 1,
          position: 1,
          bracket: 'winners' | 'losers' | 'finals',
          participant1: {
            registrationId: 'abc123',
            name: 'John Doe',
            isBye: false
          },
          participant2: {
            registrationId: 'def456', 
            name: 'Jane Smith',
            isBye: false
          },
          status: 'scheduled' | 'in_progress' | 'completed',
          scores: [...],  // Embedded scores
          winnerId: 'abc123',
          nextMatchId: 'match_4',  // Simple advancement
          courtId: 'court_1',
          scheduledTime: Timestamp
        }
      ]
    }
```

**Pros**:
- Single document per category bracket
- No dual ID system - use registration IDs directly
- Embedded scores - single query gets everything
- Simple advancement logic (just reference nextMatchId)
- Easy to understand and debug

**Cons**:
- Larger documents (but brackets are small, max ~63 matches)
- Need to rewrite bracket generation (not use brackets-manager)
- Need custom bracket visualization

### Option C: Hybrid Approach
**Keep brackets-manager for generation, simplify storage**:
1. Use brackets-manager to generate bracket structure
2. Export to simple format with registration IDs
3. Store in simplified schema (like Option B)
4. Use custom visualization

**Pros**:
- Keep proven bracket generation logic
- Simpler storage and display
- Easier to maintain

**Cons**:
- Still need conversion layer
- Two different bracket representations

## Recommendation

**Go with Option B - Simplified Schema**

**Why**:
1. **Simplicity**: One collection, clear data model
2. **Performance**: Single document load vs multiple queries
3. **Maintainability**: No dependency on brackets-manager internals
4. **Flexibility**: Easy to add custom fields (court, schedule, etc.)
5. **Debugging**: Can inspect entire bracket in one Firestore document

**Implementation Plan**:
1. Create new bracket generation logic (without brackets-manager)
2. Store in simplified format under `category.bracket`
3. Update viewer to read from new format
4. Update match control to work with new format
5. Update Cloud Function for advancement
6. Migrate existing data (or regenerate)

**Migration Strategy**:
- Keep existing collections for backward compatibility
- Add `bracket` field to categories
- Gradually migrate functionality
- Remove old collections once fully migrated
