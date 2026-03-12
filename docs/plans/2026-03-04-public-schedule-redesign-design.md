# Public Schedule Page Redesign — Design

**Date:** 2026-03-04
**Status:** Approved

---

## Context

The current `PublicScheduleView.vue` is a 1,699-line component with two modes (Activity and Display) that mixes live activity, category stats, admin-oriented filters, and a flat list of all matches. The result is visually noisy and not useful for the primary audience: players and spectators at or following the event.

Key problems with current design:
- Category Pulse section adds clutter without clear value to public users
- Three-column search/filter row is admin-oriented (player dropdown, team dropdown, text search) — this functionality now belongs on the `/player` page
- The flat match list grouped by category is hard to scan and doesn't clearly communicate time-order
- Recent Results is a separate section that duplicates data already in the match list
- The page tries to be a live scoreboard AND a full schedule at once, succeeding at neither

---

## Audience

**Spectators + players (mixed):**
- Players at/before the event: need to see the full schedule (when is my match, what court, who am I playing)
- Spectators: want to see what's happening right now and what's coming up
- Both groups: want it to work well on a phone

---

## Redesign: Three-Zone Layout

### Zone 1: Header

```
MCIA Badminton 2026
Live Schedule
[All]  [Men's Doubles]  [Men's Singles]  [Mixed Doubles]
                              [Display Mode] [My Schedule] [Brackets →]
```

- Tournament name + subtitle
- Category filter chips (All + one per category) — filters all zones below
- Action buttons: Display Mode (wall screen), My Schedule (→ `/player`), Brackets (→ `/bracket`)
- Auto-refresh note as subtitle text ("Auto-refreshing" inline, not a full banner card)

### Zone 2: Live Activity (top of page, conditional)

**NOW PLAYING** — only shown when ≥1 match is `in_progress`
- Responsive grid: 2-3 columns on desktop, 1 column on mobile
- Each court card: court name, participant 1 name, "vs", participant 2 name, category name, green LIVE badge
- If no matches in progress: section is hidden entirely (not shown as "No matches")

**UP NEXT** — always shown
- Compact list, max 8 items
- Each row: `[time] · [court] · [Player A vs Player B] · [category]`
- Sorted by `plannedStartAt`
- If empty: "No upcoming matches" empty state

### Zone 3: Full Schedule

- Table/list of **ALL published matches** sorted by `plannedStartAt` ascending
- Columns: **Time** · **Court** · **Match** (Player/Team A vs B) · **Category** · **Status badge**
- Status badges: `LIVE` (green), `Ready` (amber), scheduled (neutral time), `Finished` (grey checkmark), `Cancelled` (strikethrough)
- Completed matches show at the top (earlier time = first) with a faded/grey row style
- "No schedule published yet" empty state if no matches have `scheduleStatus === 'published'`
- Replaces both the old flat match list AND the separate Recent Results section

---

## What's Removed

| Removed | Reason |
|---|---|
| Category Pulse section | Admin-oriented, no value to public |
| Three-column search/filter (text search, player dropdown, team dropdown) | Moved to `/player` page |
| Separate "Recent Results" section | Completed matches are visible in Full Schedule |
| `displayMode` split view (Activity vs Display) | Keep Display Mode button but simplify to one mode |
| Auto-refresh banner card | Replace with inline subtitle text |

---

## What's Kept

| Kept | Where |
|---|---|
| Category chip filters | Top of page, filters all zones |
| Now Playing section | Zone 2, shown only when live matches exist |
| Up Next section | Zone 2, compact list |
| Display Mode button | Header actions |
| My Schedule button | Header actions → `/player` page |
| Real-time Firestore subscriptions | Same `onSnapshot` patterns |

---

## Data Sources (reuse existing)

The current `PublicScheduleView.vue` already subscribes to:
- Tournament + categories (`useTournamentStore`)
- Registrations (`useRegistrationStore`)
- Matches with `scheduleStatus === 'published'` via Firestore listener

All of this data is reused. The redesign is purely **UI layer changes** — no new composables, no new Firestore queries, no new stores.

**Key computed values to reuse:**
- `nowPlayingItems` — matches with `status === 'in_progress'`
- `upNextItems` — matches with `status in ['ready', 'scheduled']` sorted by `plannedStartAt`
- `filteredMatches` — all published matches filtered by `selectedCategoryId`
- `getParticipantName` via `useParticipantResolver`

---

## Display Mode

The existing "Display Mode" (large-screen wall display) is kept via the `?view=display` query param and `setDisplayMode()` toggle. The Display Mode view is a separate fullscreen layout and is **not changed** in this redesign.

---

## Mobile Responsiveness

- NOW PLAYING: `grid-template-columns: repeat(auto-fill, minmax(280px, 1fr))`
- UP NEXT: single column list, full width
- FULL SCHEDULE: on mobile, collapse to card list (hide Court column, show time inline)

---

## File to Modify

| Action | File |
|---|---|
| **Modify** | `src/features/public/views/PublicScheduleView.vue` |

The redesign is a **template-only rewrite** of the non-Display-Mode template section (~lines 862–1700). The `<script setup>` stays mostly intact — some unused computed properties are removed, but no new data fetching logic is added.

---

## Verification

1. Navigate to `/tournaments/:id/schedule` without login → page loads
2. Category chips filter all three zones correctly
3. NOW PLAYING cards appear only when matches are in_progress; hidden when none
4. UP NEXT shows next ~8 matches sorted by time
5. FULL SCHEDULE shows all published matches sorted by time with correct status badges
6. "My Schedule" button links to `/player` page
7. "Brackets →" button links to `/bracket` page
8. Real-time updates: change a match status in admin → page updates without refresh
9. Display Mode still works via the button
10. Mobile: test at 375px width — layout stacks cleanly
