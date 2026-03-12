# Public Player Schedule View — Design

**Date:** 2026-03-04
**Status:** Approved

---

## Context

Players attending a tournament currently need to log in to see their personal match schedule. This is friction: not everyone has an account, and during a live event players just want to quickly check "when is my next match?". There is already a public schedule page (`/tournaments/:id/schedule`) and a public bracket page (`/tournaments/:id/bracket`), but neither surfaces a player-centric view.

The goal is a new **public, no-login page** where any player can search their name and immediately see: their next match, their full schedule, their bracket position, and their score history.

---

## Approach: Lightweight filter view (Approach A)

New route + new view component that reuses existing public data loading patterns and components. Client-side name search across tournament registrations. No new backend logic required.

**Rejected alternatives:**
- Approach B (dedicated Firestore composable): Premature optimization; client-side filtering is fine for typical tournament sizes.
- Approach C (extend existing `/schedule` page): User wants a clean, separate player-facing page.

---

## Route

```
/tournaments/:tournamentId/player
```

- **Public** — no `requiresAuth` in router meta
- New file: `src/features/public/views/PublicPlayerView.vue`
- New router entry in `src/router/index.ts` alongside other public tournament routes

---

## Page Sections

### 1. Tournament Header
- Tournament name (reuse pattern from `PublicScheduleView`)
- Brief description if available

### 2. Name Search
- Text input, debounced (300ms), minimum 2 characters
- Persisted in URL query param `?q=Alice+Chen` for shareability
- Searches across all registrations in the tournament by resolving participant names via `useParticipantResolver`

### 3. Disambiguation List (name collision)
- Shown when search returns multiple players
- Displays: player name, category name, participant type (singles/doubles)
- User selects their entry → view updates

### 4. Next Match Card (highlighted)
- First upcoming match where `plannedStartAt` is in the future (or match is `ready`/`in_progress`)
- Shows: time, court, opponent name, category, round
- If no scheduled time yet: shows "Round X — Time TBD"
- If `scheduleStatus === 'draft'`: shows time as "Tentative"
- If no upcoming matches: shows appropriate end state ("Tournament complete", "All matches played")

### 5. Full Schedule List
- All matches for the selected registration, sorted by `plannedStartAt`
- Grouped into: **Upcoming** and **Played**
- Each row: time • court • opponent • result (if played) • status icon
- "TBD" for rounds without assigned times yet

### 6. Bracket Section
- Embeds `SmartBracketView` pre-filtered to the player's category (and level if applicable)
- Read-only — player can see bracket structure and their progression
- Collapsible to keep the page scannable

---

## Data Flow

```
Mount
  → fetchTournament(tournamentId) [from useTournamentStore]
  → subscribeRegistrations(tournamentId) [from useRegistrationStore, real-time]
  → subscribeMatches(tournamentId) [existing pub pattern, real-time]

User types name
  → debounce 300ms
  → for each registration: useParticipantResolver.getParticipantName(reg.id)
  → filter by case-insensitive partial match
  → if 1 result: auto-select
  → if multiple: show disambiguation list
  → if 0: show "No players found"

Player selected
  → selectedRegistrationId = reg.id
  → myMatches = matches.filter(m =>
      m.participant1Id === selectedRegistrationId ||
      m.participant2Id === selectedRegistrationId
    )
  → nextMatch = first myMatch where status ∈ ['scheduled','ready','in_progress']
               with plannedStartAt > now (or status === 'in_progress')
  → render sections
```

---

## Components to Reuse

| Component / Composable | File | Usage |
|---|---|---|
| `useParticipantResolver` | `src/composables/useParticipantResolver.ts` | Resolve registration IDs → display names |
| `useTournamentStore` | `src/stores/tournaments.ts` | Tournament + category data |
| `useRegistrationStore` | `src/stores/registrations.ts` | All registrations for name search |
| `useMatchStore` | `src/stores/matches.ts` | Match data with real-time subscription |
| `SmartBracketView` | `src/features/brackets/components/SmartBracketView.vue` | Bracket display |
| `PublicScheduleView` patterns | `src/features/public/views/PublicScheduleView.vue` | Tournament header, Firestore sub patterns |

---

## Edge Cases

| Scenario | Behavior |
|---|---|
| No matches scheduled yet | Shows "No matches scheduled yet" in schedule section |
| `scheduleStatus === 'draft'` | Times shown as "Tentative HH:MM" (italic/muted) |
| No `plannedStartAt` | Shows "Round X — Time TBD" |
| Match `in_progress` | Next Match card shows live indicator |
| All matches completed | Shows final standings summary, no "next match" card |
| Player not found | Empty state with helpful message |
| Tournament not found | 404 error state (same pattern as `PublicBracketView`) |
| Doubles registration | Shows team/partner names correctly |

---

## Real-time Updates

Use Firestore `onSnapshot` listeners (same pattern as `PublicScheduleView`) so the page updates live as:
- Match statuses change (ready → in_progress → completed)
- Courts are assigned
- Times are updated

Unsubscribe on component `onUnmounted`.

---

## URL Design

- `/tournaments/:id/player` — blank, shows search
- `/tournaments/:id/player?q=Alice` — pre-fills search with "Alice"
- `/tournaments/:id/player?q=Alice+Chen&reg=reg-abc123` — pre-selects a specific registration after disambiguation

The `?reg=` param enables deep-linkable player views (organizer could paste/share a link directly to a player's schedule).

---

## Full Tournament Schedule

The existing `/tournaments/:id/schedule` page already handles the full tournament view and remains unchanged. Players who want to see all matches can access it via a "View Full Tournament Schedule" link at the bottom of the player page. Conversely, the schedule page gains a "My Schedule" button in its header linking to the player page.

## Code Reusability

Match subscription + player search logic is extracted into `src/composables/usePlayerSchedule.ts` — a standalone composable that can be consumed by any future view (admin player detail, mobile view, etc.).

## Files to Create / Modify

| Action | File |
|---|---|
| **Create** | `src/composables/usePlayerSchedule.ts` — reusable player match composable |
| **Create** | `src/features/public/views/PublicPlayerView.vue` |
| **Modify** | `src/router/index.ts` — add new public route |
| **Modify** | `src/features/public/views/PublicScheduleView.vue` — add "My Schedule" nav button |

---

## Verification

1. Navigate to `/tournaments/:tournamentId/player` without logging in → page loads
2. Type a player name → results appear within 300ms debounce
3. With two players of same name → disambiguation list appears
4. Select player → next match card, schedule list, and bracket render correctly
5. When a match goes live (status changes) → page updates without refresh
6. With `?q=Alice+Chen` in URL → search pre-fills and auto-selects if single match
7. With `?q=Alice+Chen&reg=reg-abc123` → specific player directly loaded
