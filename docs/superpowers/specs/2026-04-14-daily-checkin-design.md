# Per-Day Player Check-In — Design Spec

**Date:** 2026-04-14
**Status:** Approved for implementation
**Branch:** feat/pool-cut-advance (or new branch)
**GitHub Issue:** courtmastr/courtmastr-app#33

---

## Context

CourtMastr already has a full check-in system (individual, doubles, kiosk, volunteer). The missing piece is **per-day check-in**: if a player has matches on multiple tournament days, they must check in fresh each day. The current `status = 'checked_in'` is permanent once set — a player who checked in on Day 1 will still show as checked in on Day 2.

**Use case driving this:** Multi-day tournaments where pool play runs on Day 1 and elimination runs on Day 2. Directors need to know who is actually present and ready each morning.

**Doubles rule:** Both partners must check in individually. The team registration only becomes `checked_in` when both are present (existing `participantPresence` behavior — unchanged).

---

## Scope

### In scope
- New `DailyCheckIn` type and `dailyCheckIns` field on `Registration`
- Update `applyVolunteerCheckInAction` Cloud Function to write `dailyCheckIns[today]`
- Update `submitSelfCheckIn` Cloud Function to write `dailyCheckIns[today].presence`
- New scheduled Cloud Function `resetDailyCheckIns` that resets status to `approved` at midnight for players with matches the next day

### Out of scope (v1)
- UI changes — the existing check-in dashboard, front desk view, and kiosk are unchanged
- Per-day check-in stats or history views
- Manual per-day reset by the tournament director
- Multi-timezone support (v1 runs at 06:00 UTC, covering US timezones)

---

## Data Model Changes

**File:** `src/types/index.ts`

### New type

```typescript
export interface DailyCheckIn {
  checkedInAt: Date;
  source: 'admin' | 'kiosk';
  presence?: Record<string, boolean>; // doubles: playerId → present
}
```

### Added to `Registration` interface

```typescript
dailyCheckIns?: Record<string, DailyCheckIn>; // key: "YYYY-MM-DD" in tournament local timezone
```

All existing fields (`status`, `isCheckedIn`, `participantPresence`, `checkedInAt`, `checkInSource`) remain unchanged — they are the live read fields that the UI and store already consume. `dailyCheckIns` is an append-only historical log.

---

## Check-in Write Path

Two Cloud Functions need to be updated. No store or UI changes.

### Admin path — `applyVolunteerCheckInAction` (`functions/src/index.ts`)

On `check_in` action, in addition to existing writes:
- Write `dailyCheckIns[today] = { checkedInAt: now, source: 'admin' }`
- For doubles registrations: include `presence: { [playerId]: true }` (merge with existing entry for that date, in case partner already checked in)

### Kiosk path — `submitSelfCheckIn` (`functions/src/index.ts`)

In addition to existing `participantPresence` update:
- Merge `dailyCheckIns[today].presence[playerId] = true`
- When all required participants are present → also set `dailyCheckIns[today].checkedInAt = now` and `source: 'kiosk'`

### Undo / no-show paths

No change to `dailyCheckIns`. The log is append-only. Undo operations only affect the live `status` field.

---

## New Cloud Function: `resetDailyCheckIns`

**File:** `functions/src/index.ts`

**Schedule:** `every day 06:00 UTC`
This covers midnight for US timezones (UTC-8 to UTC-5). Acceptable for v1; full multi-timezone support would require per-tournament scheduling.

**Logic:**
1. Query all tournaments where `status !== 'completed'`
2. For each tournament, find matches where `plannedStartAt` falls within the upcoming calendar day (midnight → midnight in tournament local time, defaulting to `America/Chicago`)
3. Collect the registration IDs of players in those matches (via `registrationId` on each match)
4. For each collected registration with `status = 'checked_in'` or `'no_show'`, batch-write:
   - `status → 'approved'`
   - `isCheckedIn → false`
   - `checkedInAt → FieldValue.delete()`
   - `checkInSource → FieldValue.delete()`
   - `participantPresence → {}` (clears partial doubles presence)
5. Skip registrations with `status = 'pending' | 'rejected' | 'withdrawn'`
6. Use Firestore batch writes (max 500 per batch) for efficiency

**Edge cases handled:**
- Player has no matches tomorrow → not in query → not reset → stays `checked_in` (correct, they're done)
- Match has no `plannedStartAt` → excluded from reset query
- No active tournaments → no-op
- Firestore batch limit → chunk into groups of 500

---

## Doubles Handling

The existing `deriveRegistrationStatusFromPresence()` and `participantPresence` map already enforce "both must be present for team to be `checked_in`". No logic changes needed.

**Additions specific to per-day:**
- On each partner check-in, merge `dailyCheckIns[today].presence[playerId] = true`
- When second partner completes presence, stamp `dailyCheckIns[today].checkedInAt`
- Midnight reset clears `participantPresence → {}` so partial presence (one partner only) does not carry forward to the next day — both partners must check in again

---

## Files Changed

| File | Action | Notes |
|------|--------|-------|
| `src/types/index.ts` | Modify | Add `DailyCheckIn` type + `dailyCheckIns` field to `Registration` |
| `functions/src/index.ts` | Modify | Update `applyVolunteerCheckInAction` to write `dailyCheckIns` |
| `functions/src/index.ts` | Modify | Update `submitSelfCheckIn` to write `dailyCheckIns` presence |
| `functions/src/index.ts` | Modify | Add `resetDailyCheckIns` scheduled function |

No UI changes. No store changes. No composable changes.

---

## Verification

### Happy path — single player, 2-day tournament
1. Player has matches April 14 and April 15
2. Staff checks in on April 14 → `status = 'checked_in'`, `dailyCheckIns["2026-04-14"]` written
3. `resetDailyCheckIns` fires at 06:00 UTC → player has matches on April 15 → reset to `approved`
4. Check-in dashboard shows player as not checked in on April 15
5. Staff checks in again → `dailyCheckIns["2026-04-15"]` written

### Happy path — doubles, 2-day tournament
1. Partner A checks in → `participantPresence[A] = true`, `dailyCheckIns[today].presence[A] = true`, status stays `approved`
2. Partner B checks in → `participantPresence[B] = true`, status → `checked_in`, `dailyCheckIns[today].checkedInAt` stamped
3. Midnight reset → `participantPresence → {}`, status → `approved` for both players' team registration
4. Both must check in again the next day

### Edge cases
- Player with no matches tomorrow → not reset → stays `checked_in` (correct — they're done)
- No-show on Day 1, has matches Day 2 → midnight resets to `approved` → staff can check in or mark no-show again
- Tournament with no scheduled matches → reset query finds nothing, no-op
- Doubles: only one partner checked in at midnight → `participantPresence` cleared, team starts fresh next day

### Unit tests
- `resetDailyCheckIns`: given a set of matches and registrations, verify correct subset is reset and others untouched
- Admin check-in: `dailyCheckIns[today]` written alongside existing status update
- Kiosk check-in (doubles): `dailyCheckIns[today].presence` merged for each partner; `checkedInAt` stamped only when both present
