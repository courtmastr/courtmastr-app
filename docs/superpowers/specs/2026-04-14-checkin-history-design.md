# Check-In History Tab — Design Spec

**Date:** 2026-04-14
**Status:** Approved for implementation
**Branch:** feat/pool-cut-advance

---

## Context

The `dailyCheckIns` audit log was added to `Registration` documents as part of the per-day check-in feature. Each registration now accumulates a keyed history of who checked in on which day and via which channel. No UI currently surfaces this data. Directors and volunteers need to answer "who checked in today?" at a glance.

---

## Scope

### In scope
- A **History tab** added to the existing `FrontDeskCheckInView` (used by both the admin route `/checkin` and the volunteer kiosk route `/checkin-kiosk`)
- Fetch `dailyCheckIns` data from Firestore when the tab is opened, plus a manual Refresh button
- Per-day view defaulting to today, with ‹ / › arrows to navigate to previous days
- Row display: player name, category, source chip (admin / kiosk), timestamp
- Partial doubles shown in amber with "waiting for partner" label
- Fully checked-in rows shown with a green left-border accent

### Out of scope
- Real-time / live updates (no `onSnapshot` — fetch-on-demand only)
- Exporting or printing the history
- Filtering by category or source
- Admin-only vs volunteer visibility distinction (same view for both)

---

## Data Source

`Registration.dailyCheckIns` — already written by `applyVolunteerCheckInAction` and `submitSelfCheckIn`.

```typescript
// On each Registration document
dailyCheckIns?: Record<string, DailyCheckIn>; // key: "YYYY-MM-DD" America/Chicago

interface DailyCheckIn {
  checkedInAt?: Date;                       // undefined = partial doubles
  source: 'admin' | 'kiosk';
  presence?: Record<string, boolean>;       // doubles: playerId → present
}
```

To build the history list for a given day the view:
1. Fetches all registrations for the tournament that have a `dailyCheckIns[dateKey]` entry
2. For each registration, reads `dailyCheckIns[dateKey].checkedInAt` and `.source`
3. A missing `checkedInAt` on a registration with a `presence` map = partial doubles

Player names are resolved from the existing `players` subcollection (already loaded in the registrations store).

---

## Architecture

### New composable: `useCheckInHistory`

**File:** `src/features/checkin/composables/useCheckInHistory.ts`

Pure fetch composable — no store, no reactivity beyond local state.

```typescript
interface CheckInHistoryRow {
  registrationId: string;
  displayName: string;       // team name, or "Player A / Player B", or "Player A"
  categoryName: string;
  checkedInAt: Date | null;  // null = partial
  source: 'admin' | 'kiosk' | 'partial';
  isPartial: boolean;        // true when doubles partner hasn't checked in yet
}

interface UseCheckInHistoryReturn {
  rows: Ref<CheckInHistoryRow[]>;         // sorted most-recent-first; partial rows at bottom
  loading: Ref<boolean>;
  error: Ref<string | null>;
  selectedDate: Ref<Date>;                // the day being viewed
  dateKey: ComputedRef<string>;           // "YYYY-MM-DD" for selectedDate
  canGoForward: ComputedRef<boolean>;     // false when selectedDate is today
  goBack(): void;
  goForward(): void;
  refresh(): Promise<void>;              // re-fetches for current dateKey
}
```

Fetch logic:
- On `refresh()`, call `getDocs()` against the registrations subcollection filtered to registrations that have a `dailyCheckIns` map (client-side filter — no new Firestore index needed since the full registrations list is already loaded in the store)
- Use the store's already-loaded `registrations` and `players` arrays as the source — no extra Firestore reads
- `selectedDate` starts as `new Date()` (today in local time)
- `dateKey` computed using `Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago' }).format(selectedDate)` — same pattern as `formatDateKey` in the backend, duplicated here to avoid importing a backend module into the frontend

### New component: `CheckInHistoryPanel`

**File:** `src/features/checkin/components/CheckInHistoryPanel.vue`

Accepts no props — reads from `useCheckInHistory()` internally. Renders:

1. **Date nav bar** — ‹ button, date label + count, › button (disabled on today), Refresh button
2. **v-list** (`density="comfortable"`) — one `v-list-item` per row
   - Left-border: `success` (green) for fully checked in, `warning` (amber) for partial
   - Prepend: nothing (clean)
   - Title: `displayName`
   - Subtitle: `categoryName` — for partial: append `· waiting for partner` in amber
   - Append: source chip (`variant="tonal"`, `size="small"`) + timestamp (`checkedInAt` formatted as `h:mm A`)
3. **Source chip colors:**
   - `admin` → `color="primary"` (blue tonal)
   - `kiosk` → `color="success"` (green tonal)
   - `partial` → `color="warning"` (amber tonal)
4. **Empty state:** "No check-ins recorded for this day" with a mdi-calendar-blank icon
5. **Loading state:** `v-progress-linear` at top of list

### Modified component: `FrontDeskCheckInView`

**File:** `src/features/checkin/views/FrontDeskCheckInView.vue`

Add a `v-tabs` / `v-tab` bar between the toolbar and the existing mode-toggle content:

```
[ Check In ]  [ History ]
```

- When **Check In** tab is active: existing Rapid/Bulk content unchanged
- When **History** tab is active: render `<CheckInHistoryPanel />`
- Tab switch triggers `useCheckInHistory().refresh()` if the history hasn't been loaded yet for the current date

No changes to routing, store, or Cloud Functions.

---

## Row Sorting

Within a day:
1. Fully checked-in rows — sorted by `checkedInAt` descending (most recent first)
2. Partial doubles rows — appended at the bottom, sorted by the earliest presence timestamp descending

---

## Date Navigation

- `selectedDate` initialises to today (`new Date()`)
- `goBack()` subtracts one calendar day
- `goForward()` adds one calendar day; `canGoForward` is `false` when `selectedDate` is already today
- Each navigation triggers `refresh()` automatically
- Date label format: `"EEE MMM d"` + `"· Today"` suffix when showing today

---

## Files Changed

| File | Action |
|------|--------|
| `src/features/checkin/composables/useCheckInHistory.ts` | Create |
| `src/features/checkin/components/CheckInHistoryPanel.vue` | Create |
| `src/features/checkin/views/FrontDeskCheckInView.vue` | Modify — add tab bar + conditional render |

No store changes. No route changes. No Cloud Function changes.

---

## Verification

1. Volunteer enters PIN → lands on kiosk → taps **History** tab → sees today's check-ins
2. Rows sorted most-recent-first; partial doubles in amber at bottom
3. Tapping **‹** shows yesterday's log; **›** is disabled on today
4. Tapping **Refresh** re-fetches without a page reload
5. Admin at `/checkin` sees the same History tab with the same behaviour
6. Empty state shown when no check-ins exist for the selected day
