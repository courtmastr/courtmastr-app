# Quick Task 260319-iec: Expand Ready Queue min-height

## Objective
Expand the Ready Queue panel to show at least 4 matches without scrolling.

## Task
- **File:** `src/features/tournaments/views/MatchControlView.vue`
- **Change:** `.mc-panel--queue` `min-height: 0` → `min-height: 320px`
- **Why:** Each queue item is ~70px + header ~40px = 320px for 4 items
