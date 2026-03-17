# Event Center Redesign — Design Spec

**Date:** 2026-03-16
**Status:** Approved
**Primary User:** Tournament Organizer (no other roles access this view)

---

## Problem

The current `TournamentDashboardView` tries to be everything at once: pre-event setup checklist, live match operations, post-event analytics, and public-facing sponsor strip — all on one screen. The organizer drowns in noise mid-tournament when they need to act fast.

**Core question this redesign answers:** *"What does an organizer need right now, while running a live event?"*

---

## What We're Building

A focused organizer dashboard for the **in-progress tournament lifecycle state**. Clean, premium, fast to scan. Removes everything that isn't about running the event right now.

---

## Visual Style

**"Crisp Command"** — hybrid of two directions:
- **Canvas:** Clean white (#fff) with light grey (#f8fafc) background — readable under venue lighting
- **Numbers:** Heavy weight (800) for all stat figures — instant at a glance
- **Accents:** Colored stat cards (orange for live, green for complete, purple for queue) with subtle tinted backgrounds
- **CTAs:** Deep blue (#1d4ed8) with shadow lift (`box-shadow: 0 4px 14px rgba(29,78,216,0.32)`)
- **Status indicators:** Pulsing green dot for LIVE, orange dot for in-progress status
- **Typography:** System font stack, tight letter-spacing on labels, uppercase section headers

---

## Layout

```
┌─────────────────────────────────────────────────────────┐
│  HEADER: Tournament name · date · location   [LIVE] [Manage ▾] │
├──────────┬──────────┬──────────┬──────────────────────────┤
│ Players  │ Live Now │ Complete │ In Queue                 │
│   81     │    3     │   62%    │   12                     │
├──────────┴──────────┴──────────┴──────────────────────────┤
│  STATUS: In Progress — Round 3 of 5    [⚡ Enter Match Control] │
├─────────────────────────────────────────────────────────┤
│  📋 Check-in  🏆 Brackets  📡 Live View  🥇 Leaderboard  🔗 Share │
├─────────────────────────────┬───────────────────────────┤
│  ACTIVE MATCHES (3fr)        │  READY QUEUE (2fr)        │
│  Court 1 – MS·R3·M4         │  1. MS·R3·M5  [Start]     │
│  Chen Wei vs Park Jun-ho    │  2. WS·R2·M3  [Start]     │
│  15 – 12  [Score] [Done]    │  3. MD·R2·M8  [Start]     │
│                             │  9 more…  View all →      │
│  Court 2 – WD·R2·M7         ├───────────────────────────┤
│  Kim/Lee vs Nguyen/Tran      │  CATEGORY PROGRESS        │
│  8 – 6    [Score] [Done]    │  Men's Singles   75% ████ │
│                             │  Women's Doubles 38% ██   │
│  Court 3 – MX·R1·M11        │  Mixed Doubles   50% ███  │
│  Johnson/Smith vs Patel/Raj │                           │
│  Full Match Control →       │                           │
└─────────────────────────────┴───────────────────────────┘
```

---

## Sections

### 1. Header Band
- Tournament name (large, 800 weight)
- Date · venue · sport (subtitle)
- **LIVE badge** (green dot, pulsing animation) — shown when status = `in_progress`
- **Manage dropdown** — lifecycle actions: Start, Complete, Delete tournament. Print/Export/Settings moved here as overflow items.
- No sponsor strip (belongs on public page, not organizer dashboard)

### 2. Stats Row (4 cards)
Full-width, 4 equal columns, separated by dividers:

| Card | Value | Color | Background |
|------|-------|-------|------------|
| Players | Total registered | neutral (#0f172a) | white |
| Live Now | Active matches | orange (#ea580c) | #fff7ed |
| Complete | % of total matches done | green (#16a34a) | #f0fdf4 |
| In Queue | Matches ready to call | purple (#7c3aed) | #f5f3ff |

### 3. Status + CTA Bar
- Left: eyebrow label "Tournament Status" + current status text with colored dot
- Right: primary action button "⚡ Enter Match Control" (deep blue, shadow)
- This is the single most important element — always above the fold

### 4. Quick Links Row
Horizontal pill-style links for the pages organizers jump to most:
- 📋 Check-in
- 🏆 Brackets
- 📡 Live View
- 🥇 Leaderboard
- 🔗 Share Links (leads to public bracket/schedule/overlay links)

### 5. Operations — Two-Column (3fr : 2fr)

**Left: Active Matches panel** (reuses `ActiveMatchesSection` component)
- Court + match ID
- Player names
- Current score
- [Score] button → opens score entry
- [Done] button → marks match complete
- Footer: "Full Match Control →" link

**Right column (stacked):**

**Ready Queue panel** (reuses `ReadyQueue` component)
- Numbered list of next matches (show top 3)
- [Start] button on each → assigns to a court
- Footer: "N more — View all →"

**Category Progress panel** (new, lightweight)
- One row per category: name + fraction (done/total) + progress bar
- Bar colors: green/orange/blue cycling per category
- No actions — read-only progress indicator

---

## What's Removed

| Removed | Rationale |
|---------|-----------|
| Sponsor strip | Public-facing, not organizer tool |
| Organizer Checklist | Pre-event setup — show only during `draft`/`registration` status |
| Event Insights / MatchStatsDashboard | Analytics are post-event — move to a Reports page |
| Info strip (sport, categories, courts, duration) | Static config that doesn't change mid-event — move to tournament settings |
| Print / Export / Settings header buttons | Rarely used mid-event — fold into Manage dropdown |

---

## Lifecycle Behavior

The Event Center must adapt to tournament status:

| Status | Changes |
|--------|---------|
| `draft` / `registration` | Show Organizer Checklist instead of operations panels; hide LIVE badge; hide Active Matches / Queue |
| `in_progress` | Full layout as designed above; show LIVE badge |
| `completed` | Hide LIVE badge; hide Active Matches / Queue; show link to Reports/Analytics |

---

## Component Reuse

| Component | Action |
|-----------|--------|
| `ActiveMatchesSection` | Keep, adjust styling to match new design tokens |
| `ReadyQueue` | Keep, adjust styling |
| `MatchStatsDashboard` | Move — render only on a separate Reports page or post-event |
| `OrganizerChecklist` | Move — render only during `draft`/`registration` |
| `ScoringQrDialog` | Keep — launched from Score button |
| `TournamentAnnouncementCardDialog` | Keep — accessible from Manage dropdown |

New component needed:
- `CategoryProgressPanel` — read-only bar chart of matches complete per category

---

## Non-Goals

- Mobile layout (out of scope for this redesign — organizers use laptop/tablet at venue)
- Real-time score entry UI changes (Match Control redesign is a separate project)
- Analytics / Reports page (separate project)
- Public tournament page (separate project)
