# Public Schedule Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign `PublicScheduleView.vue` to replace the cluttered Category Pulse + flat match list layout with a clean three-zone layout: Now Playing (court cards) → Up Next (compact list) → Full Schedule (time-sorted table).

**Architecture:** Template-only rewrite of the non-Display-Mode `v-else` block (~lines 858–1700). The Display Mode template and ~95% of the `<script setup>` stay untouched. Unused script code (player/team filter refs and computeds) is removed in Task 1. No new stores, composables, or Firestore queries.

**Tech Stack:** Vue 3 `<script setup>`, Vuetify 3, CSS Grid for Now Playing court cards.

---

## Critical files to read before starting

- [src/features/public/views/PublicScheduleView.vue](src/features/public/views/PublicScheduleView.vue) — the only file being changed
  - Lines 1–661: `<script setup>` — read to understand computed properties
  - Lines 663–856: Display Mode template — **do NOT touch**
  - Lines 857–1699: non-Display-Mode template — **full replacement**

**Key computed properties to use in new template:**
- `nowPlayingItems` — `PublicScheduleItem[]` of in-progress matches (filtered by category)
- `displayQueueItems` — `PublicScheduleItem[]` of upcoming/ready matches, max 8 (filtered by category)
- `filteredScheduleItems` — ALL published matches, category-filtered, sorted by `plannedStartAt`
- `hasPublishedSchedule` — `boolean` whether any published matches exist
- `categories` — category objects from store
- `selectedCategoryId` — `string`, `'all'` or a category ID
- `tournament` — current tournament
- `tournamentId` — computed string
- `getPublicStatus(match)` → `'on_court' | 'upcoming' | 'delayed' | 'finished' | 'cancelled'`
- `getStatusColor(status)` → Vuetify color string
- `getStatusLabel(status)` → display string
- `getStartHint(match)` → relative time hint
- `formatTime(date)` → `'HH:MM'` string
- `setDisplayMode(bool)` → switches display mode

**Each `PublicScheduleItem` has:**
```typescript
{
  match: Match,
  categoryId: string,
  categoryLabel: string,
  matchup: string,           // "Player A vs Player B"
  roundLabel: string,
  participant1: { displayName: string, ... },
  participant2: { displayName: string, ... },
}
```

---

## Task 1: Script cleanup + add `getCourtName`

**File:**
- Modify: `src/features/public/views/PublicScheduleView.vue` (script section only)

Read the file first. Then make these targeted removals in the `<script setup>`:

**Step 1: Remove unused refs (lines ~72–74)**

Remove these three lines:
```typescript
const searchQuery = ref('');
const selectedPlayerId = ref<string | null>(null);
const selectedTeamName = ref<string | null>(null);
```

**Step 2: Remove unused interfaces (lines ~57–60)**

Remove the `FilterOption` interface:
```typescript
interface FilterOption {
  title: string;
  value: string;
}
```

**Step 3: Remove unused computeds (find by name)**

Remove these computed properties entirely (they are only used by the filter UI being removed):
- `availablePlayerOptions`
- `availableTeamOptions`
- `selectedPlayerLabel`
- `hasActiveFilters`
- `normalizedQuery`
- `normalizedTeamFilter`
- `groupedSchedule` (the old category-grouped view, no longer used)

**Step 4: Remove `matchesFilterCriteria` and its usages**

Remove the `matchesFilterCriteria` function. Then in `nowPlayingItems`, `upNextItems`, `fallbackQueueItems`, and `recentResultItems`, remove the `.filter(matchesFilterCriteria)` call from each.

**Step 5: Remove `clearParticipantFilters` function**

```typescript
// Remove this entire function:
function clearParticipantFilters(): void {
  searchQuery.value = '';
  selectedPlayerId.value = null;
  selectedTeamName.value = null;
}
```

**Step 6: Remove `watchFilterValidity` function and its two call-sites**

Remove:
```typescript
function watchFilterValidity(...) { ... }

watchFilterValidity(() => availablePlayerOptions.value, selectedPlayerId);
watchFilterValidity(() => availableTeamOptions.value, selectedTeamName);
```

**Step 7: Add `getCourtName` helper** (add near the other helper functions, after `getCategoryLabel`):

```typescript
function getCourtName(courtId: string | null | undefined): string {
  if (!courtId) return 'TBD';
  return tournamentStore.courts.find((c) => c.id === courtId)?.name ?? 'TBD';
}
```

**Step 8: Verify TypeScript compiles**
```bash
bun run type-check 2>&1 | tail -5
```
Expected: no new errors (or just the pre-existing module-not-found errors in router).

**Step 9: Commit**
```bash
git add src/features/public/views/PublicScheduleView.vue
git commit -m "refactor: remove unused filter refs/computeds from PublicScheduleView script"
```

---

## Task 2: Replace the non-Display-Mode template

**File:**
- Modify: `src/features/public/views/PublicScheduleView.vue` (template section only)

The non-Display-Mode template starts at `<v-container` with `v-else` (the line after the closing `</div>` of the `display-mode` section, around line 857). **Everything from that `<v-container v-else` to the end of the `<template>` block gets replaced.**

**Step 1: Find the exact start of the v-else block**

Search for:
```
<v-container
    v-else
    max-width="1180"
```
Note the line number — this is where the replacement starts. The replacement ends at `</template>` (the final closing tag in the file).

**Step 2: Replace everything from that line to end-of-template with this new template:**

```html
  <v-container
    v-else
    max-width="1180"
    class="pb-8"
  >
    <v-alert
      v-if="notFound"
      type="error"
      class="mt-8"
    >
      Tournament not found.
    </v-alert>

    <template v-else>
      <!-- ─── Header ──────────────────────────────────────────────── -->
      <div class="schedule-header mt-6 mb-3">
        <div>
          <h1 class="text-h5 font-weight-bold">
            {{ tournament?.name || 'Tournament' }}
          </h1>
          <div class="text-caption text-medium-emphasis">
            Live Schedule · Auto-refreshing every 30s · Times in your local timezone
          </div>
        </div>
        <div class="schedule-header__actions">
          <v-btn
            size="small"
            variant="outlined"
            prepend-icon="mdi-monitor"
            @click="setDisplayMode(true)"
          >
            Display Mode
          </v-btn>
          <v-btn
            :to="`/tournaments/${tournamentId}/player`"
            size="small"
            variant="tonal"
            color="primary"
            prepend-icon="mdi-account-clock"
          >
            My Schedule
          </v-btn>
          <v-btn
            :to="`/tournaments/${tournamentId}/bracket`"
            size="small"
            variant="outlined"
            prepend-icon="mdi-tournament"
          >
            Brackets
          </v-btn>
        </div>
      </div>

      <!-- ─── Category filter chips ────────────────────────────────── -->
      <v-chip-group
        v-if="categories.length > 1"
        :model-value="selectedCategoryId"
        mandatory
        class="mb-5"
        @update:model-value="updateCategoryFilter"
      >
        <v-chip
          value="all"
          variant="outlined"
          size="small"
        >
          All
        </v-chip>
        <v-chip
          v-for="cat in categories"
          :key="cat.id"
          :value="cat.id"
          variant="outlined"
          size="small"
        >
          {{ cat.name }}
        </v-chip>
      </v-chip-group>

      <!-- ─── Zone 1: Now Playing ──────────────────────────────────── -->
      <section
        v-if="nowPlayingItems.length > 0"
        class="mb-7"
      >
        <div class="section-label mb-3">
          <v-icon
            color="success"
            size="10"
            class="mr-2"
          >
            mdi-circle
          </v-icon>
          <span class="text-overline font-weight-bold">Now Playing</span>
          <v-chip
            size="x-small"
            color="success"
            variant="tonal"
            class="ml-2"
          >
            {{ nowPlayingItems.length }}
          </v-chip>
        </div>

        <div class="now-playing-grid">
          <v-card
            v-for="item in nowPlayingItems"
            :key="`live-${item.match.id}`"
            variant="tonal"
            color="success"
            class="court-card"
          >
            <v-card-text class="pa-3">
              <div class="d-flex align-center justify-space-between mb-2">
                <span class="text-caption font-weight-bold text-uppercase text-success">
                  {{ getCourtName(item.match.courtId) }}
                </span>
                <v-chip
                  size="x-small"
                  color="success"
                  variant="flat"
                >
                  LIVE
                </v-chip>
              </div>
              <div class="court-card__player font-weight-bold text-body-2">
                {{ item.participant1.displayName }}
              </div>
              <div class="court-card__vs text-caption text-medium-emphasis text-center my-1">
                vs
              </div>
              <div class="court-card__player font-weight-bold text-body-2">
                {{ item.participant2.displayName }}
              </div>
              <div class="text-caption text-medium-emphasis mt-2">
                {{ item.categoryLabel }}
              </div>
            </v-card-text>
          </v-card>
        </div>
      </section>

      <!-- ─── Zone 2: Up Next ──────────────────────────────────────── -->
      <section class="mb-7">
        <div class="section-label mb-3">
          <v-icon
            size="14"
            class="mr-2"
          >
            mdi-clock-outline
          </v-icon>
          <span class="text-overline font-weight-bold">Up Next</span>
          <span
            v-if="displayQueueItems.length > 0"
            class="text-caption text-medium-emphasis ml-2"
          >
            {{ displayQueueItems.length }} matches
          </span>
        </div>

        <v-card variant="outlined">
          <v-list
            v-if="displayQueueItems.length > 0"
            density="compact"
          >
            <v-list-item
              v-for="item in displayQueueItems"
              :key="`next-${item.match.id}`"
              class="py-2"
            >
              <v-list-item-title class="text-body-2">
                {{ item.matchup }}
              </v-list-item-title>
              <v-list-item-subtitle class="text-caption">
                {{ formatTime(item.match.plannedStartAt) }}
                · {{ getCourtName(item.match.courtId ?? item.match.plannedCourtId) }}
                · {{ item.categoryLabel }}
              </v-list-item-subtitle>
              <template #append>
                <v-chip
                  size="x-small"
                  :color="getStatusColor(getPublicStatus(item.match))"
                  variant="tonal"
                >
                  {{ getStartHint(item.match) }}
                </v-chip>
              </template>
            </v-list-item>
          </v-list>
          <v-card-text
            v-else
            class="text-center text-grey py-5"
          >
            No upcoming matches at this time.
          </v-card-text>
        </v-card>
      </section>

      <!-- ─── Zone 3: Full Schedule ────────────────────────────────── -->
      <section class="mb-6">
        <div class="section-label mb-3">
          <v-icon
            size="14"
            class="mr-2"
          >
            mdi-calendar-clock
          </v-icon>
          <span class="text-overline font-weight-bold">Full Schedule</span>
          <span
            v-if="filteredScheduleItems.length > 0"
            class="text-caption text-medium-emphasis ml-2"
          >
            {{ filteredScheduleItems.length }} matches
          </span>
        </div>

        <!-- No schedule published yet -->
        <v-card
          v-if="!hasPublishedSchedule"
          variant="outlined"
        >
          <v-card-text class="text-center text-grey py-10">
            <v-icon
              size="48"
              class="mb-3 d-block"
            >
              mdi-calendar-blank
            </v-icon>
            Schedule not yet published.
            <div class="text-caption mt-1">
              Check back soon.
            </div>
          </v-card-text>
        </v-card>

        <!-- Match list -->
        <v-card
          v-else
          variant="outlined"
        >
          <v-list density="compact">
            <template
              v-for="(item, index) in filteredScheduleItems"
              :key="`sched-${item.match.id}`"
            >
              <v-divider v-if="index > 0" />
              <v-list-item
                :class="getPublicStatus(item.match) === 'finished' ? 'schedule-row--finished' : ''"
                class="py-2"
              >
                <template #prepend>
                  <div class="schedule-time mr-3">
                    <div class="text-body-2 font-weight-medium">
                      {{ formatTime(item.match.plannedStartAt) }}
                    </div>
                  </div>
                </template>
                <v-list-item-title class="text-body-2">
                  {{ item.matchup }}
                </v-list-item-title>
                <v-list-item-subtitle class="text-caption">
                  {{ getCourtName(item.match.courtId ?? item.match.plannedCourtId) }}
                  · {{ item.categoryLabel }}
                  · {{ item.roundLabel }}
                </v-list-item-subtitle>
                <template #append>
                  <v-chip
                    size="x-small"
                    :color="getStatusColor(getPublicStatus(item.match))"
                    variant="tonal"
                  >
                    {{ getStatusLabel(getPublicStatus(item.match)) }}
                  </v-chip>
                </template>
              </v-list-item>
            </template>
          </v-list>
        </v-card>
      </section>
    </template>
  </v-container>
</template>
```

**Step 3: Verify build**
```bash
bun run build 2>&1 | grep -E "error|warning" | grep -v "node_modules" | head -20
```
Expected: Build succeeds (0 errors).

**Step 4: Manual browser check**
Navigate to `http://localhost:3000/tournaments/6M5LfYOq933JTLxajCTG/schedule`
- Page loads with tournament name header
- Three action buttons visible: Display Mode, My Schedule, Brackets
- Category filter chips shown (if multiple categories)
- Now Playing section visible only if matches in progress
- Up Next shows next matches
- Full Schedule shows all published matches

**Step 5: Commit**
```bash
git add src/features/public/views/PublicScheduleView.vue
git commit -m "feat: redesign public schedule page with 3-zone layout"
```

---

## Task 3: Remove old CSS, add new styles

**File:**
- Modify: `src/features/public/views/PublicScheduleView.vue` (style section only)

The existing `<style scoped>` section has styles for the old layout that are no longer needed. Read the existing style section (it starts around line 1030 in the original file, now line ~) and remove styles for classes that no longer exist in the template. Then add new styles for the new layout.

**Step 1: Remove old CSS classes** that are no longer referenced in the new template:

Remove blocks for these class names:
- `.public-summary-card` and `.public-summary-card--live`
- `.schedule-filter-row`, `.schedule-filter-row__filters`, `.schedule-filter-row__active-chips`
- `.schedule-group`, `.schedule-group__header`, `.schedule-group__badge`
- `.schedule-row`, `.schedule-row__time-block`, `.schedule-row__end`, `.schedule-row__details`
- `.schedule-row__matchup`, `.schedule-row__status`
- `.schedule-row--live`, `.schedule-row--delayed`
- Any `.category-pulse` related styles

Keep all `.display-mode__*` styles (they are still used by Display Mode).
Keep `.schedule-header` and `.schedule-header__actions` styles.

**Step 2: Add new CSS at the end of the `<style scoped>` block:**

```css
/* Section label row */
.section-label {
  display: flex;
  align-items: center;
}

/* Now Playing court card grid */
.now-playing-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
}

.court-card {
  min-height: 130px;
}

.court-card__player {
  line-height: 1.3;
  word-break: break-word;
}

.court-card__vs {
  text-align: center;
  font-size: 0.75rem;
}

/* Full Schedule time column */
.schedule-time {
  min-width: 52px;
  white-space: nowrap;
}

/* Dimmed finished rows */
.schedule-row--finished {
  opacity: 0.55;
}
```

**Step 3: Verify build**
```bash
bun run build 2>&1 | tail -5
```
Expected: `✓ built in X.XXs`

**Step 4: Manual check — Display Mode still works**
Click "Display Mode" button → full-screen wall display renders with Now Playing, Up Next, Category Pulse, ticker. Press Escape → returns to normal view.

**Step 5: Commit**
```bash
git add src/features/public/views/PublicScheduleView.vue
git commit -m "style: update public schedule CSS for new 3-zone layout"
```

---

## Verification Checklist

Run before declaring done:

1. **Build passes**
   ```bash
   bun run build 2>&1 | tail -5
   ```

2. **Type check clean**
   ```bash
   bun run type-check 2>&1 | tail -5
   ```

3. **No auth needed** — navigate to `/tournaments/:id/schedule` in incognito. Page loads without redirect.

4. **Category chips** — click a category chip → All three zones filter to that category only.

5. **Now Playing** — if no live matches: section is hidden entirely (not "No matches" text).

6. **Up Next** — shows next matches with time, court, hint chip.

7. **Full Schedule** — all published matches visible sorted by time. Finished rows are dimmed. Unpublished = "Schedule not yet published" card.

8. **My Schedule button** → navigates to `/player` page.

9. **Brackets button** → navigates to `/bracket` page.

10. **Display Mode** — button enters full-screen wall display. Escape exits. Display Mode shows Now Playing, Up Next, Category Pulse, ticker exactly as before.

11. **Real-time** — leave page open, change a match status in admin → section updates without refresh.

---

## Execution options

**1. Subagent-Driven (this session)** — fresh subagent per task, review between tasks
**2. Parallel Session (separate)** — new session using `superpowers:executing-plans`
