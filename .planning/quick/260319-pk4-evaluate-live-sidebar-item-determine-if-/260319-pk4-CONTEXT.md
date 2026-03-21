# Quick Task 260319-pk4: Live View Scoreboard Page - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Task Boundary

Create a read-only Live Scoreboard page at `/tournaments/:id/live-view` and make the sidebar "Live View" nav item only visible when the tournament is in LIVE state. Remove the current broken redirect behavior.

</domain>

<decisions>
## Implementation Decisions

### Live View Content
- Read-only scoreboard showing in-progress matches with live scores
- NOT the Command Center (courts grid + queue + alerts)
- NOT the OBS overlay (that's for streaming)
- Organizer-facing — uses regular app layout, not transparent overlay

### Nav Visibility
- Sidebar "Live View" item: only show when tournament state is `LIVE`
- Currently shows for all organizers regardless of state — change this

### Route Behavior
- `/tournaments/:id/live-view` → new `LiveScoringView.vue` (no redirect)
- Remove the current redirect to `match-control?view=queue`

### Claude's Discretion
- Component structure: single view file, reuse existing stores (matchStore, tournamentStore)
- Look at ObsScoreboardView.vue for reference on how in-progress match data is fetched/displayed — but use app-native styling (Vuetify), not the OBS transparent overlay styling
- Style: match the app's visual language (dark surface cards, green accent etc.)

</decisions>

<specifics>
## Specific Ideas

- Reference: `src/features/obs/views/ObsScoreboardView.vue` shows how in-progress match data is fetched — reuse the same data approach but with Vuetify components
- Reference: `src/features/tournaments/components/CourtCard.vue` for match display patterns
- Nav condition: check `tournament.value?.state === 'LIVE'` — same pattern used in MatchControlView.vue:1175
- The sidebar Live View nav item is in `src/components/navigation/AppNavigation.vue` around line 181
- Router entry to update: `src/router/index.ts` lines 310-313 (currently a redirect, needs to be a proper component route)

</specifics>

<canonical_refs>
## Canonical References

No external specs — requirements fully captured in decisions above.
</canonical_refs>
