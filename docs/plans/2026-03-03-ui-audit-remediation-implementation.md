# UI Audit Remediation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Eliminate confirmed UI trust and clarity issues from the audit in a phased, low-risk sequence with measurable verification gates.

**Architecture:** Use risk-first remediation: resolve contradictory state messaging first, then urgency semantics, then disabled-action explainability, then workflow/readability cleanup. Keep changes localized to existing Vue views/components and their paired unit/integration tests. Reuse current stores/composables and avoid new dependencies.

**Tech Stack:** Vue 3 (`<script setup lang="ts">`), Vuetify 3, Pinia, Vue Router, Vitest, @vue/test-utils, happy-dom.

---

## Guardrails

1. Follow `docs/coding-patterns/CODING_PATTERNS.md` before and during edits.
2. Apply @test-driven-development for each code change.
3. Use @systematic-debugging for any failure before proposing fixes.
4. Use @verification-before-completion before claiming a phase done.
5. Run `:log` commands after each task with code changes.

---

### Task 1: Build Issue Verification Matrix (Confirm vs False Positive)

**Files:**
- Create: `docs/plans/2026-03-03-ui-audit-verification-matrix.md`
- Modify: `docs/plans/2026-03-03-ui-audit-remediation-design.md`

**Step 1: Add verification matrix template**

```markdown
# UI Audit Verification Matrix
| Issue | Route | Repro Steps | Expected | Actual | Status (Confirmed/False Positive) | Evidence |
|---|---|---|---|---|---|---|
| Persistent "Changes not saved" banner | /tournaments | ... | Banner only on dirty form pages | Not observed manually | False Positive | Screenshot ref |
```

**Step 2: Populate matrix for all 16 audited rows**

Run manual route checks and fill statuses.

**Step 3: Update design doc with confirmed issue list**

```markdown
## Confirmed Issues
1. ...
2. ...
```

**Step 4: Commit**

```bash
git add docs/plans/2026-03-03-ui-audit-verification-matrix.md docs/plans/2026-03-03-ui-audit-remediation-design.md
git commit -m "docs: add UI audit verification matrix and confirmed issue list"
```

---

### Task 2: Fix Public Schedule Contradictory Publish Messaging

**Files:**
- Modify: `src/features/public/views/PublicScheduleView.vue`
- Modify: `tests/unit/PublicScheduleView.test.ts`
- Test: `tests/integration/public-views.integration.test.ts`

**Step 1: Write failing unit test for contradictory state**

```typescript
it('does not show "Schedule not published yet" when display sections have match data', async () => {
  // Arrange mock matches so category pulse/queue has data
  // Assert banner hidden when any public-visible schedule/live sections are populated
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:log -- --run tests/unit/PublicScheduleView.test.ts`  
Expected: FAIL on contradictory-state assertion.

**Step 3: Implement minimal precedence logic in view state**

```typescript
const hasAnyPublicScheduleData = computed(() =>
  hasPublishedSchedule.value ||
  displayQueueItems.value.length > 0 ||
  nowPlayingItems.value.length > 0 ||
  categoryPulseItems.value.length > 0
);
```

```vue
<v-alert v-if="!hasAnyPublicScheduleData" type="info" variant="tonal">
  Schedule not published yet.
</v-alert>
```

**Step 4: Run focused tests**

Run: `npm run test:log -- --run tests/unit/PublicScheduleView.test.ts`  
Expected: PASS.

Run: `npm run test:log -- --run tests/integration/public-views.integration.test.ts`  
Expected: PASS.

Run: `npm run lint:log`  
Expected: PASS.

**Step 5: Commit**

```bash
git add src/features/public/views/PublicScheduleView.vue tests/unit/PublicScheduleView.test.ts
git commit -m "fix(public-schedule): prevent contradictory unpublished messaging"
```

---

### Task 3: Recalibrate Queue Urgency Labels and Sorting

**Files:**
- Modify: `src/features/tournaments/components/MatchQueueList.vue`
- Modify: `tests/unit/MatchControlView.assignments.test.ts`

**Step 1: Write failing test for urgency dilution**

```typescript
it('marks only exceptional queue rows as urgent', async () => {
  // Arrange ready matches with mixed wait times and court availability
  // Assert only subset receives urgent label
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:log -- --run tests/unit/MatchControlView.assignments.test.ts`  
Expected: FAIL where all ready matches are currently urgent.

**Step 3: Implement minimal urgency threshold model**

```typescript
if (isReady && hasCourtsAvailable && minutes >= 5) return 'urgent';
if (minutes >= 15) return 'high';
return 'normal';
```

```typescript
function getUrgencyLabel(urgency: UrgencyLevel): string {
  if (urgency === 'urgent') return 'URGENT';
  if (urgency === 'high') return 'HIGH';
  return 'NORMAL';
}
```

**Step 4: Run tests and lint**

Run: `npm run test:log -- --run tests/unit/MatchControlView.assignments.test.ts`  
Expected: PASS.

Run: `npm run lint:log`  
Expected: PASS.

**Step 5: Commit**

```bash
git add src/features/tournaments/components/MatchQueueList.vue tests/unit/MatchControlView.assignments.test.ts
git commit -m "fix(queue): restore urgency signal semantics"
```

---

### Task 4: Clarify Create Tournament Disabled Continue States

**Files:**
- Modify: `src/features/tournaments/views/TournamentCreateView.vue`
- Modify: `tests/unit/TournamentCreateView.test.ts`

**Step 1: Write failing test for step validation and disabled reason**

```typescript
it('shows clear reason when Continue is disabled for current step', async () => {
  // Arrange step with invalid inputs
  // Assert helper text / tooltip contains missing requirement
});
```

```typescript
it('uses current-step validation mapping correctly', async () => {
  // Assert step 2 uses categories validation, step 3 uses courts validation
});
```

**Step 2: Run tests to verify they fail**

Run: `npm run test:log -- --run tests/unit/TournamentCreateView.test.ts`  
Expected: FAIL on disabled reason and/or mapping assertions.

**Step 3: Implement minimal validation mapping + reason text**

```typescript
const isStep2Valid = computed(() => selectedCategories.value.length > 0 || customCategories.value.length > 0);
const isStep3Valid = computed(() => courts.value.length > 0);

const continueDisabledReason = computed(() => {
  if (currentStep.value === 1 && !isStep1Valid.value) return 'Complete basic info and valid dates.';
  if (currentStep.value === 2 && !isStep2Valid.value) return 'Add at least one category.';
  if (currentStep.value === 3 && !isStep3Valid.value) return 'Add at least one court.';
  return '';
});
```

```vue
<v-tooltip :disabled="!continueDisabledReason">
  <template #activator="{ props: tooltipProps }">
    <span v-bind="tooltipProps">
      <v-btn :disabled="Boolean(continueDisabledReason)">Continue</v-btn>
    </span>
  </template>
  <span>{{ continueDisabledReason }}</span>
</v-tooltip>
```

**Step 4: Run tests and lint**

Run: `npm run test:log -- --run tests/unit/TournamentCreateView.test.ts`  
Expected: PASS.

Run: `npm run lint:log`  
Expected: PASS.

**Step 5: Commit**

```bash
git add src/features/tournaments/views/TournamentCreateView.vue tests/unit/TournamentCreateView.test.ts
git commit -m "fix(create): explain disabled continue and align step validation"
```

---

### Task 5: Clarify Disabled Check-In Actions in Rapid Panel

**Files:**
- Modify: `src/features/checkin/components/RapidCheckInPanel.vue`
- Modify: `tests/unit/RapidCheckInPanel.test.ts`

**Step 1: Write failing test for disabled check-in reason visibility**

```typescript
it('provides reason when urgent-row check-in is disabled', async () => {
  // Arrange urgent item with canCheckIn=false
  // Assert tooltip/subtitle reason rendered
});
```

**Step 2: Run test to verify failure**

Run: `npm run test:log -- --run tests/unit/RapidCheckInPanel.test.ts`  
Expected: FAIL due to missing reason text.

**Step 3: Implement minimal disabled reason contract**

```typescript
interface UrgentItem {
  id: string;
  title: string;
  subtitle: string;
  canCheckIn: boolean;
  disabledReason?: string;
}
```

```vue
<v-tooltip :disabled="item.canCheckIn || !item.disabledReason">
  <template #activator="{ props: tooltipProps }">
    <span v-bind="tooltipProps">
      <v-btn :disabled="!item.canCheckIn">Check In</v-btn>
    </span>
  </template>
  <span>{{ item.disabledReason }}</span>
</v-tooltip>
```

**Step 4: Run tests and lint**

Run: `npm run test:log -- --run tests/unit/RapidCheckInPanel.test.ts`  
Expected: PASS.

Run: `npm run lint:log`  
Expected: PASS.

**Step 5: Commit**

```bash
git add src/features/checkin/components/RapidCheckInPanel.vue tests/unit/RapidCheckInPanel.test.ts
git commit -m "fix(checkin): add disabled-action reasons in rapid panel"
```

---

### Task 6: Confirm Command vs Live Context Separation

**Files:**
- Modify: `src/features/tournaments/views/MatchControlView.vue`
- Modify: `tests/unit/navigationGuards.test.ts`
- Modify: `tests/unit/MatchControlView.assignments.test.ts`

**Step 1: Write failing test for read-only queue mode controls**

```typescript
it('hides operational controls in queue/live mode', async () => {
  // Assert no operational emit bindings and readOnly=true for queue mode blocks
});
```

**Step 2: Run test to verify it fails (if regression exists)**

Run: `npm run test:log -- --run tests/unit/MatchControlView.assignments.test.ts`  
Expected: FAIL if queue mode exposes controls.

**Step 3: Implement minimal route/view alignment**

```typescript
// Keep live-view redirect to queue query mode
redirect: to => `/tournaments/${to.params.tournamentId}/match-control?view=queue`
```

```vue
<match-queue-list :read-only="viewMode === 'queue'" />
```

**Step 4: Run tests and lint**

Run: `npm run test:log -- --run tests/unit/MatchControlView.assignments.test.ts`  
Expected: PASS.

Run: `npm run test:log -- --run tests/unit/navigationGuards.test.ts`  
Expected: PASS.

Run: `npm run lint:log`  
Expected: PASS.

**Step 5: Commit**

```bash
git add src/features/tournaments/views/MatchControlView.vue tests/unit/MatchControlView.assignments.test.ts tests/unit/navigationGuards.test.ts
git commit -m "fix(workflow): enforce read-only live queue context"
```

---

### Task 7: Improve Long URL Responsiveness in Overlay Links

**Files:**
- Modify: `src/features/overlay/views/OverlayLinksView.vue`
- Modify: `tests/unit/OverlayBoardView.test.ts` (or add a dedicated OverlayLinks view test)

**Step 1: Write failing test for long URL rendering behavior**

```typescript
it('keeps long URLs readable without layout break on narrow widths', async () => {
  // Assert truncation + copy action availability remain intact
});
```

**Step 2: Run test to verify failure**

Run: `npm run test:log -- --run tests/unit/OverlayBoardView.test.ts`  
Expected: FAIL or missing coverage for overlay links behavior.

**Step 3: Implement minimal responsive table behavior**

```css
.overlay-url-cell {
  max-width: min(700px, 45vw);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
@media (max-width: 960px) {
  .overlay-url-cell {
    max-width: 220px;
  }
}
```

**Step 4: Run tests, lint, and build**

Run: `npm run lint:log`  
Expected: PASS.

Run: `npm run test:log -- --run tests/unit/OverlayBoardView.test.ts`  
Expected: PASS.

Run: `npm run build:log`  
Expected: PASS.

**Step 5: Commit**

```bash
git add src/features/overlay/views/OverlayLinksView.vue tests/unit/OverlayBoardView.test.ts
git commit -m "fix(overlays): improve long URL responsiveness on small screens"
```

---

### Task 8: Capture New/Updated Coding Pattern and Final Verification

**Files:**
- Modify: `docs/coding-patterns/CODING_PATTERNS.md`
- Create (if needed): `docs/fix/<new-fix-guide>.md`

**Step 1: Add one new pattern for confirmed bug class**

Candidate: disabled primary actions must expose immediate reason in UI context.

**Step 2: Add detection command and run it**

```bash
rg -n ":disabled=\"[^\"]+\"" src/features --glob "*.vue"
```

Expected: Identify remaining candidate violations and record count.

**Step 3: Run final verification suite**

Run: `npm run lint:log`  
Run: `npm run test:log -- --run`  
Run: `npm run build:log`

Expected: all pass, or failures handled through Debug KB protocol.

**Step 4: Update Debug KB if any `:log` command fails**

Record fingerprint, lookup existing entry, apply fix(final), and append verification evidence.

**Step 5: Commit**

```bash
git add docs/coding-patterns/CODING_PATTERNS.md docs/fix/*.md
git commit -m "docs(patterns): capture UI audit remediation pattern and verification"
```

