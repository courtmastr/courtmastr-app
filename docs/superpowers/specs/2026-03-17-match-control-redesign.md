# Match Control — Command Center Redesign

**Date:** 2026-03-17
**Type:** UI-only (no backend / store / Firestore changes)
**Branch:** feat/global-players-org-platform (or new feature branch)
**Reference style:** Event Center "Crisp Command" (TournamentDashboardView.vue)

---

## Goal

Redesign the Match Control **Command Center** tab to match the "Crisp Command" premium style shipped with the Event Center redesign — white canvas, `#f1f5f9` background, bold 800-weight numbers, orange/green/blue accent stat cards, and deep-blue CTAs with the signature box-shadow.

---

## Scope

### In scope
- MatchControlView.vue — toolbar, progress strip, stat bar, command strip, layout, tab structure
- CourtCard.vue — card visual redesign
- ReadyQueue.vue — minor style polish
- AlertsPanel.vue — minor style polish

### Out of scope
- All Matches tab — stays exactly as-is
- Backend, Firestore, stores — no changes
- Live View tab — removed from tab toggle (already lives in sidebar nav as a separate page)

---

## Design Tokens (match Event Center exactly)

| Token | Value |
|---|---|
| Page background | `#f1f5f9` |
| Card/surface | `#fff` |
| Border | `1px solid #e2e8f0` |
| Card radius | `10px` (panels), `8px` (court cards) |
| Stat number weight | `800` |
| Stat number size | `22–24px` |
| Stat label | `10px`, uppercase, `#94a3b8`, `letter-spacing: 0.6px` |
| Orange accent bg | `#fff7ed` / number `#ea580c` |
| Green accent bg | `#f0fdf4` / number `#16a34a` |
| Blue accent bg | `#eff6ff` / number `#1d4ed8` |
| CTA button shadow | `box-shadow: 0 4px 14px rgba(29,78,216,0.32)` |
| LIVE badge | `#dcfce7` bg, `#86efac` border, `#15803d` text |

---

## Layout

```
┌─ Toolbar (50px) ──────────────────────────────────────────────────────┐
│ ← Match Control  [tournament name]  [health chip]  [category ▾]  tabs │
├─ Progress strip (28px) ───────────────────────────────────────────────┤
│ 34/50 complete  ████████████░░░░░░  68%                               │
├─ Stat bar ────────────────────────────────────────────────────────────┤
│  Courts │ Live Now │ Free Courts │ In Queue │ Complete %              │
├─ Command strip (40px) ────────────────────────────────────────────────┤
│ [Auto-assign toggle]                           [📅 Re-Schedule btn]   │
├─ Body (#f1f5f9 bg) ───────────────────────────────────────────────────┤
│  ┌─ Courts panel (flex 1) ──────┐  ┌─ Sidebar (320px) ─────────────┐ │
│  │  3-col court card grid       │  │  Ready Queue (flex 1)          │ │
│  │                              │  │  Alerts Panel (auto height)    │ │
│  └──────────────────────────────┘  └───────────────────────────────┘ │
└───────────────────────────────────────────────────────────────────────┘
```

---

## Section Specs

### 1. Toolbar

Existing `v-toolbar` — update styling only, keep all existing logic.

- Height: `50px`
- Elements (left → right): back button · "Match Control" title · tournament name (muted) · `v-spacer` · health chip · **category filter** (v-select, 200px, hidden when `viewMode === 'schedule'` — existing logic kept) · tab toggle
- Tab toggle: remove the "Live View" button (`value="queue"`), keep "Command Center" (`value="command"`) and "All Matches" (`value="schedule"`)
- Also remove the entire `v-else-if="viewMode === 'queue'"` template block — this layout is no longer reachable
- Update the `viewMode` ref type from `'queue' | 'courts' | 'schedule' | 'command'` to `'schedule' | 'command'` (one-line TypeScript change to keep the build clean)
- Health chip: styled as pill badge matching LIVE badge style

### 2. Progress Strip

New thin row between toolbar and stat bar. Replaces the existing standalone progress strip.

- Height: `28px`, `background: #fff`, `border-bottom: 1px solid #e2e8f0`
- Content: `"X/Y complete"` label · flex progress bar (green fill, `#16a34a`) · `"X%"` label
- Uses existing `stats.completed`, `stats.total`, `completionPercent` computeds — no new data

### 3. Stat Bar

New row of 5 accent stat cards, full-width grid. Matches `ec-stats` pattern exactly.

| # | Label | Value | Accent |
|---|---|---|---|
| 1 | Courts | `courts.length` (total courts, not available) | none (neutral) |
| 2 | Live Now | `stats.inProgress` | orange |
| 3 | Free Courts | `availableCourts.length` | green |
| 4 | In Queue | `pendingMatches.length` | blue |
| 5 | Complete % | `completionPercent` | slate |

All data already exists in the view — no new computeds needed.

### 4. Command Strip

Slim row with exactly two elements:

- **Auto-assign toggle** (existing `v-switch`, keep all existing logic)
- **Re-Schedule button** (existing button, keep all existing logic) — floated right with deep-blue CTA shadow

Remove the redundant "X waiting" and "X courts free" chips — that information is already in the stat bar.

### 5. Courts Panel (left column)

Wrapper card with header ("Courts" title + "X Free" + "X In Use" chips). Contains the existing `<CourtGrid>` component — no changes to CourtGrid itself.

**CourtCard.vue redesign:**

| State | Left border | Background | Status badge |
|---|---|---|---|
| LIVE | `#16a34a` (4px) | `linear-gradient(135deg, #fff 65%, #f0fdf4)` | green pill |
| READY | `#1d4ed8` (4px) | `linear-gradient(135deg, #fff 65%, #eff6ff)` | blue pill |
| FREE | `#e2e8f0` (4px) | `#fafafa` | grey pill |
| BLOCKED | `#f97316` (4px) | `#fff7ed` + `opacity: 0.8` | orange pill |

Additional card changes:
- **Status badge** moves to header (court name + badge in same row)
- **Live score** displayed as large bold number (`17px/800`) in green, right-aligned beside player name
- **Timer** shown as small caption; turns orange + bold when match overruns (> 50 min threshold, already in existing logic)
- **Category** shown as 10px muted caption below players
- **Actions**: Score/Start button (primary blue), Release (ghost red), Assign (ghost green) — same logic, updated styles

### 6. Right Sidebar

#### Ready Queue
Styled list rows with:
- Rank number `#1`, `#2`…
- Player names (bold, truncated) + category/round/time meta
- Ready/Scheduled badge
- Assign button (primary blue, per-item) — shown when `enableAssign` is true

#### Alerts Panel
Compact panel below queue:
- Colored dot indicator (orange = warning, red = error)
- Alert text + sub-text
- "View →" action link

Both use existing component props/events — style-only changes.

---

## Tab Behaviour

| Tab | viewMode value | What renders |
|---|---|---|
| Command Center | `'command'` | Stat bar + command strip + courts grid + sidebar |
| All Matches | `'schedule'` | Existing schedule view — unchanged |

The `'queue'` viewMode (Live View tab) is **removed entirely**. The `v-else-if="viewMode === 'queue'"` block in the template is deleted along with the tab button. The sidebar-nav route `/tournaments/:id/live-view` is a separate page and continues to work as before — this spec does not touch it. The `viewMode` ref type is narrowed from `'queue' | 'courts' | 'schedule' | 'command'` → `'schedule' | 'command'`.

---

## Files Changed

| File | Change type |
|---|---|
| `src/features/tournaments/views/MatchControlView.vue` | Template restructure + SCSS update |
| `src/features/tournaments/components/CourtCard.vue` | Style-only update |
| `src/features/tournaments/components/ReadyQueue.vue` | Minor style polish |
| `src/features/tournaments/components/AlertsPanel.vue` | Minor style polish |

No new files. No new components. No new props, emits, or composables.

---

## Non-Goals

- No changes to All Matches tab layout or functionality
- No changes to any dialog components
- No changes to any store, composable, or Firebase function
- No new TypeScript types
- No routing changes (Live View route in sidebar nav untouched)
