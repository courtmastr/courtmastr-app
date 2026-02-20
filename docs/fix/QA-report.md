# QA Report - Tournament Management Application (courtmaster-v2)

**Date**: February 15, 2026
**Testing Type**: End-to-End UI/UX Review (Organizer Lens)
**Tester**: GPT-5.2 Thinking (Senior Technical PM & QA Lead)
**Environment**: Localhost (Dev)

**Project Context**

* **Tech Stack**

  * Frontend: Next.js 14, React, TypeScript
  * Styling: Tailwind CSS, shadcn/ui
  * Backend: Next.js Route Handlers (App Router)
  * Database: PostgreSQL via Prisma
  * Hosting: (TBD; design for Vercel/CloudRun parity)
* **Code Structure**

  * Repo: (assumed) monorepo
  * Pages: `src/app/(protected)/tournaments/[id]/[module]/page.tsx`
  * Components: `src/components/`
  * API routes: `src/app/api/`
  * Prisma: `prisma/schema.prisma`, `prisma/migrations/*`

---

## Table of Contents

* [SECTION 1: QA EXECUTIVE REPORT](#section-1-qa-executive-report)
* [SECTION 2: JIRA-STYLE TICKETS](#section-2-jira-style-tickets)

  * [TOURNEY-001](#tourney-001)
  * [TOURNEY-002](#tourney-002)
  * [TOURNEY-003](#tourney-003)
  * [TOURNEY-004](#tourney-004)
  * [TOURNEY-101](#tourney-101)
  * [TOURNEY-102](#tourney-102)
  * [TOURNEY-103](#tourney-103)
  * [TOURNEY-104](#tourney-104)
  * [TOURNEY-105](#tourney-105)
  * [TOURNEY-106](#tourney-106)
  * [TOURNEY-201](#tourney-201)
  * [TOURNEY-202](#tourney-202)
  * [TOURNEY-203](#tourney-203)
  * [TOURNEY-204](#tourney-204)
  * [TOURNEY-205](#tourney-205)
  * [TOURNEY-206](#tourney-206)
  * [TOURNEY-207](#tourney-207)
  * [TOURNEY-208](#tourney-208)
* [Quick Reference](#quick-reference)

---

# SECTION 1: QA EXECUTIVE REPORT

## Executive Summary

Target scale: **128–150 entrants**, staff on **laptops**, sport: **badminton**, format defaults to **21 x best-of-3**, but organizer must configure (e.g., 15 x 3, 21 x 1). **No walk-ins/late adds**.

* **Total Issues Found**: 18
* **Critical (P0)**: 4 — Blocks workflows or undermines trust/data
* **High (P1)**: 6 — Major live-ops UX impact at 150 entrants
* **Medium (P2)**: 6 — Consistency & information architecture problems
* **Low (P3)**: 2 — Polish / clarity improvements

**Estimated Total Effort**: ~34–42 story points (~14–18 person-days)
**Recommended Timeline**: 4 weeks

## Issue Breakdown by Category

1. **Critical Bugs**: 4

   * Court busy/total calculation inconsistent with courts list
   * Reports match duration metric incorrect/untrusted
   * Participants navigation routes incorrectly / ambiguous IA
   * Missing lifecycle lock rules (scoring & bracket changes risk)

2. **UX/Accessibility**: 6

   * Horizontal scroll tables everywhere
   * Unlabeled filters/inputs (placeholder-as-label)
   * Button hierarchy flat (too many “primary” actions)
   * Check-in row action overload (too many buttons per row)
   * Mouse-first workflow (no keyboard-first for laptop ops)
   * Setup vs Live ops mixed

3. **Data Consistency**: 4

   * Match numbering ambiguity across categories/rounds
   * Court list mismatch between pages/modules
   * Score format changes not guarded by lock state
   * No audit trail for scoring/no-show/court assignment edits

4. **Navigation/Architecture**: 4

   * Duplicate nav items; inconsistent link vs tab styling
   * Breadcrumb labeling inconsistent
   * Global vs local search unclear
   * Missing Command Center view (Court Grid + Queue + Alerts)

## Key Findings (Most Important Themes)

* **Live Ops needs a Command Center**: court grid + ready queue + alerts. Current pages are data-heavy but not execution-optimized.
* **Trust is fragile**: incorrect reports and mismatched court stats will make organizers distrust the system instantly.
* **Consistency is killing speed**: unlabeled filters + horizontal scrolling + inconsistent navigation slows staff under pressure.
* **State machine is mandatory**: bracket/scoring must lock to prevent mid-event chaos.

## Recommended Prioritization

**Phase 1 (Week 1)**: Critical blockers

* TOURNEY-001, TOURNEY-002, TOURNEY-003, TOURNEY-004

**Phase 2 (Week 2–3)**: Live ops execution speed + systematic UX

* TOURNEY-101, 102, 103, 104, 105, 106

**Phase 3 (Week 4+)**: Consistency, auditability, polish

* TOURNEY-201, 202, 203, 204, 205, 206, 207, 208

---

# SECTION 2: JIRA-STYLE TICKETS

---

## <a id="tourney-001"></a>**Ticket ID**: TOURNEY-001

**Type**: Bug
**Priority**: P0-Critical
**Effort**: 5 (Story Points)
**Component**: Match Control
**Sprint**: Phase 1

### Title

Fix incorrect court busy/total stats

### Description

**As a** tournament organizer
**I want** accurate “Busy / Total” court stats
**So that** I can make correct live operational decisions

### Current Behavior

1. Navigate to `src/app/(protected)/tournaments/[id]/match-control/page.tsx`
2. View Match Control header/summary
3. Court summary displays confusing counts (e.g., “1 / 3 Busy”) while court configuration indicates 4 courts exist
4. Courts shown/available may not match actual courts list

**Actual Result**: Court summary is inconsistent with configured courts
**Expected Result**: Court summary shows **Busy X / Total N**, where N = enabled courts count

### Acceptance Criteria

* [ ] Total courts count equals number of enabled courts in DB for tournament
* [ ] Busy count equals number of courts currently assigned to matches with status `in_progress` (or equivalent)
* [ ] Court IDs used in Match Control come from same source as Courts page
* [ ] Display format is “Busy: X / Total: N”
* [ ] Accessible labels for court stats (screen reader)
* [ ] Manual testing complete

### Technical Details

**Files to Modify**:

* `src/app/(protected)/tournaments/[id]/match-control/page.tsx` — consume court stats and render correctly
* `src/components/match-control/CourtSummary.tsx` (create if missing) — UI component
* `src/app/api/tournaments/[id]/courts/stats/route.ts` — add stats endpoint (or extend existing courts route)
* `src/app/api/tournaments/[id]/matches/route.ts` — ensure match status/court assignment query supports “in_progress”

**API Changes Required**: Yes — add `/courts/stats` (or equivalent)
**Database Changes Required**: No (assumes courts and matches already exist)
**Component Dependencies**:

* Uses match status enum and court assignment fields

### Implementation Guidance

**Approach**:

* Create a single source of truth endpoint returning:

  * `totalCourts`
  * `busyCourts`
  * `idleCourts`
  * optional: `busyCourtIds`
* Busy logic:

  * Busy = court assigned to a match with `status === 'in_progress'` (or `started_at != null && completed_at == null`)
* Ensure court count respects `enabled = true`

**Key Considerations**

* Handle tournaments with 1..N courts
* Handle matches without court assigned
* Avoid double-counting if data is corrupted (same court assigned to multiple in-progress matches). If detected, raise alert badge.

**Pattern/Reference**

* Follow existing route handler + Prisma query patterns in `src/app/api/tournaments/[id]/*`

### Testing Instructions

**Manual Testing Steps**

1. Create tournament with 4 courts enabled
2. Open `/tournaments/{id}/match-control`
3. Verify shows `Busy: 0 / Total: 4`
4. Start/mark 2 matches as `in_progress` on Court 1 and Court 2
5. Verify shows `Busy: 2 / Total: 4`
6. Complete one match
7. Verify shows `Busy: 1 / Total: 4`
8. Disable Court 4
9. Verify shows `Busy: 1 / Total: 3`

**Test Cases**

* [ ] Happy path: correct counts with clean data
* [ ] Edge: 0 courts (should show Total 0 + safe messaging)
* [ ] Edge: in-progress match without court assigned (busy unchanged)
* [ ] Keyboard navigation: tab to summary, screen reader label reads correctly
* [ ] Mobile viewport: readable (even if staff is laptop-first)

**Regression Check**

* Court CRUD still works
* Assigning courts to matches still works
* Match Control page loads without errors

### Dependencies

**Blocked By**: None
**Blocks**: TOURNEY-101 (Command Center relies on accurate court stats), TOURNEY-207 (Alerts)

### Definition of Done

* [ ] Code changes implemented
* [ ] All acceptance criteria met
* [ ] Manual testing completed (all test cases pass)
* [ ] No console errors or warnings
* [ ] Responsive design verified (mobile/tablet/desktop)
* [ ] Code reviewed
* [ ] Merged to main branch
* [ ] Deployed to staging
* [ ] Product owner/QA sign-off

### AI Coder Prompt (Ready to Copy)

```text
TASK: Fix incorrect court busy/total stats

CONTEXT:
- Project: courtmaster-v2 Tournament Management App
- Tech: Next.js 14, TypeScript, Tailwind, shadcn/ui, PostgreSQL, Prisma
- Ticket: TOURNEY-001

PROBLEM:
Match Control shows incorrect court busy/total counts (e.g., “1 / 3 Busy”) that do not match the actual configured courts list.

SOLUTION:
Create or extend an API endpoint to return court stats for the tournament:
- totalCourts = count of enabled courts
- busyCourts = count of distinct courts assigned to matches with status='in_progress'
Render as “Busy: X / Total: N” in Match Control using a shared CourtSummary component.

ACCEPTANCE CRITERIA:
- Total equals enabled courts in DB
- Busy equals distinct courts used by in_progress matches
- Court list in Match Control uses same source as Courts page
- Accessible labels + no console errors
- Manual tests pass for 1, 4, 8, 16 courts

FILES TO CHANGE:
- src/app/(protected)/tournaments/[id]/match-control/page.tsx
- src/components/match-control/CourtSummary.tsx (create if missing)
- src/app/api/tournaments/[id]/courts/stats/route.ts
- src/app/api/tournaments/[id]/matches/route.ts (if needed for status/court query)

CONSTRAINTS:
- Do not change court CRUD behavior
- Use Prisma (no raw SQL)
- Keep existing match status semantics

TEST AFTER IMPLEMENTATION:
- Create 4 courts, verify Busy 0 / Total 4
- Start 2 in-progress matches on Court 1 & 2, verify Busy 2 / Total 4
- Complete one, verify Busy 1 / Total 4
- Disable a court, verify total updates
```

---

## <a id="tourney-002"></a>**Ticket ID**: TOURNEY-002

**Type**: Bug
**Priority**: P0-Critical
**Effort**: 5 (Story Points)
**Component**: Reports
**Sprint**: Phase 1

### Title

Fix invalid match duration metrics in reports

### Description

**As a** tournament organizer
**I want** trustworthy match duration metrics
**So that** I can evaluate operations and court utilization

### Current Behavior

1. Navigate to `src/app/(protected)/tournaments/[id]/reports/summary/page.tsx`
2. Observe “Avg match duration” displays unrealistic value (e.g., 1243 minutes)
3. There is no clear unit definition or calculation details

**Actual Result**: Reports show incorrect values; credibility damaged
**Expected Result**: Reports show correct duration in minutes + median + min/max; tooltips define calculation

### Acceptance Criteria

* [ ] Avg duration is calculated from match start/end timestamps (or configured duration if no timestamps)
* [ ] Show Avg + Median + Min + Max (minutes)
* [ ] Missing timestamps handled gracefully (excluded or estimated explicitly)
* [ ] Tooltips explain calculations
* [ ] No negative or absurd values
* [ ] Manual testing complete

### Technical Details

**Files to Modify**:

* `src/app/(protected)/tournaments/[id]/reports/summary/page.tsx`
* `src/components/reports/DurationMetrics.tsx` (create if missing)
* `src/app/api/tournaments/[id]/reports/summary/route.ts` (create/extend)
* `prisma/schema.prisma` (only if timestamps missing on Match model)

**API Changes Required**: Yes (ensure reports endpoint returns duration stats)
**Database Changes Required**: Possibly (only if match timestamps not available)
**Component Dependencies**:

* Match model fields: `startedAt`, `endedAt` (or equivalent)

### Implementation Guidance

**Approach**

* Prefer real observed durations: `endedAt - startedAt`
* Exclude matches without both timestamps from observed set
* If observed set is empty:

  * Display “Not enough data yet” (do not fabricate)
* Provide separate “Configured duration” metric using tournament setting `matchDurationMinutes`

**Key Considerations**

* Timezones: use UTC in DB; convert to local for display if needed
* Protect against `endedAt < startedAt`
* Use integer minutes rounded properly

**Pattern/Reference**

* Use Prisma aggregate queries or compute server-side in route handler

### Testing Instructions

**Manual Testing Steps**

1. Create 3 completed matches with startedAt/endedAt values
2. Open reports summary page
3. Verify Avg/Median/Min/Max match expected calculations
4. Add a match with missing endedAt → verify excluded and no crash
5. Add a match with invalid timestamps → verify excluded and log warning

**Test Cases**

* [ ] Happy path with valid timestamps
* [ ] Edge: no completed matches → show “Not enough data”
* [ ] Edge: missing timestamps → excluded/flagged
* [ ] Performance: 300 matches computes quickly (<500ms server)

**Regression Check**

* Reports page still renders other sections
* Exports (CSV) still work if present

### Dependencies

**Blocked By**: None
**Blocks**: TOURNEY-208 (Report definitions/tooltips polish depends on correct metrics)

### Definition of Done

* [ ] Code changes implemented
* [ ] All acceptance criteria met
* [ ] Manual testing completed (all test cases pass)
* [ ] No console errors or warnings
* [ ] Responsive design verified (mobile/tablet/desktop)
* [ ] Code reviewed
* [ ] Merged to main branch
* [ ] Deployed to staging
* [ ] Product owner/QA sign-off

### AI Coder Prompt (Ready to Copy)

```text
TASK: Fix invalid match duration metrics in reports

CONTEXT:
- Project: courtmaster-v2
- Tech: Next.js 14, TypeScript, Tailwind, Prisma/Postgres
- Ticket: TOURNEY-002

PROBLEM:
Reports summary shows unrealistic avg match duration (e.g., 1243 min). Metrics are untrusted.

SOLUTION:
Compute duration stats from Match timestamps:
- observedDurationMinutes = (endedAt - startedAt) in minutes for completed matches with both timestamps
Return avg/median/min/max; exclude invalid/missing.
If no observed data, display “Not enough data yet”. Add tooltip definitions.

ACCEPTANCE CRITERIA:
- Avg/median/min/max correct and in minutes
- Missing/invalid timestamps handled safely
- Tooltips explain calculations
- No absurd/negative values

FILES TO CHANGE:
- src/app/(protected)/tournaments/[id]/reports/summary/page.tsx
- src/app/api/tournaments/[id]/reports/summary/route.ts (create/extend)
- src/components/reports/DurationMetrics.tsx (create if missing)
- prisma/schema.prisma (only if timestamps missing)

CONSTRAINTS:
- Use Prisma, no raw SQL
- Do not change match scoring logic
- Prefer observed durations over configured

TEST AFTER IMPLEMENTATION:
- Create completed matches with timestamps -> verify stats
- Create completed match missing endedAt -> excluded
- No matches -> show “Not enough data”
```

---

## <a id="tourney-003"></a>**Ticket ID**: TOURNEY-003

**Type**: Story
**Priority**: P0-Critical
**Effort**: 13 (Story Points)
**Component**: Tournament Lifecycle / Guardrails
**Sprint**: Phase 1

### Title

Add tournament lifecycle state machine and locks

### Description

**As a** tournament organizer
**I want** the system to enforce lifecycle states and locks
**So that** I don’t accidentally break brackets/scoring during live play

### Current Behavior

1. Tournament pages show “active” but do not indicate setup vs live phases
2. Scoring settings and bracket operations appear accessible even during live ops
3. No explicit “Bracket locked” or “Scoring locked” guardrails

**Actual Result**: Organizers can create chaos by changing critical settings mid-event
**Expected Result**: Lifecycle states guide actions; bracket/scoring/roster locked at appropriate times

### Acceptance Criteria

* [ ] Tournament has lifecycle state persisted in DB (enum)
* [ ] UI displays state badge/banner everywhere in tournament context
* [ ] Bracket lock prevents:

  * roster changes (no walk-ins)
  * seeding changes
  * scoring format changes
* [ ] Unlock requires admin override confirmation (typed)
* [ ] State transitions are explicit with clear CTAs
* [ ] Manual testing complete

### Technical Details

**Files to Modify**

* `prisma/schema.prisma` — add `TournamentState` enum + `state` field on Tournament
* `src/app/api/tournaments/[id]/state/route.ts` — endpoint to get/update state (admin-only)
* `src/app/(protected)/tournaments/[id]/layout.tsx` — surface state badge/banner
* `src/app/(protected)/tournaments/[id]/settings/page.tsx` — enforce lock
* `src/app/(protected)/tournaments/[id]/brackets/page.tsx` — enforce lock
* `src/app/(protected)/tournaments/[id]/registrations/page.tsx` — enforce roster lock after close
* `src/components/tournament/StateBanner.tsx` — new component
* `src/lib/guards/tournamentState.ts` — central guard helpers

**API Changes Required**: Yes
**Database Changes Required**: Yes (state field + optional timestamps)
**Component Dependencies**

* Auth/roles to restrict state changes

### Implementation Guidance

**Approach**

* Add enum states: `DRAFT`, `REG_OPEN`, `REG_CLOSED`, `SEEDING`, `BRACKET_GENERATED`, `BRACKET_LOCKED`, `LIVE`, `COMPLETED`
* Use guard helper:

  * `assertCanEditScoring(state)`
  * `assertCanEditBracket(state)`
  * `assertCanEditRoster(state)`
* UI:

  * Banner shows state and “Next step” CTA
  * Disabled controls show tooltip “Locked because bracket locked”

**Key Considerations**

* No walk-ins means roster lock can be strict after `REG_CLOSED` or `BRACKET_GENERATED`
* If you must allow emergency override, require typed confirmation + log audit (see TOURNEY-202)

### Testing Instructions

**Manual Testing Steps**

1. Create tournament (DRAFT)
2. Move to REG_OPEN → verify registrations enabled
3. Move to REG_CLOSED → verify add/approval flows align
4. Generate bracket → state BRACKET_GENERATED
5. Lock bracket → state BRACKET_LOCKED
6. Attempt to change scoring format → blocked with message
7. Attempt to change seeds → blocked
8. Attempt to add participant → blocked
9. Override unlock with typed confirmation → allowed and logged

**Test Cases**

* [ ] Happy path transitions
* [ ] Unauthorized user cannot change state
* [ ] Locked states block critical edits
* [ ] UI communicates “why disabled”
* [ ] Regression: normal scoring still works in LIVE

**Regression Check**

* Existing tournament pages still render
* State banner does not break layout

### Dependencies

**Blocked By**: None
**Blocks**: TOURNEY-103 (scoring lock), TOURNEY-106 (checklist), TOURNEY-202 (audit trail), TOURNEY-207 (alerts can use state)

### Definition of Done

* [ ] Code changes implemented
* [ ] All acceptance criteria met
* [ ] Manual testing completed (all test cases pass)
* [ ] No console errors or warnings
* [ ] Responsive design verified (mobile/tablet/desktop)
* [ ] Code reviewed
* [ ] Merged to main branch
* [ ] Deployed to staging
* [ ] Product owner/QA sign-off

### AI Coder Prompt (Ready to Copy)

```text
TASK: Add tournament lifecycle state machine and locks

CONTEXT:
- Project: courtmaster-v2
- Tech: Next.js 14, TypeScript, Prisma/Postgres, Tailwind, shadcn/ui
- Ticket: TOURNEY-003

PROBLEM:
Tournament UI mixes setup/live and allows critical changes (scoring, bracket, roster) without lock rules.

SOLUTION:
Add Tournament.state enum persisted in DB. Implement guard helpers to block:
- roster changes after REG_CLOSED/BRACKET_GENERATED (no walk-ins)
- seeding changes after BRACKET_LOCKED
- scoring format changes after BRACKET_LOCKED
Expose state banner in tournament layout with clear transitions and “why disabled” tooltips.

ACCEPTANCE CRITERIA:
- State persists and shown on all tournament pages
- Bracket lock blocks roster/seeding/scoring edits
- Admin override requires typed confirmation + logs (hook for audit)
- Manual tests pass for transitions

FILES TO CHANGE:
- prisma/schema.prisma
- src/app/api/tournaments/[id]/state/route.ts
- src/app/(protected)/tournaments/[id]/layout.tsx
- src/components/tournament/StateBanner.tsx
- src/lib/guards/tournamentState.ts
- Enforce in settings/brackets/registrations pages

CONSTRAINTS:
- Do not break existing routes
- Use Prisma, avoid raw SQL
- Keep state logic centralized in guards

TEST AFTER IMPLEMENTATION:
- Walk through DRAFT -> REG_OPEN -> REG_CLOSED -> BRACKET_GENERATED -> BRACKET_LOCKED -> LIVE
- Verify edits blocked/unblocked correctly with clear UI messaging
```

---

## <a id="tourney-004"></a>**Ticket ID**: TOURNEY-004

**Type**: Bug
**Priority**: P0-Critical
**Effort**: 3 (Story Points)
**Component**: Navigation / Information Architecture
**Sprint**: Phase 1

### Title

Fix Participants navigation and canonical route

### Description

**As a** tournament organizer
**I want** Participants to always open the participant list
**So that** I can manage roster, check-in status, and seeds reliably

### Current Behavior

1. Click “Participants” in left navigation within tournament context
2. User is routed to registrations page or a non-canonical view
3. “Participants” and “Registrations/Players” overlap conceptually

**Actual Result**: Confusing routing and duplicate IA
**Expected Result**: A single canonical participants page exists and nav routes correctly

### Acceptance Criteria

* [ ] Participants nav routes to `/tournaments/[id]/participants`
* [ ] Participants page is canonical (not registrations sub-tab)
* [ ] Breadcrumb reflects “Participants”
* [ ] Back button behavior correct
* [ ] Manual testing complete

### Technical Details

**Files to Modify**

* `src/components/navigation/LeftNav.tsx` (or equivalent)
* `src/app/(protected)/tournaments/[id]/participants/page.tsx`
* `src/app/(protected)/tournaments/[id]/registrations/page.tsx` (remove conflicting redirect logic)
* `src/lib/routes.ts` (if route helpers exist)

**API Changes Required**: No
**Database Changes Required**: No

### Implementation Guidance

* Make Participants a first-class page
* Registrations remains “requests/approvals”; Participants is “active roster”
* If Players tab exists under registrations, either remove it or make it link to Participants page

### Testing Instructions

1. Open tournament overview
2. Click Participants in left nav
3. Verify URL and page title reflect Participants
4. Verify returning to Registrations still works

**Test Cases**

* [ ] Happy path: Participants link works
* [ ] Regression: Registrations links still work
* [ ] Keyboard nav: Tab to Participants, Enter navigates

**Regression Check**

* Left nav highlights active item correctly

### Dependencies

**Blocked By**: None
**Blocks**: TOURNEY-106 (overview checklist should link to canonical pages), TOURNEY-102 (check-in uses participant canonical model)

### Definition of Done

* [ ] Code changes implemented
* [ ] All acceptance criteria met
* [ ] Manual testing completed (all test cases pass)
* [ ] No console errors or warnings
* [ ] Responsive design verified (mobile/tablet/desktop)
* [ ] Code reviewed
* [ ] Merged to main branch
* [ ] Deployed to staging
* [ ] Product owner/QA sign-off

### AI Coder Prompt (Ready to Copy)

```text
TASK: Fix Participants navigation and canonical route

CONTEXT:
- Project: courtmaster-v2
- Tech: Next.js 14, TypeScript, Tailwind, Prisma
- Ticket: TOURNEY-004

PROBLEM:
Participants link in tournament nav is confusing/misroutes to registrations. Organizers need a canonical participants page.

SOLUTION:
Ensure Participants nav routes to /tournaments/[id]/participants and renders a first-class participants list page. Remove conflicting redirect/tab logic that makes Participants behave like Registrations.

ACCEPTANCE CRITERIA:
- Participants nav routes correctly
- Breadcrumb/title correct
- Back button works
- Registrations still reachable and works

FILES TO CHANGE:
- src/components/navigation/LeftNav.tsx
- src/app/(protected)/tournaments/[id]/participants/page.tsx
- src/app/(protected)/tournaments/[id]/registrations/page.tsx (remove overlap/redirect)

CONSTRAINTS:
- Keep existing route structure
- Do not break registration approvals
- Maintain active nav styling

TEST AFTER IMPLEMENTATION:
- Click Participants from multiple tournament pages and verify route + page
```

---

## <a id="tourney-101"></a>**Ticket ID**: TOURNEY-101

**Type**: Story
**Priority**: P1-High
**Effort**: 13 (Story Points)
**Component**: Match Control (Live Ops)
**Sprint**: Phase 2

### Title

Build Live Command Center (Court Grid + Queue + Alerts)

### Description

**As a** tournament organizer
**I want** a Command Center view for live operations
**So that** I can run 4–16 courts and 150 entrants without hunting across pages

### Current Behavior

1. Navigate to `/tournaments/[id]/match-control`
2. View is table-heavy and requires scanning/filters
3. Courts are not presented as a real-time grid; actions require drilling into rows
4. Alerts (idle court/late match/missing player) are not visible

**Actual Result**: Live ops is slow and error-prone
**Expected Result**: A single screen shows courts, queue, and alerts with fast actions

### Acceptance Criteria

* [ ] Court grid renders all enabled courts (1..N) without horizontal scrolling
* [ ] Each court card shows: current match, status, timer, quick “Score” action
* [ ] Ready queue shows matches ready to assign/start, ordered by priority (e.g., earliest ready time)
* [ ] Alerts panel shows at least: idle courts, matches running long, ready matches unassigned
* [ ] Filters remain available but secondary
* [ ] Keyboard shortcuts for key actions (optional in Phase 2; minimum: focus search and navigate list)
* [ ] Manual testing complete

### Technical Details

**Files to Modify**

* `src/app/(protected)/tournaments/[id]/match-control/page.tsx` — restructure layout
* `src/components/match-control/CourtGrid.tsx`
* `src/components/match-control/CourtCard.tsx`
* `src/components/match-control/ReadyQueue.tsx`
* `src/components/match-control/AlertsPanel.tsx`
* `src/app/api/tournaments/[id]/courts/stats/route.ts` — consume (from TOURNEY-001)
* `src/app/api/tournaments/[id]/matches/live/route.ts` — create consolidated live feed endpoint (recommended)

**API Changes Required**: Yes (recommended consolidated live endpoint)
**Database Changes Required**: No

### Implementation Guidance

**Approach**

* Layout: 3 columns on desktop

  * Left: Court Grid
  * Middle: Ready Queue
  * Right: Alerts
* Polling: 10–15s (or use websocket later). Keep simple now.
* Court card actions:

  * Assign next match
  * Score current match
  * Mark court idle/maintenance (optional later)

**Key Considerations**

* Must scale to 16 courts without horizontal scroll
* Keep actions safe: confirm before ending a match
* Do not overload with settings actions on this page

### Testing Instructions

1. Configure 8 courts
2. Open Match Control
3. Verify 8 cards visible (grid wraps) and no horizontal scroll
4. Create 5 ready matches; verify they appear in Ready Queue
5. Assign match to Court 1; verify court card updates
6. Start match; verify timer starts
7. End match; verify court transitions to next state
8. Force idle threshold; verify alert appears

**Test Cases**

* [ ] 1 court
* [ ] 4 courts
* [ ] 8 courts
* [ ] 16 courts
* [ ] No ready matches (queue empty state)
* [ ] All courts busy (idle alerts suppressed)

**Regression Check**

* Existing match table view remains accessible (maybe via “All Matches” tab)
* Scoring page still works

### Dependencies

**Blocked By**: TOURNEY-001
**Blocks**: TOURNEY-207 (alerts engine), TOURNEY-104 (table refactor can follow after CC exists)

### Definition of Done

* [ ] Code changes implemented
* [ ] All acceptance criteria met
* [ ] Manual testing completed (all test cases pass)
* [ ] No console errors or warnings
* [ ] Responsive design verified (mobile/tablet/desktop)
* [ ] Code reviewed
* [ ] Merged to main branch
* [ ] Deployed to staging
* [ ] Product owner/QA sign-off

### AI Coder Prompt (Ready to Copy)

```text
TASK: Build Live Command Center (Court Grid + Queue + Alerts)

CONTEXT:
- Project: courtmaster-v2
- Tech: Next.js 14, TypeScript, Tailwind, shadcn/ui, Prisma/Postgres
- Ticket: TOURNEY-101

PROBLEM:
Match Control is table-heavy and not optimized for 150 entrants with 1..N courts. No real-time court grid, ready queue, or alerts.

SOLUTION:
Restructure match-control page into a Command Center:
- CourtGrid: dynamic 1..N enabled courts, no horizontal scroll
- ReadyQueue: list of ready matches prioritized for assignment/start
- AlertsPanel: idle courts, running-long matches, ready matches unassigned
Use existing APIs or create a consolidated live endpoint.

ACCEPTANCE CRITERIA:
- Court grid + queue + alerts visible on one screen
- Fast actions: assign/score without hunting
- Works for 4/8/16 courts
- No console errors; manual tests pass

FILES TO CHANGE:
- src/app/(protected)/tournaments/[id]/match-control/page.tsx
- src/components/match-control/CourtGrid.tsx
- src/components/match-control/CourtCard.tsx
- src/components/match-control/ReadyQueue.tsx
- src/components/match-control/AlertsPanel.tsx
- src/app/api/tournaments/[id]/matches/live/route.ts (recommended)
- src/app/api/tournaments/[id]/courts/stats/route.ts (consume)

CONSTRAINTS:
- Don’t mix settings actions into command center
- Keep existing All Matches table accessible
- Use Prisma queries; avoid raw SQL

TEST AFTER IMPLEMENTATION:
- Validate with 1/4/8/16 courts
- Assign/start/complete matches and verify UI updates
- Verify alerts trigger for idle/late/unassigned
```

---

## <a id="tourney-102"></a>**Ticket ID**: TOURNEY-102

**Type**: Story
**Priority**: P1-High
**Effort**: 8 (Story Points)
**Component**: Check-in Dashboard
**Sprint**: Phase 2

### Title

Redesign check-in for one-click + keyboard speed

### Description

**As a** tournament organizer
**I want** check-in to be fast and low-click
**So that** 150 entrants can be checked in quickly on laptops

### Current Behavior

1. Navigate to `/tournaments/[id]/check-in`
2. Each row has bib input + “Save Bib” + “Check In” + “No Show”
3. Bulk actions exist but are not filter-scoped
4. No keyboard-first flow

**Actual Result**: Too many clicks and too much visual noise
**Expected Result**: One primary action per row; bib auto-saved; keyboard-first workflow

### Acceptance Criteria

* [ ] Remove separate “Save Bib” button; bib is saved on check-in
* [ ] Row has only 1 primary action based on status:

  * Approved → Check In
  * Checked In → Undo
  * No Show → Reinstate
* [ ] “No Show” moved to overflow menu + bulk action
* [ ] Search autofocus; Enter checks in selected row
* [ ] “Select all” respects current filters
* [ ] Manual testing complete

### Technical Details

**Files to Modify**

* `src/app/(protected)/tournaments/[id]/check-in/page.tsx`
* `src/components/checkin/CheckInList.tsx`
* `src/components/checkin/ParticipantRow.tsx`
* `src/components/common/RowActionsMenu.tsx` (shared)
* `src/app/api/tournaments/[id]/participants/checkin/route.ts` (create/extend)
* `src/app/api/tournaments/[id]/participants/bib/route.ts` (optional; can be merged)

**API Changes Required**: Yes (ensure one endpoint can update bib + status)
**Database Changes Required**: No (assumes bib/status fields exist)

### Implementation Guidance

**Approach**

* Single mutation endpoint: `{ participantId, bibNumber?, status }`
* UI:

  * Inline bib field (optional)
  * Check In button commits bib + status
  * Undo and Reinstate available based on status
* Add keyboard handlers:

  * Arrow up/down moves selection
  * Enter triggers primary action

**Key Considerations**

* Prevent accidental No Show: require confirmation
* Handle doubles teams consistently (team-level check-in vs per-player; choose one and enforce)

### Testing Instructions

1. Open check-in page
2. Type name in search; list filters
3. Select first result; press Enter; verify status becomes Checked In
4. Enter bib and press Enter; verify bib saved and status updated
5. Mark No Show from overflow menu; confirm required
6. Bulk check in filtered list; verify only filtered selection changes

**Test Cases**

* [ ] Singles participant check-in
* [ ] Doubles team check-in
* [ ] Undo check-in
* [ ] Reinstate from no-show
* [ ] Keyboard-only workflow

**Regression Check**

* Participant status is reflected in Participants page and Match eligibility

### Dependencies

**Blocked By**: TOURNEY-004 (canonical participants helps), TOURNEY-003 (lock rules for roster)
**Blocks**: TOURNEY-106 (checklist), TOURNEY-207 (alerts based on check-in)

### Definition of Done

* [ ] Code changes implemented
* [ ] All acceptance criteria met
* [ ] Manual testing completed (all test cases pass)
* [ ] No console errors or warnings
* [ ] Responsive design verified (mobile/tablet/desktop)
* [ ] Code reviewed
* [ ] Merged to main branch
* [ ] Deployed to staging
* [ ] Product owner/QA sign-off

### AI Coder Prompt (Ready to Copy)

```text
TASK: Redesign check-in for one-click + keyboard speed

CONTEXT:
- Project: courtmaster-v2
- Tech: Next.js 14, TS, Tailwind, shadcn/ui, Prisma/Postgres
- Ticket: TOURNEY-102

PROBLEM:
Check-in rows require multiple clicks (Save Bib + Check In + No Show). No keyboard-first flow, too noisy for 150 entrants.

SOLUTION:
Update check-in UI to:
- Remove Save Bib; save bib on check-in mutation
- One primary action per row based on status
- No Show in overflow menu + confirmation
- Keyboard: search autofocus, arrows select, Enter triggers primary action
- Bulk actions respect filters

ACCEPTANCE CRITERIA:
- 1 action to check in a participant (click or Enter)
- bib saved with check-in
- filter-scoped select all works
- manual tests pass

FILES TO CHANGE:
- src/app/(protected)/tournaments/[id]/check-in/page.tsx
- src/components/checkin/CheckInList.tsx
- src/components/checkin/ParticipantRow.tsx
- src/components/common/RowActionsMenu.tsx
- src/app/api/tournaments/[id]/participants/checkin/route.ts (or extend existing)

CONSTRAINTS:
- Do not allow walk-ins (no add participant here)
- Keep status labels consistent across app
- Use Prisma updates

TEST AFTER IMPLEMENTATION:
- Keyboard check-in flow: search -> select -> Enter
- Confirm No Show requires confirmation
- Verify status reflected elsewhere
```

---

## <a id="tourney-103"></a>**Ticket ID**: TOURNEY-103

**Type**: Story
**Priority**: P1-High
**Effort**: 8 (Story Points)
**Component**: Tournament Settings / Scoring
**Sprint**: Phase 2

### Title

Add scoring presets and dynamic validation engine

### Description

**As a** tournament organizer
**I want** scoring to be configurable (sets/points)
**So that** I can run 21x3, 15x3, or 21x1 formats per tournament/category

### Current Behavior

1. Navigate to `/tournaments/[id]/settings`
2. Scoring description exists but presets/customization are limited or unclear
3. Score entry UI may be fixed-format and not fully driven by settings

**Actual Result**: Organizers can’t reliably configure scoring or scoring UI doesn’t adapt
**Expected Result**: Presets + custom scoring settings; score UI adapts and validates

### Acceptance Criteria

* [ ] Provide presets: 21x3, 21x1, 15x3 (plus custom)
* [ ] Settings can be applied at tournament level; optionally override per category
* [ ] Score entry UI renders correct number of sets
* [ ] Validation enforces points-to-win, win-by, optional cap
* [ ] Scoring changes blocked after BRACKET_LOCKED (TOURNEY-003)
* [ ] Manual testing complete

### Technical Details

**Files to Modify**

* `src/app/(protected)/tournaments/[id]/settings/page.tsx`
* `src/components/settings/ScoringSettings.tsx`
* `src/app/(protected)/tournaments/[id]/matches/page.tsx` (score entry)
* `src/components/matches/ScoreModal.tsx` (or equivalent)
* `src/app/api/tournaments/[id]/settings/scoring/route.ts` (create/extend)
* `src/lib/scoring/validation.ts` (new)
* `prisma/schema.prisma` (if scoring config not stored)

**API Changes Required**: Yes
**Database Changes Required**: Possibly (store scoring config)

### Implementation Guidance

* Model scoring config:

  * `setsToWin` or `bestOf`
  * `pointsToWin`
  * `winBy`
  * `capPoints` (nullable)
* UI:

  * preset buttons + custom form
  * preview sentence updates live
* Score UI:

  * dynamic set inputs generated from config
  * validation with clear error messages

### Testing Instructions

1. Set preset 21x3 → create a match → score modal shows 3 sets max
2. Switch to 21x1 → score modal shows 1 set only
3. Switch to 15x3 → validate 15-point wins
4. Lock bracket → attempt scoring change → blocked

**Test Cases**

* [ ] Best-of-3 scoring
* [ ] Single-set scoring
* [ ] Validation win-by=2
* [ ] Optional cap behavior
* [ ] Locked state blocks change

**Regression Check**

* Existing completed matches display remains correct

### Dependencies

**Blocked By**: TOURNEY-003
**Blocks**: TOURNEY-208 (help/tooltips), TOURNEY-101 (command center scoring quick action depends on correct score UI)

### Definition of Done

* [ ] Code changes implemented
* [ ] All acceptance criteria met
* [ ] Manual testing completed (all test cases pass)
* [ ] No console errors or warnings
* [ ] Responsive design verified (mobile/tablet/desktop)
* [ ] Code reviewed
* [ ] Merged to main branch
* [ ] Deployed to staging
* [ ] Product owner/QA sign-off

### AI Coder Prompt (Ready to Copy)

```text
TASK: Add scoring presets and dynamic validation engine

CONTEXT:
- Project: courtmaster-v2
- Tech: Next.js 14, TS, Tailwind, Prisma/Postgres
- Ticket: TOURNEY-103

PROBLEM:
Scoring must be organizer-configurable (21x3 default; also 15x3, 21x1). Score entry UI must adapt and validate correctly.

SOLUTION:
Add scoring config stored per tournament (optional per category). Implement presets + custom. Update score entry modal to generate set inputs dynamically and validate based on points/win-by/cap. Block changes after BRACKET_LOCKED state.

ACCEPTANCE CRITERIA:
- Presets + custom supported
- Score UI adapts
- Validation correct
- Locked state blocks changes

FILES TO CHANGE:
- src/app/(protected)/tournaments/[id]/settings/page.tsx
- src/components/settings/ScoringSettings.tsx
- src/components/matches/ScoreModal.tsx
- src/lib/scoring/validation.ts
- src/app/api/tournaments/[id]/settings/scoring/route.ts
- prisma/schema.prisma (if needed)

CONSTRAINTS:
- Do not alter completed match records unexpectedly
- Use TOURNEY-003 guards for lock checks
- Use Prisma

TEST AFTER IMPLEMENTATION:
- Verify 21x3 / 21x1 / 15x3 flows
- Verify lock blocks scoring changes
```

---

## <a id="tourney-104"></a>**Ticket ID**: TOURNEY-104

**Type**: Improvement
**Priority**: P1-High
**Effort**: 13 (Story Points)
**Component**: Tables / Lists (Global UX)
**Sprint**: Phase 2

### Title

Eliminate horizontal scrolling tables across app

### Description

**As a** tournament organizer
**I want** all key lists to fit on laptop width without horizontal scrolling
**So that** I can work quickly during live ops

### Current Behavior

1. Open Matches / Registrations / Participants / Leaderboard / Users
2. Tables include many columns and overflow off-screen
3. User must scroll horizontally to see actions/status/important fields

**Actual Result**: Slow scanning + missed critical info
**Expected Result**: Compact tables/cards + expandable row details; no horizontal scroll

### Acceptance Criteria

* [ ] No horizontal scroll on 1280px width for core list pages
* [ ] Essential columns remain visible (Status + Actions always visible)
* [ ] Secondary fields available via row expansion/drawer
* [ ] Table density supports 150 entrants (compact mode)
* [ ] Manual testing complete

### Technical Details

**Files to Modify (likely)**

* `src/components/common/DataTable.tsx` (if exists)
* `src/components/common/RowDetailsDrawer.tsx` (new shared)
* Pages:

  * `src/app/(protected)/tournaments/[id]/match-control/page.tsx` (All Matches table)
  * `src/app/(protected)/tournaments/[id]/matches/page.tsx`
  * `src/app/(protected)/tournaments/[id]/registrations/page.tsx`
  * `src/app/(protected)/tournaments/[id]/participants/page.tsx`
  * `src/app/(protected)/tournaments/[id]/leaderboard/page.tsx`
  * `src/app/(protected)/admin/users/page.tsx`

**API Changes Required**: No
**Database Changes Required**: No

### Implementation Guidance

* Identify “core columns” per table
* Move the rest to:

  * “View details” drawer
  * Column picker (optional later)
* Keep action buttons fixed at right with overflow menu

### Testing Instructions

* Verify each page at 1280px width has no horizontal scroll
* Verify actions remain accessible
* Verify details drawer shows hidden columns

### Dependencies

**Blocked By**: None
**Blocks**: TOURNEY-105 (filter bar standard is easier with common table), TOURNEY-201 (nav cleanup optional)

### Definition of Done

(standard checklist)

### AI Coder Prompt (Ready to Copy)

```text
TASK: Eliminate horizontal scrolling tables across app

CONTEXT:
- Tech: Next.js 14, TS, Tailwind, shadcn/ui
- Ticket: TOURNEY-104

PROBLEM:
Multiple pages use wide tables that require horizontal scrolling, which is unusable for live ops.

SOLUTION:
Refactor list UI to compact tables/cards with essential columns only and move secondary fields into an expandable row/drawer. Ensure Status + Actions always visible.

ACCEPTANCE CRITERIA:
- No horizontal scroll at 1280px width
- Essential columns visible
- Row detail drawer available

FILES TO CHANGE:
- src/components/common/DataTable.tsx (if exists)
- src/components/common/RowDetailsDrawer.tsx (new)
- list pages under src/app/(protected)/tournaments/[id]/*

CONSTRAINTS:
- Do not remove data; move it to details
- Keep existing pagination and sorting behavior

TEST AFTER IMPLEMENTATION:
- Check all key list pages at laptop width
```

---

## <a id="tourney-105"></a>**Ticket ID**: TOURNEY-105

**Type**: Improvement
**Priority**: P1-High
**Effort**: 5 (Story Points)
**Component**: Filters / Search (Global UX)
**Sprint**: Phase 2

### Title

Standardize labeled filter bar across all list pages

### Description

**As a** tournament organizer
**I want** the same labeled filter pattern everywhere
**So that** I don’t relearn controls on every screen

### Current Behavior

* Filters often appear as dropdowns plus duplicate input fields
* Labels inconsistent; placeholders used as labels
* Order differs by page

**Expected Result**: Standard filter bar component used everywhere

### Acceptance Criteria

* [ ] Standard filter bar: Search, Category, Status, Court (match pages), Sort, Clear
* [ ] All filters have visible labels
* [ ] No duplicate “select + input” for the same filter
* [ ] Clear resets all
* [ ] Manual testing complete

### Technical Details

**Files to Modify**

* `src/components/common/FilterBar.tsx` (new shared)
* Update list pages to consume shared FilterBar

**API Changes Required**: No
**Database Changes Required**: No

### Implementation Guidance

* Build `FilterBar` with prop-driven config:

  * enableCategory
  * enableStatus
  * enableCourt
* Ensure filter state reflected in URL query params (optional but recommended)

### Testing Instructions

* Validate filter bar layout across pages
* Keyboard tab order correct
* Clear works

### Dependencies

**Blocked By**: None
**Blocks**: TOURNEY-102 (check-in filtering), TOURNEY-101 (command center still may use filters)

### Definition of Done

(standard checklist)

### AI Coder Prompt (Ready to Copy)

```text
TASK: Standardize labeled filter bar across all list pages

CONTEXT:
- Tech: Next.js 14, TS, Tailwind, shadcn/ui
- Ticket: TOURNEY-105

PROBLEM:
Filters are inconsistent/unlabeled; some pages show duplicate select+input for the same filter.

SOLUTION:
Create a shared FilterBar component with labeled controls and use it across all list pages. Remove duplicate filter inputs.

ACCEPTANCE CRITERIA:
- Same filter order across pages
- Visible labels
- Clear resets all filters
- No duplicate filter inputs

FILES TO CHANGE:
- src/components/common/FilterBar.tsx (new)
- Replace per-page filter UI in tournament list pages

CONSTRAINTS:
- Keep existing filter behavior
- Maintain accessibility (labels + focus order)

TEST AFTER IMPLEMENTATION:
- Verify filters on matches, registrations, participants, leaderboard, check-in
```

---

## <a id="tourney-106"></a>**Ticket ID**: TOURNEY-106

**Type**: Story
**Priority**: P1-High
**Effort**: 5 (Story Points)
**Component**: Tournament Overview
**Sprint**: Phase 2

### Title

Add Organizer Checklist panel to overview

### Description

**As a** tournament organizer
**I want** a checklist showing readiness and next steps
**So that** setup is guided and errors are reduced

### Current Behavior

Overview shows KPIs but no explicit “next step” guidance.

### Acceptance Criteria

* [ ] Checklist items: Courts configured, Registrations approved, Seeds done, Bracket generated, Bracket locked, Check-in started, Matches started
* [ ] Each item links to the exact page/action
* [ ] Checklist driven by real data/state machine
* [ ] Manual testing complete

### Technical Details

**Files to Modify**

* `src/app/(protected)/tournaments/[id]/page.tsx` (overview)
* `src/components/tournament/OrganizerChecklist.tsx`
* `src/app/api/tournaments/[id]/readiness/route.ts` (new endpoint recommended)

### Dependencies

**Blocked By**: TOURNEY-003, TOURNEY-004
**Blocks**: None

### AI Coder Prompt (Ready to Copy)

```text
TASK: Add Organizer Checklist panel to tournament overview

CONTEXT:
- Ticket: TOURNEY-106
- Tech: Next.js 14, TS, Prisma

PROBLEM:
Overview shows stats but doesn’t guide next steps.

SOLUTION:
Add OrganizerChecklist component driven by readiness endpoint/state:
- courts configured, registrations approved, seeds done, bracket generated/locked, check-in started, matches started
Each item links to correct page.

FILES TO CHANGE:
- src/app/(protected)/tournaments/[id]/page.tsx
- src/components/tournament/OrganizerChecklist.tsx
- src/app/api/tournaments/[id]/readiness/route.ts

TEST AFTER IMPLEMENTATION:
- Verify checklist updates as you complete steps
```

---

## <a id="tourney-201"></a>**Ticket ID**: TOURNEY-201

**Type**: Task
**Priority**: P2-Medium
**Effort**: 3 (Story Points)
**Component**: Navigation
**Sprint**: Phase 3

### Title

Remove duplicate nav entries and unify nav styles

### Current Behavior

* “All Tournaments” appears under Settings while also being main dashboard
* Mixed links vs button tabs (Leaderboard inconsistent)

### Acceptance Criteria

* [ ] Left nav contains only unique modules
* [ ] Tabs are consistent (all tabs are tabs; all links are links)
* [ ] Active state styling consistent
* [ ] Manual testing complete

### Technical Details

**Files to Modify**

* `src/components/navigation/LeftNav.tsx`
* `src/components/navigation/TournamentTabs.tsx` (or equivalent)
* `src/app/(protected)/tournaments/[id]/layout.tsx`

### Dependencies

**Blocked By**: None
**Blocks**: None

### AI Coder Prompt (Ready to Copy)

```text
TASK: Remove duplicate nav entries and unify nav styles

PROBLEM:
Duplicate nav items and inconsistent tab/link styling slow organizers.

SOLUTION:
Refactor nav so All Tournaments is only under main dashboard, unify Leaderboard to match tab system, ensure consistent active styles.

FILES TO CHANGE:
- src/components/navigation/LeftNav.tsx
- src/app/(protected)/tournaments/[id]/layout.tsx
- src/components/navigation/TournamentTabs.tsx
```

---

## <a id="tourney-202"></a>**Ticket ID**: TOURNEY-202

**Type**: Story
**Priority**: P2-Medium
**Effort**: 8 (Story Points)
**Component**: Audit / Admin
**Sprint**: Phase 3

### Title

Add audit trail for critical organizer actions

### Current Behavior

No audit record for:

* score edits
* no-show changes
* court reassignments
* lifecycle overrides/unlocks

### Acceptance Criteria

* [ ] Audit log table in DB (actor, action, entity, before/after, timestamp)
* [ ] Logged for: score submit/edit, no-show, court assign, state override
* [ ] Viewable in Reports or Admin (read-only)
* [ ] Manual testing complete

### Technical Details

**Files**

* `prisma/schema.prisma` (AuditLog model)
* `src/app/api/audit/route.ts` or `src/app/api/tournaments/[id]/audit/route.ts`
* Hook audit writes in scoring/check-in/match-control/state endpoints

### Dependencies

**Blocked By**: TOURNEY-003
**Blocks**: None

### AI Coder Prompt (Ready to Copy)

```text
TASK: Add audit trail for critical organizer actions

PROBLEM:
No audit trail for score edits, no-show changes, court assignment, or state overrides.

SOLUTION:
Add AuditLog model via Prisma and write audit entries from relevant API routes. Provide a read-only audit view in tournament reports/admin.

FILES TO CHANGE:
- prisma/schema.prisma
- src/app/api/tournaments/[id]/audit/route.ts (new)
- Add audit write calls in scoring/check-in/match-control/state routes
```

---

## <a id="tourney-203"></a>**Ticket ID**: TOURNEY-203

**Type**: Bug
**Priority**: P2-Medium
**Effort**: 5 (Story Points)
**Component**: Matches / Data Model
**Sprint**: Phase 3

### Title

Ensure match identifiers are globally unambiguous

### Current Behavior

Match table shows repeated numbers like “#0” across categories, confusing exports and comms.

### Acceptance Criteria

* [ ] Display ID is unambiguous across tournament:

  * either global sequential match number
  * or include category prefix + bracket round (e.g., MS-WB1-001)
* [ ] Exports use stable unique IDs
* [ ] Manual testing complete

### Technical Details

* Likely display-layer fix plus optional DB field for `displayNumber`
* Update matches list render + exports

### Dependencies

**Blocked By**: None
**Blocks**: TOURNEY-208 (report clarity)

### AI Coder Prompt (Ready to Copy)

```text
TASK: Ensure match identifiers are globally unambiguous

PROBLEM:
Matches display duplicate numbers (#0 repeats) across categories, confusing organizers.

SOLUTION:
Add a unique display identifier strategy for matches per tournament. Update match tables and exports to use it consistently.

FILES TO CHANGE:
- src/app/(protected)/tournaments/[id]/match-control/page.tsx (All Matches view)
- src/app/(protected)/tournaments/[id]/matches/page.tsx
- src/app/api/tournaments/[id]/matches/export/route.ts (if exists)
- prisma/schema.prisma (optional if storing displayNumber)
```

---

## <a id="tourney-204"></a>**Ticket ID**: TOURNEY-204

**Type**: Task
**Priority**: P2-Medium
**Effort**: 2 (Story Points)
**Component**: Breadcrumb / Titles
**Sprint**: Phase 3

### Title

Standardize breadcrumb and page titles

### Current Behavior

Create flow breadcrumb ends with generic “Tournament” rather than “Create Tournament”, and other pages vary.

### Acceptance Criteria

* [ ] All pages show correct title
* [ ] Breadcrumb last segment matches page title
* [ ] Manual testing complete

### AI Coder Prompt (Ready to Copy)

```text
TASK: Standardize breadcrumb and page titles

SOLUTION:
Audit tournament module pages and ensure consistent page title + breadcrumb labels (Create, Overview, Match Control, Courts, etc).

FILES TO CHANGE:
- src/components/navigation/Breadcrumbs.tsx (if exists)
- tournament page.tsx files under src/app/(protected)/tournaments/[id]/
```

---

## <a id="tourney-205"></a>**Ticket ID**: TOURNEY-205

**Type**: Improvement
**Priority**: P2-Medium
**Effort**: 3 (Story Points)
**Component**: Search UX
**Sprint**: Phase 3

### Title

Clarify global search vs page search

### Current Behavior

A global search input exists in shell, and local searches exist in pages; unclear what global search does.

### Acceptance Criteria

* [ ] Global search clearly labeled (what it searches)
* [ ] If not implemented, hide it or disable with tooltip
* [ ] Local search labeled consistently (Search participants/matches)
* [ ] Manual testing complete

### AI Coder Prompt (Ready to Copy)

```text
TASK: Clarify global search vs page search

PROBLEM:
Global search appears everywhere but overlaps with local search, causing confusion.

SOLUTION:
Either implement global search scope clearly (tournaments/participants/matches) with label, or remove/disable with tooltip. Standardize local search labels.

FILES TO CHANGE:
- src/components/layout/AppHeader.tsx (global search)
- src/components/common/FilterBar.tsx (local search labeling)
```

---

## <a id="tourney-206"></a>**Ticket ID**: TOURNEY-206

**Type**: Improvement
**Priority**: P3-Low
**Effort**: 2 (Story Points)
**Component**: Status UI
**Sprint**: Phase 3

### Title

Standardize status casing and color tokens

### Current Behavior

Statuses show mixed casing (ready/completed) and inconsistent visual emphasis.

### Acceptance Criteria

* [ ] Status labels consistently cased (“Ready”, “Completed”, “In Progress”)
* [ ] Standard badge tokens across pages
* [ ] Manual testing complete

### AI Coder Prompt (Ready to Copy)

```text
TASK: Standardize status casing and color tokens

SOLUTION:
Create a shared StatusBadge component mapping statuses to label + variant, used across match/registration/check-in pages.

FILES TO CHANGE:
- src/components/common/StatusBadge.tsx (new)
- Replace inline badges across tournament pages
```

---

## <a id="tourney-207"></a>**Ticket ID**: TOURNEY-207

**Type**: Story
**Priority**: P2-Medium
**Effort**: 8 (Story Points)
**Component**: Alerts (Live Ops)
**Sprint**: Phase 3

### Title

Add live ops alerts engine and UI

### Description

**As a** tournament organizer
**I want** alerts for idle courts, late matches, missing check-ins
**So that** I can keep courts utilized and avoid delays

### Current Behavior

No alerts panel exists; organizer must manually detect problems.

### Acceptance Criteria

* [ ] Alerts generated for:

  * Idle court > configurable threshold
  * Ready matches unassigned > threshold
  * In-progress match running long > threshold
  * Match blocked by “TBD” dependency (optional)
* [ ] Alerts appear in Command Center (TOURNEY-101)
* [ ] Alerts can be dismissed
* [ ] Manual testing complete

### Technical Details

* `src/app/api/tournaments/[id]/alerts/route.ts` (new)
* `src/components/match-control/AlertsPanel.tsx` (consume)

### Dependencies

**Blocked By**: TOURNEY-101, TOURNEY-001
**Blocks**: None

### AI Coder Prompt (Ready to Copy)

```text
TASK: Add live ops alerts engine and UI

PROBLEM:
Organizers have no system alerts (idle courts, late matches, unassigned ready matches).

SOLUTION:
Create alerts endpoint computing alerts from courts + matches + check-in, and render in AlertsPanel in Command Center. Support dismiss UI state client-side.

FILES TO CHANGE:
- src/app/api/tournaments/[id]/alerts/route.ts
- src/components/match-control/AlertsPanel.tsx
- src/app/(protected)/tournaments/[id]/match-control/page.tsx
```

---

## <a id="tourney-208"></a>**Ticket ID**: TOURNEY-208

**Type**: Task
**Priority**: P2-Medium
**Effort**: 3 (Story Points)
**Component**: Reports / UX Copy
**Sprint**: Phase 3

### Title

Add metric definitions and tooltips across dashboards

### Current Behavior

Metrics like participation rate and duration lack definitions, causing confusion.

### Acceptance Criteria

* [ ] Tooltips define each metric calculation
* [ ] Participation rate split:

  * Checked-in / Approved
  * Approved / Registered
* [ ] Manual testing complete

### AI Coder Prompt (Ready to Copy)

```text
TASK: Add metric definitions and tooltips across dashboards

SOLUTION:
Add tooltip definitions for KPIs across overview, reports, leaderboard. Clarify participation metrics and calculations.

FILES TO CHANGE:
- src/components/reports/* (tooltips)
- src/components/tournament/* (KPI cards)
- src/components/common/Tooltip.tsx usage
```

---

## <a id="tourney-104-b"></a>**Ticket ID**: TOURNEY-104-B

**Type**: Task
**Priority**: P2-Medium
**Effort**: 8 (Story Points)
**Component**: Tables / Lists
**Sprint**: Phase 3 (or later)

### Title

Complete compact table refactoring on remaining pages

### Description

**As a** tournament organizer
**I want** all tables to use the compact pattern established in TOURNEY-104
**So that** I never have to scroll horizontally at laptop width

### Current Behavior

TOURNEY-104 created reusable components (ExpandableRow, CompactDataTable) and demonstrated the pattern on MatchControlView. However, several pages still use wide v-data-tables with horizontal scrolling.

**Files Still Using Wide Tables:**
- `src/features/registration/views/ParticipantsView.vue` (v-data-table)
- `src/features/registration/views/RegistrationManagementView.vue` (v-data-table)
- `src/components/leaderboard/LeaderboardTable.vue` (v-data-table)
- `src/features/admin/views/UserManagementView.vue` (v-data-table)
- `src/features/tournaments/views/TournamentDashboardView.vue` (2 tables)
- `src/features/reports/views/TournamentSummaryView.vue` (v-data-table)

### Acceptance Criteria

* [ ] All remaining tables use CompactDataTable or ExpandableRow pattern
* [ ] No horizontal scroll at 1280px width on any list page
* [ ] Essential columns remain visible (Status + Actions always visible)
* [ ] Secondary fields available via row expansion
* [ ] Compact/Full toggle available on complex tables (optional)

### Technical Details

**Reusable Components (already created in TOURNEY-104):**
- `src/components/common/ExpandableRow.vue` - Collapsible row wrapper
- `src/components/common/CompactDataTable.vue` - Compact table component

**Implementation Pattern:**
```vue
<compact-data-table
  :items="items"
  :columns="[
    { key: 'name', title: 'Name', width: '40%', essential: true },
    { key: 'status', title: 'Status', width: '100px', essential: true },
    { key: 'actions', title: 'Actions', width: '120px', essential: true },
  ]"
>
  <template #cell-name="{ item }">
    <!-- Custom cell content -->
  </template>
  <template #details="{ item }">
    <!-- Expanded row content -->
  </template>
</compact-data-table>
```

### Dependencies

**Blocked By**: TOURNEY-104 (must be completed first)
**Blocks**: None

### Definition of Done

- [ ] Code changes implemented for all remaining tables
- [ ] All acceptance criteria met
- [ ] Manual testing completed (verify 1280px width)
- [ ] No console errors
- [ ] Responsive design verified

---

# Quick Reference

| Ticket ID   | Priority | Title                                 | Status |
| ----------- | -------- | ------------------------------------- | ------ |
| TOURNEY-001 | P0       | Fix incorrect court busy/total stats  | ⏸️ Skipped |
| TOURNEY-002 | P0       | Fix invalid match duration metrics    | ⏸️ Skipped |
| TOURNEY-003 | P0       | Add lifecycle state machine and locks | ⏸️ Skipped |
| TOURNEY-004 | P0       | Fix Participants canonical routing    | ⏸️ Skipped |
| TOURNEY-101 | P1       | Build Live Command Center             | ✅ Complete |
| TOURNEY-102 | P1       | Redesign check-in for speed           | ✅ Complete |
| TOURNEY-103 | P1       | Scoring presets + validation          | ✅ Complete |
| TOURNEY-104 | P1       | Remove horizontal scroll tables       | ✅ Complete (foundation) |
| TOURNEY-104-B | P2     | Complete table compact refactor (remaining pages) | ✅ Complete |
| TOURNEY-105 | P1       | Standardize filter bar                | ✅ Complete |
| TOURNEY-106 | P1       | Organizer checklist on overview       | ✅ Complete |
| TOURNEY-201 | P2       | Remove duplicate nav entries          | ⏸️ Pending |
| TOURNEY-202 | P2       | Add audit trail                       | ⏸️ Pending |
| TOURNEY-203 | P2       | Unambiguous match identifiers         | ⏸️ Pending |
| TOURNEY-204 | P2       | Standardize breadcrumbs/titles        | ⏸️ Pending |
| TOURNEY-205 | P2       | Clarify global vs local search        | ⏸️ Pending |
| TOURNEY-206 | P3       | Standardize status badge system       | ⏸️ Pending |
| TOURNEY-207 | P2       | Live ops alerts engine                | ⏸️ Pending |
| TOURNEY-208 | P2       | KPI definitions/tooltips              |

PROMPT 

```markdown
# ROLE: Senior Full-Stack Engineer implementing QA backlog
You are implementing fixes from a QA report ticket-by-ticket. Work sequentially, complete each ticket fully before moving to the next.
## PROJECT CONTEXT
- Tech: Next.js 14, React, TypeScript, Tailwind, shadcn/ui, PostgreSQL, Prisma
- File structure: `src/app/(protected)/`, `src/components/`, `src/app/api/`, `prisma/`
- Rules: Use Prisma (no raw SQL), TypeScript strict mode, async/await, proper error handling
## WORKFLOW (REPEAT FOR EACH TICKET)
## WORKTREE-BASED BRANCHING RULES (MANDATORY)
- Worktree folder: `../courtmaster-TOURNEY-XXX`
All code changes for the ticket MUST happen only inside that worktree folder.
Do NOT merge to main automatically. Wait for user approval.
### 1. Pre-Implementation Check
Before coding, show me:
```
📋 TICKET: TOURNEY-XXX - [Title]
📦 FILES TO MODIFY: [list]
🔍 CHANGES: [brief summary]
⚠️ DEPENDENCIES: [blocked by / requires]
🤔 QUESTIONS: [any clarifications or "Ready"]
```
**WAIT FOR MY "proceed"**
### 2. Implement
- Show diffs, not full files
- One file at a time
- Follow ticket's "Implementation Guidance" exactly
- Apply all constraints from ticket
### 3. Test Checklist
After implementation:
```
✅ TESTING CHECKLIST - TOURNEY-XXX
Manual Tests: [copy from ticket]
Acceptance Criteria: [copy from ticket]
Regression Checks: [copy from ticket]
```
**WAIT FOR MY "test pass" or "test fail: [reason]"**
### 4. Commit
After test pass:
```
🎯 COMMIT:
git add [files]
git commit -m "[type]: [description] (TOURNEY-XXX)
- [details]
Closes TOURNEY-XXX"
```
**WAIT FOR MY "yes" to proceed to next ticket**
## COMMANDS
- **"proceed"** - start implementing
- **"test pass"** - move to commit
- **"test fail: [reason]"** - debug issue
- **"yes"** - start next ticket
- **"skip to TOURNEY-XXX"** - jump to ticket
- **"pause"** - show progress log
## CONSTRAINTS
✅ DO: Work one ticket at a time, show diffs, wait for approval, follow ticket guidance
❌ DON'T: Skip ahead, refactor unrelated code, change unlisted files, add dependencies without asking
## START
1. Read the QA document at the path I provide
2. Confirm total tickets found and list Phase 1 tickets
3. Start with TOURNEY- XXX
4. Show Pre-Implementation Check for first ticket
BEGIN NOW.
```
QA Document path: /Users/ramc/Documents/Code/courtmaster-v2/docs/fix/QA-report.md 
