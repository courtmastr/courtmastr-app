---
phase: quick
plan: 260319-hnd
subsystem: match-control-ui
tags: [layout, css, command-center, ready-queue]
dependency_graph:
  requires: []
  provides: [wider-ready-queue-sidebar]
  affects: [MatchControlView]
tech_stack:
  added: []
  patterns: [css-grid]
key_files:
  created: []
  modified:
    - src/features/tournaments/views/MatchControlView.vue
key_decisions:
  - "Changed .mc-body sidebar column from 320px to 420px; Courts grid uses 1fr so it auto-shrinks with no regressions"
metrics:
  duration: "~3 minutes"
  completed: "2026-03-19"
  tasks_completed: 1
  files_changed: 1
---

# Quick Task 260319-hnd: Widen Ready Queue Sidebar in Command Center Summary

**One-liner:** Increased `.mc-body` CSS grid sidebar column from 320px to 420px giving Ready Queue 100px extra width while Courts grid auto-adjusts via `1fr`.

## What Was Done

Single CSS change in `MatchControlView.vue` — the `.mc-body` grid rule that controls the Command Center two-column layout.

| Before | After |
|--------|-------|
| `grid-template-columns: 1fr 320px` | `grid-template-columns: 1fr 420px` |

## Decisions Made

- No responsive/media-query rules referenced the old 320px value, so only one line required updating.
- The `1fr` left column (Courts grid) absorbs the 100px reduction in available width automatically — no other layout changes needed.

## Deviations from Plan

None — plan executed exactly as written.

## Verification

- `grep -n "grid-template-columns.*420px"` returns line 2357 with the updated value.
- `grep -n "grid-template-columns.*320px"` returns no hits.

## Self-Check: PASSED

- Modified file confirmed present at `src/features/tournaments/views/MatchControlView.vue`
- Commit `c4d4a6d` confirmed in git log
