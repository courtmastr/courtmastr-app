# Front Desk Keyboard Fast Lane Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Improve Front Desk check-in throughput for keyboard-first operation while reducing wrong-participant and duplicate/undo mistakes.

**Architecture:** Extend the existing Front Desk check-in stack in place: keep `useFrontDeskCheckInWorkflow` as business-logic authority, add deterministic keyboard targeting to `RapidCheckInPanel`, and wire view-level shortcut/actions in `FrontDeskCheckInView`. Use additive API changes and focused test updates to minimize regression risk.

**Tech Stack:** Vue 3 (`<script setup lang="ts">`), TypeScript strict mode, Vuetify 3, Pinia stores, Vitest + `@vue/test-utils`.

---

## Guardrails

1. Read and follow `docs/coding-patterns/CODING_PATTERNS.md` before edits.
2. Keep changes scoped to check-in files only.
3. No `any`, no `@ts-ignore`, no new dependencies.
4. Use tests-first per task.
5. Run build verification after each completed task group.

---

### Task 1: Add Keyboard Targeting Contract To Rapid Panel

**Files:**
- Modify: `src/features/checkin/components/RapidCheckInPanel.vue`
- Modify: `tests/unit/RapidCheckInPanel.test.ts`

**Step 1: Write failing tests for keyboard navigation behavior**

```typescript
it('moves active suggestion with arrow keys and checks in active row on Enter', async () => {
  // Arrange two approved suggestions and type a query.
  // ArrowDown selects first row, second ArrowDown selects second row.
  // Enter emits quickCheckIn for second row id only.
});

it('clears suggestions with Escape', async () => {
  // Arrange typed query + visible suggestions.
  // Trigger Escape and assert no suggestions rendered.
});
```

**Step 2: Run test to verify failure**

Run: `npm run test -- --run tests/unit/RapidCheckInPanel.test.ts`  
Expected: FAIL due to missing active-index keyboard behavior.

**Step 3: Implement minimal keyboard state + handlers**

```typescript
const activeSuggestionIndex = ref(-1);

const onInputKeydown = (event: KeyboardEvent): void => {
  if (event.key === 'ArrowDown') { /* move index */ }
  if (event.key === 'ArrowUp') { /* move index */ }
  if (event.key === 'Escape') { /* clear query/list */ }
  if (event.key === 'Enter') { /* emit quickCheckIn for active approved row */ }
};
```

**Step 4: Run test to verify pass**

Run: `npm run test -- --run tests/unit/RapidCheckInPanel.test.ts`  
Expected: PASS.

**Step 5: Commit**

```bash
git add src/features/checkin/components/RapidCheckInPanel.vue tests/unit/RapidCheckInPanel.test.ts
git commit -m "feat(checkin): add deterministic keyboard targeting in rapid panel"
```

---

### Task 2: Surface Richer Row Identity And Action Guards

**Files:**
- Modify: `src/features/checkin/composables/useFrontDeskCheckInWorkflow.ts`
- Modify: `src/features/checkin/components/RapidCheckInPanel.vue`
- Modify: `tests/unit/useFrontDeskCheckInWorkflow.test.ts`
- Modify: `tests/unit/RapidCheckInPanel.test.ts`

**Step 1: Write failing tests for row identity and ineligible action safety**

```typescript
it('exposes sufficient row metadata for disambiguation', () => {
  // Assert bulk/search rows include category and status fields used in UI.
});

it('prevents quick check-in action for non-approved statuses', async () => {
  // Assert check-in action is disabled and emits no event.
});
```

**Step 2: Run tests to verify failure**

Run: `npm run test -- --run tests/unit/useFrontDeskCheckInWorkflow.test.ts tests/unit/RapidCheckInPanel.test.ts`  
Expected: FAIL on missing/insufficient metadata or guard behavior.

**Step 3: Implement minimal metadata rendering and action guard**

```vue
<v-list-item-subtitle>
  {{ row.category }}<span v-if="row.partnerName"> • Partner: {{ row.partnerName }}</span>
</v-list-item-subtitle>
```

```typescript
if (row.status !== 'approved') return;
```

**Step 4: Run tests to verify pass**

Run: `npm run test -- --run tests/unit/useFrontDeskCheckInWorkflow.test.ts tests/unit/RapidCheckInPanel.test.ts`  
Expected: PASS.

**Step 5: Commit**

```bash
git add src/features/checkin/composables/useFrontDeskCheckInWorkflow.ts src/features/checkin/components/RapidCheckInPanel.vue tests/unit/useFrontDeskCheckInWorkflow.test.ts tests/unit/RapidCheckInPanel.test.ts
git commit -m "feat(checkin): strengthen rapid-row disambiguation and action guards"
```

---

### Task 3: Add Undo-Latest Shortcut Path

**Files:**
- Modify: `src/features/checkin/composables/useFrontDeskCheckInWorkflow.ts`
- Modify: `src/features/checkin/components/RapidCheckInPanel.vue`
- Modify: `src/features/checkin/views/FrontDeskCheckInView.vue`
- Modify: `tests/unit/useFrontDeskCheckInWorkflow.test.ts`
- Modify: `tests/unit/FrontDeskCheckInView.test.ts`

**Step 1: Write failing tests for keyboard undo behavior**

```typescript
it('undoes the most recent eligible check-in within window', async () => {
  // Check in one participant, trigger undo-latest, expect undoCheckInRegistration called.
});

it('does not undo when latest token expired', async () => {
  // Advance fake timers beyond window and assert rejection.
});
```

```typescript
it('wires panel undo-latest event to workflow undo action', async () => {
  // Emit panel event and assert workflow undo called.
});
```

**Step 2: Run tests to verify failure**

Run: `npm run test -- --run tests/unit/useFrontDeskCheckInWorkflow.test.ts tests/unit/FrontDeskCheckInView.test.ts`  
Expected: FAIL on missing undo-latest API/event wiring.

**Step 3: Implement minimal undo-latest API + emit wiring**

```typescript
const undoLatest = async (): Promise<void> => {
  const latest = recentItems.value[0];
  if (!latest?.canUndo) throw new Error('Undo window expired');
  await undoItem(latest.id);
};
```

```typescript
// Panel emit
undoLatestShortcut: [];
```

```vue
@undo-latest-shortcut="handleUndoLatestShortcut"
```

**Step 4: Run tests to verify pass**

Run: `npm run test -- --run tests/unit/useFrontDeskCheckInWorkflow.test.ts tests/unit/FrontDeskCheckInView.test.ts`  
Expected: PASS.

**Step 5: Commit**

```bash
git add src/features/checkin/composables/useFrontDeskCheckInWorkflow.ts src/features/checkin/components/RapidCheckInPanel.vue src/features/checkin/views/FrontDeskCheckInView.vue tests/unit/useFrontDeskCheckInWorkflow.test.ts tests/unit/FrontDeskCheckInView.test.ts
git commit -m "feat(checkin): add keyboard undo-latest flow for rapid desk operation"
```

---

### Task 4: Add Throughput Strip And Countdown Copy

**Files:**
- Modify: `src/features/checkin/composables/useFrontDeskCheckInWorkflow.ts`
- Modify: `src/features/checkin/views/FrontDeskCheckInView.vue`
- Modify: `tests/unit/FrontDeskCheckInView.test.ts`

**Step 1: Write failing test for throughput strip rendering**

```typescript
it('shows recent throughput metrics in top stats card', async () => {
  // Mock workflow metrics and assert label/value rendering.
});
```

**Step 2: Run test to verify failure**

Run: `npm run test -- --run tests/unit/FrontDeskCheckInView.test.ts`  
Expected: FAIL due to missing throughput UI.

**Step 3: Implement minimal derived metrics and UI strip**

```typescript
const throughput = computed(() => ({
  checkInsLastFiveMinutes: ...,
  avgSecondsPerCheckIn: ...,
}));
```

```vue
<div class="text-caption">
  Last 5 min: {{ throughput.checkInsLastFiveMinutes }} • Avg/check-in: {{ throughput.avgSecondsPerCheckIn }}s
</div>
```

**Step 4: Run test to verify pass**

Run: `npm run test -- --run tests/unit/FrontDeskCheckInView.test.ts`  
Expected: PASS.

**Step 5: Commit**

```bash
git add src/features/checkin/composables/useFrontDeskCheckInWorkflow.ts src/features/checkin/views/FrontDeskCheckInView.vue tests/unit/FrontDeskCheckInView.test.ts
git commit -m "feat(checkin): add front desk throughput strip for peak operation visibility"
```

---

### Task 5: Final Verification And KB Logging

**Files:**
- Modify as needed: `docs/debug-kb/<fingerprint>.md`
- Modify as needed: `docs/debug-kb/index.yml`

**Step 1: Run targeted tests**

Run:
- `npm run test -- --run tests/unit/RapidCheckInPanel.test.ts`
- `npm run test -- --run tests/unit/useFrontDeskCheckInWorkflow.test.ts`
- `npm run test -- --run tests/unit/FrontDeskCheckInView.test.ts`

Expected: PASS.

**Step 2: Run required build verification**

Run:
- `npm run build`
- `npm run build:log`

Expected: Build may fail on known baseline TS issues; capture fingerprint if so.

**Step 3: Follow Debug KB protocol if any `:log` command fails**

```bash
ls docs/debug-kb | grep <fingerprint>
```

If existing entry: append one attempt for this change.  
If missing: create from template and add index record.

**Step 4: Commit verification/docs updates**

```bash
git add docs/debug-kb/index.yml docs/debug-kb/*.md
git commit -m "docs(debug-kb): record verification fingerprints for front desk keyboard fast lane"
```
