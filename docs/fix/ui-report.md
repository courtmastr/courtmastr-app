## 1) Mapping: main pages & key flows

* Header/global: toggle nav, global search, bug report, notifications, user menu
* `/tournaments`: tournaments list
* `/tournaments/create`: create tournament (wizard/form)
* `/tournaments/:id`: dashboard
* `/tournaments/:id/match-control`: match control (command center, live board, all matches, exit)
* `/tournaments/:id/matches`: score matches list
* `/tournaments/:id/categories`: categories list + seeds modal
* `/tournaments/:id/courts`: courts list + edit court dialog
* `/tournaments/:id/brackets`: bracket viewer + category selector(s)
* `/tournaments/:id/registrations`: registrations list + quick check-in (duplicated) + participant link
* `/tournaments/:id/participants`: participants list
* `/tournaments/:id/leaderboard`: leaderboard table
* `/tournaments/:id/settings`: settings (basic info, scheduling, scoring, registration) + delete tournament

---

## 1. High-level UI/UX summary

### What’s working well

* Clear domain mental model: matches, courts, categories, scoring, registrations are clearly separated.
* Consistent header actions across pages (global search, notifications, user menu).
* Strong “state context” banners (Live, roster/ bracket locked) keep users aware of tournament status.
* Match Control provides a consolidated operations view (courts + ready queue + alerts).
* Tables often include helpful pagination controls (leaderboard) and filters (matches/registrations/participants).

### Main problems / risks

* Critical CTAs and destructive actions are confusing/duplicated: “Move to Completed” vs “Complete Tournament”, “Delete Tournament” not isolated in separate settings nav.
* Many controls are unlabeled or ambiguous (icon-only buttons, unlabeled tournament-card action button).
* Several UIs create cognitive overload (long bracket page, long unpaginated lists, duplicated quick check-in sections).
* Inconsistent status language and casing (snake_case like `in_use`, lowercase `approved`).
* Bug report modal appears to have no visible “submit/send” action (only Cancel).
* Combobox/filter implementations show redundant inputs and unclear affordances; options menus are sometimes not discoverable.
* Mobile/responsive behavior not fully verified; side nav toggle/collapse exists but needs stronger UX checks.

---

## 2. Page-by-page review

### Header / Global actions (cross-page)

* URL / Navigation path: persistent across app
* Primary purpose: global search, quick access to notifications, bug report, and account

**What’s working well**

* Global search suggests relevant sections (“Match Control”, “Score Matches”) with descriptions.
* Notifications dropdown provides a clean empty state (“No notifications”).

**Issues and pain points**

* UI-001 (UX/Accessibility): Bug report dialog only shows textarea + Cancel; no submit button visible ⇒ user can’t report.

  * Impact: High | Persona: Organizer/Scorekeeper
  * Example: “Report a Bug” modal shows only “Cancel”.
* UI-002 (UX/Copy): Notifications icon shows aria-expanded state, but dropdown body labeling is minimal; consider accessible title + “0 notifications”.

  * Impact: Low | Persona: Organizer
* UI-003 (UX/Consistency): Global search input shows duplicated labels in suggestions (“Match Control Match Control”) as option title/label.

  * Impact: Medium | Persona: Organizer

**Recommended changes**

* REC-001: Add visible “Submit bug report” CTA in bug modal; disable until text present; add success toast. (P0, M)
* REC-002: Deduplicate text in global search results; ensure each option has one title + one description. (P2, S)
* REC-003: Improve notifications empty state copy and aria labeling. (P3, S)

---

### Tournaments list

* URL / Navigation path: sidebar “Tournaments”
* Primary purpose: select/manage tournaments

**What’s working well**

* Tournament cards show sport + format + status + date + venue.
* “Create Tournament” CTA is prominent.

**Issues and pain points**

* UI-004 (UX): Tournament card action button has no label/tooltip; not obvious it opens dashboard.

  * Impact: Medium | Persona: Organizer
* UI-005 (Copy): “Active” pill is good, but status color meaning isn’t explained; consider legend tooltips.

  * Impact: Low | Persona: Organizer

**Recommended changes**

* REC-004: Add button label “Open Dashboard” and tooltip/aria-label. (P1, S)
* REC-005: Add status pill tooltip “Active tournament”. (P3, S)

---

### Create Tournament

* URL / Navigation path: sidebar “Create Tournament”
* Primary purpose: tournament creation

**What’s working well**

* Placeholder hints (“e.g., Summer Badminton Championship 2024”) improve discoverability.

**Issues and pain points**

* UI-006 (Bug/UX): Form appears truncated/no visible “Save/Create” CTA below fields (not discoverable in normal scroll).

  * Impact: High | Persona: Organizer
* UI-007 (UX): Minimal structure; key configuration (scoring/courts/categories) not obviously part of onboarding flow.

  * Impact: Medium | Persona: Organizer

**Recommended changes**

* REC-006: Ensure footer actions are pinned/sticky and visible (“Cancel”, “Create Tournament”). (P0, M)
* REC-007: Convert to stepper (Basic info → Scoring → Categories → Review), with progress indicator. (P2, L)

---

### Dashboard

* URL / Navigation path: sidebar “Dashboard”
* Primary purpose: overview + key tournament actions

**What’s working well**

* Provides quick jumps to match control and scoring.
* Metrics cards are straightforward (participants, matches in progress/completed).

**Issues and pain points**

* UI-008 (Consistency/UX): Action duplication/confusion: “Manage” dropdown includes “Complete Tournament”, separate “Move to Completed” button exists elsewhere.

  * Impact: High | Persona: Organizer
* UI-009 (UX): “Manage” dropdown items look like list items, not buttons; clickable affordance unclear.

  * Impact: Medium | Persona: Organizer
* UI-010 (UX): Ready queue counts appear duplicated vs list (numbers may show twice), causing mistrust.

  * Impact: Medium | Persona: Scorekeeper
* UI-011 (Copy): “Enter Match Control” and “Score Matches” as CTAs; unclear primary path.

  * Impact: Medium | Persona: Organizer/Scorekeeper

**Recommended changes**

* REC-008: Consolidate completion action: single “Complete Tournament” CTA with confirmation and disabled state rules. (P0, M)
* REC-009: Replace dropdown list items with button-style menu entries; add icons and hover states. (P2, S)
* REC-010: Align ready queue counts with actual queue list; show “No matches ready” empty state instead of duplicating numbers. (P1, S)

---

### Match Control (Command Center + modals)

* URL / Navigation path: dashboard → Enter Match Control or sidebar “Match Control”
* Primary purpose: live operations (court assignment, scoring, releasing)

**What’s working well**

* Compact view of courts “Available / In Use” and status per court.
* Ready queue is visible alongside courts; alerts panel gives confidence (“All Good”).

**Issues and pain points**

* UI-012 (UX): Critical actions “Score” and “Release” are same visual weight; scoring should be primary.

  * Impact: High | Persona: Scorekeeper
* UI-013 (UX/Validation): Score modal “Enter Match Scores” shows multiple games with numeric inputs default 0; no inline validation guidance (totals, win-by rules, required fields).

  * Impact: High | Persona: Scorekeeper
* UI-014 (Accessibility): Score modal lacks explicit close button; users rely on Cancel only.

  * Impact: Medium | Persona: Scorekeeper
* UI-015 (UX): Category filter “All Categories” opens (aria-expanded true) but options UI isn’t visible/detectable in viewport; suggests portal rendering/hidden state confusion.

  * Impact: Medium | Persona: Organizer

**Recommended changes**

* REC-012: Make “Score” a primary button; “Release” secondary/destructive-style (with confirmation). (P0, S)
* REC-013: Add inline validation errors under each game input; highlight winner and prevent impossible scores by default. (P0, M)
* REC-014: Add close (X) button with aria-label on score modal. (P2, S)
* REC-015: Ensure category combobox renders options near trigger, with focus management and visible list positioning. (P2, M)

---

### Matches (“Score Matches”)

* URL / Navigation path: dashboard → “Score Matches” or maybe global search suggestion
* Primary purpose: list of ready/active matches with filters

**What’s working well**

* Search placeholder is specific: “Search by match ID, number, or participant”.
* Filters and sort controls exist, and there’s a “Clear Filters” button.

**Issues and pain points**

* UI-016 (UX): Combobox markup includes redundant text inputs; users may not know where to click to open filters.

  * Impact: Medium | Persona: Organizer/Scorekeeper
* UI-017 (UX): Long list; no pagination and weak section separation; hard to scan during live scoring.

  * Impact: Medium | Persona: Scorekeeper
* UI-018 (UX): “Score” button exists but no tooltip; should explain action and context (opens scoring modal).

  * Impact: Low | Persona: Scorekeeper

**Recommended changes**

* REC-016: Simplify filter combobox component; show clear affordance + caret; remove duplicate input fields. (P2, M)
* REC-017: Add pagination/infinite scroll with sticky header and section labels for ready/active/finished. (P1, M)
* REC-018: Tooltip/aria-label on “Score”: “Score match #123 on Court 3”. (P3, S)

---

### Categories

* URL / Navigation path: sidebar “Categories”
* Primary purpose: manage categories, seeds, brackets readiness

**What’s working well**

* “Add Category” is clear.
* Category cards show format/type/status for quick triage.

**Issues and pain points**

* UI-019 (UX): “Bracket Ready” dropdown items (“Regenerate Bracket”, “Fix progression links”) look like plain list text; no danger markers, no affordance.

  * Impact: High | Persona: Organizer
* UI-020 (UX): Manage Seeds modal is long; controls (Auto-assign/Clear/Done) are far from seed list; hard to use for 20+ participants.

  * Impact: Medium | Persona: Organizer
* UI-021 (Accessibility): Seed select control repeated per participant; needs consistent aria-labels “Seed for [name]”.

  * Impact: Medium | Persona: Organizer

**Recommended changes**

* REC-019: Make dropdown items buttons with icons; add confirmation for destructive bracket actions. (P1, M)
* REC-020: Add sticky seed modal actions bar at top/bottom; show progress indicator “3 seeded / 23”. (P2, M)
* REC-021: Add aria-label per seed select (programmatic). (P3, S)

---

### Courts

* URL / Navigation path: sidebar “Courts”
* Primary purpose: manage courts (availability/order)

**What’s working well**

* Edit Court dialog is straightforward: name, display order, status.

**Issues and pain points**

* UI-022 (Consistency): Court list ordering is inconsistent (e.g., 2,4,1,6,5,3), and display order intent is unclear.

  * Impact: Medium | Persona: Organizer
* UI-023 (Copy/Consistency): Status displayed as `in_use` (snake case) but edit dialog uses “In Use”; inconsistent casing in UI.

  * Impact: Medium | Persona: Organizer
* UI-024 (UX): “Add Multiple” exists but no inline explanation; unclear what format/steps follow.

  * Impact: Low | Persona: Organizer

**Recommended changes**

* REC-022: Default sort by display order; show “Court 1, Court 2…” sequence. (P2, S)
* REC-023: Normalize casing and labels: “In Use”, “Available”, “Offline”. (P2, S)
* REC-024: Add tooltip/helper text for “Add Multiple” with example input format. (P3, S)

---

### Brackets

* URL / Navigation path: sidebar “Brackets”
* Primary purpose: view pool play/elimination brackets per category

**What’s working well**

* Category selection required; prevents empty bracket confusion.
* Bracket outputs are detailed (rounds, match results, standings).

**Issues and pain points**

* UI-025 (UX): Page is extremely long; no internal navigation (“jump to group”, “collapse groups”, “back to top”).

  * Impact: High | Persona: Organizer/Parent
* UI-026 (Copy): Standings table headers use abbreviations without legend (“F”, “SF”, “SA”, “Pts”).

  * Impact: Medium | Persona: Parent/Player
* UI-027 (Accessibility): Hard to scan; needs sticky headers for rounds and standings tables.

  * Impact: Medium | Persona: Parent/Player

**Recommended changes**

* REC-025: Add collapsible sections per group; “expand all / collapse all”; add floating “Back to top” button. (P1, L)
* REC-026: Provide legend for abbreviations; optionally add tooltips on headers. (P2, S)
* REC-027: Make table headers sticky; implement virtualized render for long bracket lists. (P2, M)

---

### Registrations

* URL / Navigation path: sidebar “Registrations”
* Primary purpose: manage registrations and check-in

**What’s working well**

* Clear stat summary (pending/approved/checked in/withdrawn).
* “Go to Participants” link exists.

**Issues and pain points**

* UI-028 (Bug/UX): Quick Check-In section is duplicated on page (top tab and bottom), with inconsistent controls (bottom list sometimes shows participants but not buttons).

  * Impact: High | Persona: Organizer
* UI-029 (UX): Table actions column has no `<th>` header; screen readers lack context.

  * Impact: Medium | Persona: Organizer
* UI-030 (Consistency): Status display uses lowercase `approved`; inconsistent with other screens.

  * Impact: Low | Persona: Organizer

**Recommended changes**

* REC-028: Remove duplicate quick-check-in render; ensure single, fully-functional check-in view per tab. (P1, M)
* REC-029: Add “Actions” header and aria-label for action buttons (“Check in Jacob Parker”). (P2, S)
* REC-030: Normalize status display casing across app (“Approved”). (P3, S)

---

### Participants

* URL / Navigation path: registrations “Go to Participants” or sidebar “Participants” if present
* Primary purpose: participant directory and edit/delete

**What’s working well**

* Stats helpful: total participants, checked in, singles vs doubles.
* Search + filters consistent with other lists.

**Issues and pain points**

* UI-031 (UX): Participant rows show multiple category pills; could overload; needs grouping per participant with collapsible detail.

  * Impact: Medium | Persona: Organizer
* UI-032 (Accessibility): “Edit Player” and “Delete Player” buttons need stronger destructive styling and confirmation; currently same weight.

  * Impact: Medium | Persona: Organizer

**Recommended changes**

* REC-031: Use accordion rows: show participant summary, expand for categories/registrations. (P2, M)
* REC-032: Make “Delete Player” destructive; add confirm modal with participant name. (P1, S)

---

### Leaderboard

* URL / Navigation path: sidebar “Leaderboard”
* Primary purpose: ranking table with filters and pagination

**What’s working well**

* Metrics summarized at top (participants, matches played, still active).
* Pagination controls present; status filter “All/Active/Eliminated” works.

**Issues and pain points**

* UI-033 (Copy): “Generated [time]” label suggests static snapshot; unclear refresh cadence.

  * Impact: Low | Persona: Parent/Player
* UI-034 (UX): Filter “Status:” uses spans as tabs; tab affordance is weak.

  * Impact: Medium | Persona: Parent/Player
* UI-035 (UX): Row action buttons (likely details) unlabeled; unclear function.

  * Impact: Low | Persona: Parent/Player

**Recommended changes**

* REC-033: Replace time label with “Updated at [time]” + refresh state feedback (“Refreshing…”). (P3, S)
* REC-034: Make status tabs real buttons with selected state and keyboard focus ring. (P2, S)
* REC-035: Add labels/tooltips for row actions (e.g., “View match history”). (P3, S)

---

### Settings

* URL / Navigation path: sidebar “Tournament Settings”
* Primary purpose: edit basic info, scheduling, scoring, registration, delete tournament

**What’s working well**

* Status lock messaging (“Scoring format is locked while state is Live”) is clear.
* Category overrides section communicates default behavior.

**Issues and pain points**

* UI-036 (UX/Consistency): “Move to Completed” appears again; completion actions are scattered across app.

  * Impact: High | Persona: Organizer
* UI-037 (UX): Category overrides accordion doesn’t show expanded content (aria-expanded true but no inputs visible); confusing.

  * Impact: Medium | Persona: Organizer
* UI-038 (UX/Destructive): “Delete Tournament” button is adjacent to non-destructive controls; easy to misclick; no clear danger styling described.

  * Impact: High | Persona: Organizer

**Recommended changes**

* REC-036: Consolidate completion logic into dashboard only; settings should show read-only completion status. (P1, S)
* REC-037: Ensure override panel renders with inputs; add inline explanation “Override best-of / win-by / cap per category”. (P2, M)
* REC-038: Move delete to separate “Danger Zone” section with destructive style + typed confirmation. (P0, M)

---

## 3. Cross-cutting findings

* **Consistency**: button styles, casing, and status labels vary (“Active” vs `in_use`, `approved` lowercase). Dropdowns sometimes look like plain text.
* **Navigation IA**: too many repeated actions in different places (completion, check-in, move-to-completed). Hard to know the “right” place to do something.
* **Accessibility**: many action buttons lack aria-labels; tables missing headers for actions; modals missing close buttons; filter combobox focus/positioning unclear.
* **Performance/feedback**: long pages (brackets, long tables) lack loading skeletons; no feedback after certain actions; bug report lacks success path.

---

## 4. Prioritized change list (backlog)

| ID     | Page / Area               | Type          | Summary                                               | Priority | Effort | Why it matters                       |
| ------ | ------------------------- | ------------- | ----------------------------------------------------- | -------- | ------ | ------------------------------------ |
| UI-001 | Global bug report         | Bug           | Add submit button and success toast                   | P0       | M      | Users can’t report issues            |
| UI-012 | Match Control             | UX            | Make “Score” primary, “Release” secondary             | P0       | S      | Live ops must prioritize scoring     |
| UI-013 | Match scoring modal       | UX            | Add inline validation/required guidance               | P0       | M      | Prevent invalid scores and mistakes  |
| UI-008 | Dashboard                 | Consistency   | Consolidate completion actions (single CTA + confirm) | P0       | M      | Avoid dangerous/confusing duplicates |
| UI-006 | Create tournament         | Bug           | Ensure “Create” CTA visible/sticky                    | P0       | M      | Blocking onboarding                  |
| UI-038 | Settings                  | UX            | Move “Delete tournament” to danger zone               | P0       | M      | Prevent catastrophic misclicks       |
| UI-028 | Registrations             | Bug           | Remove duplicate quick check-in sections              | P1       | M      | Reduces confusion/QA risk            |
| UI-010 | Dashboard ready queue     | Bug           | Fix duplicated counts vs list                         | P1       | S      | Trust in system integrity            |
| UI-016 | Matches filters           | UX            | Simplify combobox inputs                              | P1       | M      | Better filtering under pressure      |
| UI-025 | Brackets                  | UX            | Add collapse/expand groups + back-to-top              | P1       | L      | Improves scanning on long pages      |
| UI-012 | Match Control             | Copy          | Tooltip “Release match” confirmation                  | P1       | S      | Prevent accidental release           |
| UI-009 | Dashboard manage menu     | UX            | Make menu entries button-like                         | P2       | S      | Better affordance                    |
| UI-015 | Match Control filter      | Accessibility | Ensure category list visible and focused              | P2       | M      | Essential for multipack categories   |
| UI-017 | Matches list              | UX            | Add pagination or infinite scroll                     | P2       | M      | Improves scanning performance        |
| UI-019 | Categories dropdown       | Consistency   | Button styles + confirm for bracket actions           | P2       | M      | Prevent accidental regeneration      |
| UI-020 | Seeds modal               | UX            | Sticky action bar + progress indicator                | P2       | M      | Seed workflow at scale               |
| UI-022 | Courts list               | UX            | Sort by display order                                 | P2       | S      | Predictable court numbering          |
| UI-023 | Courts status             | Consistency   | Normalize status labels/casing                        | P2       | S      | Less mental friction                 |
| UI-026 | Brackets table            | Copy          | Add legend/tooltips for abbreviations                 | P2       | S      | Parent-friendly                      |
| UI-034 | Leaderboard status filter | UX            | Convert to real tabs with focus state                 | P2       | S      | Better accessibility                 |
| UI-002 | Notifications             | Copy          | Improve empty state/aria labeling                     | P3       | S      | Minor polish                         |
| UI-003 | Global search             | Copy          | Deduplicate option titles                             | P3       | S      | Minor polish                         |
| UI-030 | Status casing             | Consistency   | Standardize display casing                            | P3       | S      | Professional polish                  |

---

## 5. JIRA-style ticket stubs (top items)

### Ticket ID: UI-001

**Title**: Bug report modal needs submit button and success feedback
**Type**: Bug
**Background / Problem**: Bug report dialog only shows textarea and “Cancel”. Users can’t submit a report and don’t know what happens.
**Proposed solution (UI only)**:

* Add primary button “Send bug report” (disabled until textarea has content)
* Show loading state during submit; on success show toast “Report sent” and close modal
  **Acceptance criteria**:
* [ ] Modal shows “Send bug report” CTA
* [ ] CTA disabled when empty, enabled when text entered
* [ ] Success toast appears after submit
  **Test steps**:

1. Open bug report (header button)
2. Enter text, click send
3. Verify toast, modal closes, and Cancel doesn’t submit

---

### Ticket ID: UI-008

**Title**: Consolidate tournament completion into single safe CTA
**Type**: Improvement
**Background / Problem**: “Move to Completed” and “Complete Tournament” appear in multiple places; duplication increases mistake risk and confuses live flow.
**Proposed solution**:

* Single “Complete tournament” action on dashboard only
* Secondary action “Move to completed” removed elsewhere or renamed consistently
* Confirmation dialog summarizing irreversible steps
  **Acceptance criteria**:
* [ ] Only one completion entry point exists
* [ ] Confirmation dialog appears
* [ ] Success feedback shown
  **Test steps**:

1. Dashboard → click completion CTA
2. Confirm → check feedback
3. Verify completion action absent on settings/match control if not intended

---

### Ticket ID: UI-012

**Title**: Promote “Score” CTA and de-prioritize “Release” in Match Control
**Type**: Improvement
**Background / Problem**: “Score” and “Release” are same emphasis; risky during live operations.
**Proposed solution**:

* “Score” primary solid button
* “Release” secondary with confirm dialog
  **Acceptance criteria**:
* [ ] “Score” visually primary
* [ ] “Release” prompts confirm
  **Test steps**:

1. Match Control → locate court card
2. Compare button styles
3. Click “Release” → confirm prompt shown

---

### Ticket ID: UI-013

**Title**: Add inline scoring validation in “Enter Match Scores” modal
**Type**: Improvement
**Background / Problem**: Numeric inputs default to 0 with no validation; users can submit impossible scores and don’t know which team wins.
**Proposed solution**:

* Required validation per game (at least one team wins by required rule)
* Display winner highlight per game
* Save disabled until match outcome is valid
  **Acceptance criteria**:
* [ ] Errors render under invalid fields
* [ ] Save disabled when incomplete/invalid
  **Test steps**:

1. Open score modal via Match Control
2. Enter invalid values (both 0)
3. Confirm error shown and Save disabled

---

### Ticket ID: UI-028

**Title**: Remove duplicate quick check-in render on Registrations page
**Type**: Bug
**Background / Problem**: Quick check-in appears twice; bottom list sometimes missing action buttons, causing confusion and inconsistent UX.
**Proposed solution**:

* Single quick check-in section per tab
* Ensure each list item has consistent “Check In” action and aria-label
  **Acceptance criteria**:
* [ ] Quick check-in appears once
* [ ] Each participant entry has a check-in button
  **Test steps**:

1. Registrations page
2. Scroll entire page
3. Verify only one quick check-in section and buttons present

---

### Ticket ID: UI-038

**Title**: Move “Delete Tournament” into danger zone with confirmation
**Type**: Improvement
**Background / Problem**: Delete button is near normal settings; easy to misclick.
**Proposed solution**:

* Separate “Danger Zone” panel at bottom with red styling
* Confirmation requires typing tournament name
  **Acceptance criteria**:
* [ ] Delete button isolated in danger section
* [ ] Typed confirmation required
  **Test steps**:

1. Open Settings
2. Scroll down
3. Verify delete is separated and requires typed confirmation
