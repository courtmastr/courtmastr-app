# Courtmaster Architecture Analysis & Decision Document

**Date:** January 30, 2026  
**Status:** Analysis Complete - Awaiting Decisions  
**Prepared by:** AI Development Assistant

---

## Executive Summary

This document analyzes the current Courtmaster application architecture, identifies critical issues affecting scalability, and presents options for unifying the data model. The application currently has **two competing data flows** for bracket generation and **three different collections** for match data, creating maintenance and scalability risks.

### Key Findings
- ❌ **Two bracket generation paths** (client-side vs Cloud Function) with different ID strategies
- ❌ **Three match collections** (`/match`, `/matches`, `/match_scores`) creating multiple sources of truth
- ❌ **Missing real-time subscriptions** for scores, causing stale data in public views
- ⚠️ **Scalability limits** approaching at ~200 matches (batch writes, query limits)
- ✅ **Solid foundation** with brackets-manager library and adapter pattern

---

## 1. Current Architecture Overview

### 1.1 Data Flow Diagram

```
┌───────────────────────────────────────────────────────────────────────────────┐
│                    CLIENT SIDE                                    │
├───────────────────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │   Bracket    │───³   /match     │    │  /matches   │     │
│  │  Generator   │    │ (brackets)  │    │  (legacy)   │     │
│  └─────────────┘    └─────────────┘    └─────────────┘     │
│         │                   │                   │               │
│         │                   │                   │               │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │   Bracket    │───³  Adapter    │    │  Court Mgmt │     │
│  │   Viewer     │    │ (converts)  │    │ Scheduling │     │
│  └─────────────┘    └─────────────┘    └─────────────┘     │
│                              │                                  │
│                              ▼                                  │
│                       ┌─────────────┐                         │
│                       │  Match Store │                         │
│                       │  (UI State)  │                         │
│                       └─────────────┘                         │
│                                                                 │
└───────────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│                  CLOUD FUNCTIONS                               │
├───────────────────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │ updateMatch  │───³   /match     │    │   /matches │◀───´│
│  │ (brackets)   │    │  (brackets)  │    │   (legacy) │     │
│  └─────────────┘    └─────────────┘    └─────────────┘     │
│         │                                              │       │
│         │                                              │       │
│  ┌─────────────┐                            ┌─────────────┐ │
│  │  Brackets    │                            │  advanceWinner│ │
│  │  Manager     │                            │   (legacy)    │ │
│  └─────────────┘                            └─────────────┘ │
│                                                                 │
└───────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Firestore Collections

| Collection | Purpose | Schema | Written By | Read By |
|------------|---------|--------|------------|---------|
| `/tournaments` | Tournament metadata | Custom | TournamentStore | All modules |
| `/tournaments/{id}/categories` | Event categories | Custom | TournamentStore | BracketGen |
| `/tournaments/{id}/courts` | Court management | Custom | CourtManagement | Scheduler, Scoring |
| `/tournaments/{id}/registrations` | Player registrations | Custom | RegistrationStore | BracketGen |
| `/tournaments/{id}/players` | Player profiles | Custom | RegistrationStore | All modules |
| `/tournaments/{id}/stage` | Bracket stages | brackets-manager | BracketGen | BracketViewer, Adapter |
| `/tournaments/{id}/group` | Bracket groups | brackets-manager | BracketGen | BracketViewer, Adapter |
| `/tournaments/{id}/round` | Bracket rounds | brackets-manager | BracketGen | BracketViewer, Adapter |
| `/tournaments/{id}/match` | **Bracket matches** | brackets-manager | BracketGen, updateMatch CF | All modules |
| `/tournaments/{id}/match_game` | Match games (BO3) | brackets-manager | BracketGen | updateMatch CF |
| `/tournaments/{id}/participant` | Bracket participants | brackets-manager | BracketGen | BracketViewer, Adapter |
| `/tournaments/{id}/match_scores` | **Scores + Scheduling** | Custom | Scoring, Scheduler | Scoring, PublicViews |
| `/tournaments/{id}/matches` | **LEGACY matches** | Custom | Scheduling CF, CourtMgmt | CourtMgmt, advanceWinner CF |
| `/tournaments/{id}/activities` | Activity log | Custom | ActivityStore | PublicViews |

**Critical Issue**: Three collections store match-related data:
1. `/match` - bracket structure and status (brackets-manager)
2. `/match_scores` - scores and scheduling (custom)
3. `/matches` - legacy operational data (custom)

---

## 2. Critical Issues

### 2.1 Dual Bracket Generation Paths

#### Path A: Client-Side (Default)
**Location**: `src/composables/useBracketGenerator.ts`

```typescript
// ID Strategy
const participantId = i + 1; // Numeric: 1, 2, 3...

// Storage Flow
InMemoryDatabase (numeric IDs) 
  ↓
Firestore (converted to strings)
  └─▸ id: String(m.id), stage_id: String(stageId), etc.
```

**Characteristics**:
- ✅ Fast (no network round-trip)
- ✅ Simple implementation
- ❌ 500 write batch limit (Firestore constraint)
- ❌ Numeric IDs need conversion
- ❌ No server-side validation

#### Path B: Cloud Function
**Location**: `functions/src/bracket.ts`

```typescript
// ID Strategy
seeding: registrationIds // Strings directly

// Storage Flow
FirestoreStorage (native strings)
  ↓
Firestore (strings natively)
  └─▸ id: docRef.id (string), participant IDs from registrations
```

**Characteristics**:
- ✅ No batch limits (automatic chunking)
- ✅ Server-side validation
- ✅ Consistent string IDs
- ❌ Slower (network round-trip)
- ❌ More complex error handling
- ❌ Different participant ID mapping

#### The Problem
These two paths produce **different data schemas**:

| Aspect | Client-Side | Cloud Function |
|--------|-------------|----------------|
| Match ID | `"1"`, `"2"` (from number) | Auto-generated Firestore ID |
| Participant ID | `"1"`, `"2"` (mapped to registration) | Registration ID directly |
| Seeding | Numeric positions | Registration IDs |

**Impact**: If you generate a bracket client-side then try to update it via Cloud Function, the IDs don't match and operations fail.

### 2.2 Multiple Sources of Truth

#### Issue: Match Status
```
/match.status (brackets-manager numeric enum)
  ├─▸ 0 = Locked
  ├─▸ 1 = Waiting  
  ├─▸ 2 = Ready
  ├─▸ 3 = Running
  └─▸ 4 = Completed

/match_scores.status (custom string)
  ├─▸ "scheduled"
  ├─▸ "ready"
  ├─▸ "in_progress"
  └─▸ "completed"
```

**Problem**: Status is stored in two places with different formats. UI shows `/match_scores` status but bracket progression uses `/match` status.

#### Issue: Scheduling Data
```
Client Scheduler (useMatchScheduler.ts)
  └─▸ Writes to: /match_scores.courtId, /match_scores.scheduledTime

Cloud Function Scheduler (functions/src/scheduling.ts)
  └─▸ Writes to: /matches.courtId, /matches.scheduledTime
```

**Problem**: Two different scheduling systems writing to different collections. Court management reads from `/matches` but scoring reads from `/match_scores`.

#### Issue: Court Assignment
```
Court Management (TournamentDashboardView.vue)
  └─▸ Reads/Writes: /matches.courtId

Scoring Interface (ScoringInterfaceView.vue)
  └─▸ Reads: /match_scores.courtId
```

**Problem**: Court assignments in `/matches` may not reflect in scoring interface if it's reading from `/match_scores`.

### 2.3 Missing Real-Time for Scores

**Current Implementation**:
```typescript
// matches.ts - subscriptions
subscribeMatches() {
  onSnapshot(qMatch, () => refresh());  // Subscribes to /match
  // NO subscription to /match_scores!
}
```

**Impact**:
- Public live scores show **stale data**
- Multi-scorer scenarios have **no real-time sync**
- Score updates require **page refresh** to see

**Affected Views**:
- `PublicLiveScoresView.vue` - shows outdated scores
- `PublicBracketView.vue` - no live score updates
- Multiple scorekeepers can't see each other's updates

### 2.4 Scalability Limits

#### Batch Write Limit
```typescript
// useBracketGenerator.ts
const batch = writeBatch(db);
// ... adds ALL entities to one batch
await batch.commit();  // ❌ Fails if > 500 operations
```

**Breakdown for 32-player tournament**:
- 1 stage
- 3 groups (WB, LB, Finals)
- ~10 rounds
- 31 matches
- 31 match_games
- 32 participants
- **Total: ~108 writes** ✅

**Breakdown for 128-player tournament**:
- ~500+ writes ❌ **EXCEEDS LIMIT**

#### Query Limits
```typescript
// matches.ts
where('stage_id', 'in', stageIds)  // ❌ Max 10 items
```

**Problem**: Tournaments with >10 categories will fail to fetch matches.

#### Heavy Refresh Pattern
```typescript
// On EVERY match update:
onSnapshot(qMatch, () => {
  refresh();  // Re-fetches ALL:
  // - stage, match, participant, round, group
});
```

**Problem**: O(N²) complexity. With 200 matches, each update triggers 200+ reads.

---

## 3. Module-by-Module Analysis

### 3.1 Scoring Module

**Components**:
- `ScoringInterfaceView.vue`
- `matches.ts` store methods: `startMatch`, `updateScore`, `submitManualScores`

**Data Flow**:
```
User Action
  ↓
Optimistic write to /match_scores
  ↓
Call updateMatch Cloud Function
  ↓
Cloud Function updates /match (brackets-manager)
  ↓
Bracket progression (if match complete)
```

**Issues**:
1. **Split writes**: Scores in `/match_scores`, status in `/match`
2. **No transactions**: If CF fails after score write, data is inconsistent
3. **No real-time**: Other clients don't see score updates
4. **Race conditions**: Last-write-wins for concurrent scorers

**Scalability**: ⚠️ Medium risk - works for single scorer, breaks with multiple

### 3.2 Public Views

**Components**:
- `PublicBracketView.vue` - Read-only bracket display
- `PublicLiveScoresView.vue` - Live scoreboard

**Data Flow**:
```
PublicBracketView
  └─▸ fetchMatches() - ONE TIME fetch
  └─▸ No real-time subscription

PublicLiveScoresView
  └─▸ subscribeMatches() - Real-time for /match
  └─▸ NO subscribe for /match_scores
```

**Issues**:
1. **Stale scores**: Public views don't see live scoring updates
2. **Inconsistent data**: Bracket shows match status but not current scores
3. **No WebSocket**: Long polling would be more efficient

**Scalability**: ✅ Read-only scales well, but stale data hurts UX

### 3.3 Scheduling Module

**Components**:
- `useMatchScheduler.ts` (client)
- `functions/src/scheduling.ts` (Cloud Function)

**Data Flow**:
```
Client Scheduler
  └─▸ Reads: /match, /courts
  └─▸ Algorithm assigns courts
  └─▸ Writes: /match_scores.courtId, /courts.status

Cloud Function Scheduler
  └─▸ Reads: /matches (legacy)
  └─▸ Writes: /matches.courtId
```

**Issues**:
1. **Dual scheduling**: Two different algorithms, two data destinations
2. **Court status divergence**: `/courts` updated but `/matches` may differ
3. **No conflict resolution**: What if both schedulers run?

**Scalability**: ⚠️ Medium risk - scheduling conflicts likely at scale

### 3.4 Registration Flow

**Components**:
- `RegistrationManagementView.vue`
- `SelfRegistrationView.vue`
- `registrations.ts` store

**Data Flow**:
```
Registration
  └─▸ Writes: /registrations, /players
  └─▸ Status: pending → approved

Bracket Generation
  └─▸ Reads: /registrations (approved/checked_in)
  └─▸ Creates bracket entities
```

**Issues**:
1. **No validation**: Can generate bracket with unapproved registrations
2. **No sync**: If registration cancelled after bracket creation, no automatic handling

**Scalability**: ✅ Works fine, but lacks data integrity constraints

---

## 4. Scalability Assessment

### 4.1 Current Limits

| Metric | Current Limit | Breaking Point | Risk Level |
|--------|--------------|----------------|------------|
| Matches per tournament | ~200 | 500+ batch writes | ⚠️ Medium |
| Categories per tournament | 10 | 10 (query limit) | ❌ High |
| Concurrent scorers | 1 | 2+ (race conditions) | ❌ High |
| Real-time viewers | ~50 | 100+ (heavy refresh) | ⚠️ Medium |
| Batch write size | 500 | 500 (hard limit) | ❌ High |
| Query "in" clause | 10 items | 10 (hard limit) | ❌ High |

### 4.2 Performance Characteristics

**Small Tournament (< 50 matches)**
- ✅ Fast bracket generation
- ✅ Responsive UI
- ✅ Real-time updates work
- ✅ Single scorer works fine

**Medium Tournament (50-200 matches)**
- ⚠️ Slow bracket generation (large batch)
- ⚠️ UI lag on match updates (heavy refresh)
- ⚠️ Public scores may lag
- ❌ Multiple scorers conflict

**Large Tournament (200+ matches)**
- ❌ Bracket generation fails (batch limit)
- ❌ UI unusable (constant re-fetching)
- ❌ Public views timeout
- ❌ System unstable

---

## 5. Decision Points

### Decision 1: Bracket Generation Strategy

**Option A: Client-Side Only**
- **Pros**: Fast, simple, no network dependency
- **Cons**: 500 batch limit, no server validation, ID conversion complexity
- **Best for**: Small tournaments (< 100 players), demo mode, offline support

**Option B: Cloud Function Only**
- **Pros**: No batch limits, server validation, consistent IDs
- **Cons**: Slower (network), more complex error handling
- **Best for**: Production, large tournaments, data integrity critical

**Option C: Hybrid with Smart Routing**
- Small tournaments (< 64 players): Client-side
- Large tournaments (64+ players): Cloud Function
- **Pros**: Optimized for each size
- **Cons**: More complex, two code paths to maintain

**Recommendation**: **Option B** - Cloud Function only for production. Remove client-side generation to eliminate ID mismatch issues.

---

### Decision 2: Data Model Unification

**Option A: Complete Migration to Brackets-Manager Schema**
- Use `/match` for all match data
- Extend brackets-manager schema with custom fields
- Deprecate `/matches` and `/match_scores`
- **Pros**: Single source of truth, clean architecture
- **Cons**: Major refactoring, data migration required

**Option B: Clear Separation of Concerns**
- `/match`: Bracket structure only (brackets-manager)
- `/match_scores`: Scores + scheduling (operational)
- Remove `/matches` entirely
- **Pros**: Clean boundaries, minimal changes
- **Cons**: Two collections to manage

**Option C: Legacy Support Mode**
- Keep all three collections
- Add sync layer to keep them consistent
- **Pros**: Backward compatible
- **Cons**: Complex, error-prone, technical debt

**Recommendation**: **Option B** - Clear separation. `/match` for bracket structure, `/match_scores` for operational data. Migrate `/matches` features to `/match_scores`.

---

### Decision 3: Real-Time Strategy

**Option A: Add /match_scores Subscription**
- Subscribe to `/match_scores` changes
- Update UI in real-time
- **Pros**: Live scores work
- **Cons**: More Firestore reads ($$$)

**Option B: Optimistic UI with Polling**
- Keep optimistic updates
- Poll for score changes every 5-10 seconds
- **Pros**: Cheaper, simpler
- **Cons**: Not truly real-time

**Option C: WebSocket/Ably/Pusher**
- Use dedicated real-time service
- **Pros**: Best performance, scalable
- **Cons**: Additional cost, infrastructure

**Recommendation**: **Option A** for now (Firestore subscription), **Option C** for future scale.

---

### Decision 4: Scalability Improvements

**Priority 1: Fix Immediate Issues**
1. ✅ Fix ID type mismatches (already done)
2. ✅ Fix match_game.parent_id (already done)
3. Add `/match_scores` subscription
4. Fix query limits (pagination)

**Priority 2: Architecture Cleanup**
1. Choose ONE bracket generation path
2. Migrate `/matches` to `/match_scores`
3. Add transactions for score updates
4. Implement proper error handling

**Priority 3: Performance Optimization**
1. Implement cursor-based pagination
2. Add field-level subscriptions
3. Use Firestore data bundles for large tournaments
4. Consider read replicas for public views

---

## 6. Implementation Roadmap

### Phase 1: Critical Fixes (1-2 weeks)
- [ ] Add `/match_scores` real-time subscription
- [ ] Fix query limits with pagination
- [ ] Add error boundaries for Cloud Function failures
- [ ] Document current architecture

### Phase 2: Data Model Unification (2-4 weeks)
- [ ] Choose bracket generation strategy
- [ ] Migrate `/matches` usage to `/match_scores`
- [ ] Remove `/matches` collection
- [ ] Update all Cloud Functions

### Phase 3: Performance & Scale (4-6 weeks)
- [ ] Implement pagination for large tournaments
- [ ] Add transactions for concurrent scoring
- [ ] Optimize real-time subscriptions
- [ ] Load testing

### Phase 4: Future Enhancements (Ongoing)
- [ ] WebSocket integration
- [ ] Caching layer (Redis)
- [ ] Read replicas
- [ ] Analytics pipeline

---

## 7. Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Data inconsistency between collections | High | High | Unify data model, add transactions |
| Race conditions in multi-scorer | High | Medium | Add transactions, optimistic locking |
| Batch write limit exceeded | Medium | High | Use Cloud Function, chunk writes |
| Query limit exceeded | Medium | High | Implement pagination |
| Stale public scores | High | Medium | Add real-time subscriptions |
| Cloud Function failures | Low | High | Add retries, fallback to client |
| ID mismatch bugs | Medium | High | Standardize on string IDs |

---

## 8. Recommendations Summary

### Immediate Actions (This Week)
1. **Test the ID fixes** - Regenerate bracket and verify "Start Match" works
2. **Add /match_scores subscription** - Fix stale public scores
3. **Document the dual paths** - Prevent future confusion

### Short Term (Next 2 Weeks)
1. **Choose bracket generation strategy** - Decision needed
2. **Migrate court management** - Move from `/matches` to `/match_scores`
3. **Add transactions** - Prevent race conditions

### Medium Term (Next Month)
1. **Unify data model** - Remove `/matches` collection
2. **Implement pagination** - Handle large tournaments
3. **Load testing** - Verify performance at scale

### Long Term (Next Quarter)
1. **WebSocket integration** - True real-time updates
2. **Caching layer** - Reduce Firestore costs
3. **Analytics** - Tournament insights

---

## 9. Questions for Stakeholders

1. **What is the expected tournament size?** (Max players, max categories)
2. **Will there be multiple scorekeepers per match?**
3. **Is offline support required?** (affects client-side vs Cloud Function)
4. **What is the budget for infrastructure?** (affects real-time strategy)
5. **Timeline for production?** (affects scope of changes)
6. **Do we need to support legacy data migration?**

---

## 10. Appendix

### A. File Locations

**Client-Side Bracket Generation**:
- `src/composables/useBracketGenerator.ts`
- `src/stores/bracketMatchAdapter.ts`
- `src/stores/matches.ts`

**Cloud Function Bracket Generation**:
- `functions/src/bracket.ts`
- `functions/src/storage/firestore-adapter.ts`

**Scoring**:
- `src/features/scoring/views/ScoringInterfaceView.vue`
- `src/stores/matches.ts`
- `functions/src/updateMatch.ts`

**Scheduling**:
- `src/composables/useMatchScheduler.ts`
- `functions/src/scheduling.ts`

**Public Views**:
- `src/features/public/views/PublicBracketView.vue`
- `src/features/public/views/PublicLiveScoresView.vue`

### B. Collection Schema Details

See individual store files for complete schema definitions.

### C. Glossary

- **brackets-manager**: Third-party library for tournament bracket management
- **FirestoreAdapter**: Custom adapter to use Firestore with brackets-manager
- **InMemoryDatabase**: In-memory storage for brackets-manager (client-side)
- **Match**: A single game/match in a tournament
- **Match Game**: Individual game within a best-of series (BO3)
- **Stage**: Tournament phase (e.g., "Main Event")
- **Group**: Bracket section (Winners, Losers, Finals)

---

**Document Version**: 1.0  
**Last Updated**: January 30, 2026  
**Next Review**: After stakeholder decisions
