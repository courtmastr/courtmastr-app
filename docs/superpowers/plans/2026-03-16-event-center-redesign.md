# Event Center Redesign Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the cluttered TournamentDashboardView with a focused organizer dashboard: clean header, 4 stat cards, status+CTA bar, quick links, and a 2-column operations area (Active Matches left, Ready Queue + Category Progress right).

**Architecture:** Create one new component (`CategoryProgressPanel`) for read-only per-category progress bars. Rewrite the `TournamentDashboardView` template with a new outer layout while keeping all existing sub-components (ActiveMatchesSection, ReadyQueue, OrganizerChecklist) and all dialogs unchanged. Script changes are minimal — remove 3 unused imports, add 6 new computeds and 2 new handler functions.

**Tech Stack:** Vue 3 Composition API, Vuetify 3, TypeScript, SCSS, Vitest + Vue Test Utils

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/features/tournaments/components/CategoryProgressPanel.vue` | **Create** | Read-only list of per-category progress bars |
| `src/features/tournaments/views/TournamentDashboardView.vue` | **Modify** | New template layout + script cleanup + new scoped styles |

---

## Chunk 1: CategoryProgressPanel component

### Task 1: Create and test CategoryProgressPanel

**Files:**
- Create: `src/features/tournaments/components/CategoryProgressPanel.vue`
- Create: `tests/unit/CategoryProgressPanel.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/unit/CategoryProgressPanel.test.ts
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import CategoryProgressPanel from '@/features/tournaments/components/CategoryProgressPanel.vue';
import type { CategoryStageStatus } from '@/composables/useCategoryStageStatus';

const STUB_CARD = { template: '<div><slot /></div>' };

const mockStatuses: CategoryStageStatus[] = [
  {
    categoryId: 'cat1',
    categoryName: "Men's Singles",
    stageLabel: 'R3',
    nextMatchLabel: 'Chen vs Park',
    total: 24,
    completed: 18,
    remaining: 6,
    live: 2,
    upcoming: 4,
    nextRound: 3,
    needsLevelGeneration: false,
  },
  {
    categoryId: 'cat2',
    categoryName: "Women's Doubles",
    stageLabel: 'R1',
    nextMatchLabel: 'Kim/Lee vs Nguyen/Tran',
    total: 16,
    completed: 0,
    remaining: 16,
    live: 0,
    upcoming: 16,
    nextRound: 1,
    needsLevelGeneration: false,
  },
];

describe('CategoryProgressPanel', () => {
  const mountPanel = (statuses = mockStatuses) =>
    mount(CategoryProgressPanel, {
      props: { statuses },
      global: { stubs: { 'v-card': STUB_CARD } },
    });

  it('renders a row for each category', () => {
    const wrapper = mountPanel();
    expect(wrapper.findAll('.cp-row')).toHaveLength(2);
  });

  it('shows category names', () => {
    const wrapper = mountPanel();
    expect(wrapper.text()).toContain("Men's Singles");
    expect(wrapper.text()).toContain("Women's Doubles");
  });

  it('shows completed / total fraction', () => {
    const wrapper = mountPanel();
    expect(wrapper.text()).toContain('18 / 24');
    expect(wrapper.text()).toContain('0 / 16');
  });

  it('sets progress bar width correctly', () => {
    const wrapper = mountPanel();
    const fills = wrapper.findAll('.cp-bar__fill');
    // 18/24 = 75%
    expect(fills[0].attributes('style')).toContain('width: 75%');
    // 0/16 = 0%
    expect(fills[1].attributes('style')).toContain('width: 0%');
  });

  it('renders empty state when no statuses', () => {
    const wrapper = mountPanel([]);
    expect(wrapper.find('.cp-empty').exists()).toBe(true);
    expect(wrapper.findAll('.cp-row')).toHaveLength(0);
  });

  it('handles total=0 without dividing by zero', () => {
    const zeroTotal: CategoryStageStatus = {
      ...mockStatuses[0],
      categoryId: 'cat3',
      total: 0,
      completed: 0,
    };
    const wrapper = mountPanel([zeroTotal]);
    const fill = wrapper.find('.cp-bar__fill');
    expect(fill.attributes('style')).toContain('width: 0%');
  });
});
```

- [ ] **Step 2: Run test — confirm it FAILS (component doesn't exist yet)**

```bash
cd /Users/ramc/Documents/Code/courtmaster-v2
npx vitest run tests/unit/CategoryProgressPanel.test.ts
```

Expected: error about missing module `@/features/tournaments/components/CategoryProgressPanel.vue`

- [ ] **Step 3: Create the component**

```vue
<!-- src/features/tournaments/components/CategoryProgressPanel.vue -->
<script setup lang="ts">
import type { CategoryStageStatus } from '@/composables/useCategoryStageStatus';

const PROGRESS_COLORS = ['#16a34a', '#ea580c', '#1d4ed8', '#7c3aed', '#0891b2'];

defineProps<{
  statuses: CategoryStageStatus[];
}>();

function progressPercent(status: CategoryStageStatus): number {
  return status.total > 0 ? Math.round((status.completed / status.total) * 100) : 0;
}

function colorForIndex(index: number): string {
  return PROGRESS_COLORS[index % PROGRESS_COLORS.length];
}
</script>

<template>
  <v-card class="category-progress-panel" variant="outlined">
    <div class="cp-header">
      <span class="cp-title">Category Progress</span>
    </div>
    <div
      v-if="statuses.length === 0"
      class="cp-empty"
    >
      No categories yet
    </div>
    <div
      v-for="(status, index) in statuses"
      :key="status.categoryId"
      class="cp-row"
    >
      <div class="cp-row__top">
        <span class="cp-row__name">{{ status.categoryName }}</span>
        <span class="cp-row__fraction">{{ status.completed }} / {{ status.total }}</span>
      </div>
      <div class="cp-bar">
        <div
          class="cp-bar__fill"
          :style="{
            width: `${progressPercent(status)}%`,
            background: colorForIndex(index),
          }"
        />
      </div>
    </div>
  </v-card>
</template>

<style scoped lang="scss">
.category-progress-panel {
  border-radius: 10px !important;
  overflow: hidden;
}

.cp-header {
  padding: 10px 14px;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
}

.cp-title {
  font-size: 11px;
  font-weight: 700;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.6px;
}

.cp-empty {
  padding: 12px 14px;
  font-size: 12px;
  color: #94a3b8;
}

.cp-row {
  padding: 9px 14px;
  border-bottom: 1px solid #f1f5f9;

  &:last-child {
    border-bottom: none;
  }
}

.cp-row__top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 5px;
}

.cp-row__name {
  font-size: 12px;
  font-weight: 600;
  color: #334155;
}

.cp-row__fraction {
  font-size: 10px;
  color: #94a3b8;
}

.cp-bar {
  height: 4px;
  background: #f1f5f9;
  border-radius: 4px;
  overflow: hidden;
}

.cp-bar__fill {
  height: 100%;
  border-radius: 4px;
  transition: width 400ms ease;
}
</style>
```

- [ ] **Step 4: Run test — confirm all 6 pass**

```bash
npx vitest run tests/unit/CategoryProgressPanel.test.ts
```

Expected: 6 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/features/tournaments/components/CategoryProgressPanel.vue tests/unit/CategoryProgressPanel.test.ts
git commit -m "feat: add CategoryProgressPanel component for event center redesign"
```

---

## Chunk 2: TournamentDashboardView — script updates

### Task 2: Update script setup

**Files:**
- Modify: `src/features/tournaments/views/TournamentDashboardView.vue` (script section only)

The script changes are:
1. Remove unused component imports (`TournamentBrandMark`, `TournamentSponsorStrip`)
2. Narrow the `useTournamentBranding` destructure — keep only `tournamentLogoUrl` (still used by announcement dialog)
3. Add `isOrganizer` computed
4. Add `showManageControls` computed (organizer OR admin can manage)
5. Add `queueMatchesTop3` computed (first 3 queue items for the compact right panel)
6. Add `statusLabel`, `ctaLabel`, `ctaRoute` computeds (drive the status bar)
7. Add `handleEnterScore` and `handleCompleteMatch` handlers (wire up ActiveMatchesSection with `show-actions: true`)
8. Import `CategoryProgressPanel`

- [ ] **Step 6: Apply script changes**

Find and remove these three import lines (lines 13-14 and 21 in the original):
```typescript
import TournamentBrandMark from '@/components/common/TournamentBrandMark.vue';
import TournamentSponsorStrip from '@/components/common/TournamentSponsorStrip.vue';
```
```typescript
import MatchStatsDashboard from '../components/MatchStatsDashboard.vue';
```
(`MatchStatsDashboard` is removed from the new template; leaving it would be a dead import.)

Find and change (line 40):
```typescript
const { normalizedSponsors, tournamentLogoUrl } = useTournamentBranding(tournament);
```
Replace with:
```typescript
const { tournamentLogoUrl } = useTournamentBranding(tournament);
```

Add after `const isAdmin = computed(() => authStore.isAdmin);` (after line 39):
```typescript
const isOrganizer = computed(() => authStore.isOrganizer);
// Both admins and organizers need Manage controls for their own tournaments.
// Previously gated on isAdmin only, which hid the dropdown from organizers.
const showManageControls = computed(() => isAdmin.value || isOrganizer.value);
```

Add after the `enrichedActiveMatches` computed (after line 94):
```typescript
const queueMatchesTop3 = computed(() => queueMatches.value.slice(0, 3));

const statusLabel = computed(() => {
  switch (tournament.value?.status) {
    case 'active': return 'In Progress';
    case 'registration': return 'Registration Open';
    case 'completed': return 'Tournament Completed';
    default: return 'Draft Mode — Configure categories and courts';
  }
});

const ctaRoute = computed(() => {
  const tid = tournamentId.value;
  switch (tournament.value?.status) {
    case 'active': return `/tournaments/${tid}/match-control`;
    case 'registration': return `/tournaments/${tid}/registrations`;
    case 'completed': return `/tournaments/${tid}/brackets`;
    default: return `/tournaments/${tid}/categories`;
  }
});

const ctaLabel = computed(() => {
  switch (tournament.value?.status) {
    case 'active': return 'Enter Match Control';
    case 'registration': return 'Review Registrations';
    case 'completed': return 'View Results';
    default: return 'Setup Categories';
  }
});
```

Add after `confirmCompleteMatch` function (after line 112):
```typescript
function handleEnterScore(matchId: string): void {
  const match = matches.value.find((m) => m.id === matchId);
  router.push({
    path: `/tournaments/${tournamentId.value}/matches/${matchId}/score`,
    query: match ? { category: match.categoryId } : undefined,
  });
}

function handleCompleteMatch(matchId: string): void {
  matchToComplete.value = matches.value.find((m) => m.id === matchId) ?? null;
  showCompleteMatchDialog.value = true;
}
```

Add after the last existing import (after line 21):
```typescript
import CategoryProgressPanel from '../components/CategoryProgressPanel.vue';
```

- [ ] **Step 7: Type-check**

```bash
cd /Users/ramc/Documents/Code/courtmaster-v2
npm run type-check
```

Expected: No new TypeScript errors

- [ ] **Step 8: Commit script changes**

```bash
git add src/features/tournaments/views/TournamentDashboardView.vue
git commit -m "refactor: clean up TournamentDashboardView script — remove sponsor imports, add layout computeds"
```

---

## Chunk 3: TournamentDashboardView — new template and styles

### Task 3: Replace template and scoped styles

**Files:**
- Modify: `src/features/tournaments/views/TournamentDashboardView.vue` (template + style sections)

Replace everything between `<template>` and `</template>` with the new layout below. The dialogs at the bottom are **identical** to the current ones — copy them unchanged.

- [ ] **Step 9: Replace the template**

The new template (replace from `<template>` through `</template>`):

```html
<template>
  <!-- ── Main content ── -->
  <v-container
    v-if="tournament"
    fluid
    class="event-center-container pa-0"
  >
    <!-- Header band -->
    <div class="ec-header">
      <div class="ec-header__left">
        <div class="ec-tournament-name">{{ tournament.name }}</div>
        <div class="ec-tournament-meta">
          <span v-if="tournament.startDate">{{ formatDate(tournament.startDate) }}</span>
          <template v-if="tournament.location">
            <span class="ec-meta-sep">·</span>
            <span>{{ tournament.location }}</span>
          </template>
          <template v-if="tournament.sport">
            <span class="ec-meta-sep">·</span>
            <span>{{ tournament.sport }}</span>
          </template>
        </div>
      </div>
      <div class="ec-header__right">
        <div
          v-if="tournament.status === 'active'"
          class="ec-live-badge"
        >
          <span class="ec-live-dot" />
          <span class="ec-live-text">LIVE</span>
        </div>
        <v-menu v-if="showManageControls">
          <template #activator="{ props }">
            <v-btn
              v-bind="props"
              variant="outlined"
              size="small"
              density="comfortable"
            >
              Manage
              <v-icon
                icon="mdi-chevron-down"
                size="16"
                end
              />
            </v-btn>
          </template>
          <v-list
            density="compact"
            nav
          >
            <v-list-item
              v-if="tournament.status === 'draft'"
              title="Open Registration"
              @click="updateStatus('registration')"
            >
              <template #prepend>
                <v-icon
                  icon="mdi-account-plus"
                  size="18"
                  class="mr-3 text-grey-darken-1"
                />
              </template>
            </v-list-item>
            <v-list-item
              v-if="tournament.status === 'registration'"
              title="Start Tournament"
              @click="updateStatus('active')"
            >
              <template #prepend>
                <v-icon
                  icon="mdi-play"
                  size="18"
                  class="mr-3 text-grey-darken-1"
                />
              </template>
            </v-list-item>
            <v-list-item
              title="Generate Schedule"
              @click="generateSchedule"
            >
              <template #prepend>
                <v-icon
                  icon="mdi-calendar-clock"
                  size="18"
                  class="mr-3 text-grey-darken-1"
                />
              </template>
            </v-list-item>
            <v-list-item
              v-if="tournament.status === 'active'"
              title="Share Scoring Link"
              @click="showScoringQrDialog = true"
            >
              <template #prepend>
                <v-icon
                  icon="mdi-qrcode"
                  size="18"
                  class="mr-3 text-grey-darken-1"
                />
              </template>
            </v-list-item>
            <v-list-item
              title="Download Announcement Card"
              @click="showAnnouncementCardDialog = true"
            >
              <template #prepend>
                <v-icon
                  icon="mdi-image-outline"
                  size="18"
                  class="mr-3 text-grey-darken-1"
                />
              </template>
            </v-list-item>
            <v-list-item
              v-if="tournament.status === 'active'"
              title="Complete Tournament"
              @click="showCompleteDialog = true"
            >
              <template #prepend>
                <v-icon
                  icon="mdi-check"
                  size="18"
                  class="mr-3 text-grey-darken-1"
                />
              </template>
            </v-list-item>
            <v-divider class="my-1" />
            <v-list-item
              title="Print Dashboard"
              @click="handlePrint"
            >
              <template #prepend>
                <v-icon
                  icon="mdi-printer"
                  size="18"
                  class="mr-3 text-grey-darken-1"
                />
              </template>
            </v-list-item>
            <v-list-item
              title="Export (CSV)"
              @click="handleExport"
            >
              <template #prepend>
                <v-icon
                  icon="mdi-download"
                  size="18"
                  class="mr-3 text-grey-darken-1"
                />
              </template>
            </v-list-item>
            <v-list-item
              :to="`/tournaments/${tournamentId}/settings`"
              title="Settings"
            >
              <template #prepend>
                <v-icon
                  icon="mdi-cog"
                  size="18"
                  class="mr-3 text-grey-darken-1"
                />
              </template>
            </v-list-item>
            <v-divider class="my-1" />
            <v-list-item
              title="Delete Tournament"
              base-color="error"
              @click="showDeleteDialog = true"
            >
              <template #prepend>
                <v-icon
                  icon="mdi-trash-can"
                  size="18"
                  class="mr-3 text-grey-darken-1"
                />
              </template>
            </v-list-item>
          </v-list>
        </v-menu>
      </div>
    </div>

    <!-- Stats row -->
    <div class="ec-stats">
      <template v-if="!statsLoaded">
        <div
          v-for="n in 4"
          :key="`sk-${n}`"
          class="ec-stat"
        >
          <v-skeleton-loader
            type="heading"
            width="60"
          />
        </div>
      </template>
      <template v-else>
        <div class="ec-stat">
          <div class="ec-stat__number">{{ stats.approvedRegistrations }}</div>
          <div class="ec-stat__label">Players</div>
        </div>
        <div class="ec-stat ec-stat--orange">
          <div class="ec-stat__number">{{ stats.inProgressMatches }}</div>
          <div class="ec-stat__label">Live Now</div>
        </div>
        <div class="ec-stat ec-stat--green">
          <div class="ec-stat__number">
            {{ stats.progress }}<span class="ec-stat__unit">%</span>
          </div>
          <div class="ec-stat__label">Complete</div>
        </div>
        <div class="ec-stat ec-stat--purple">
          <div class="ec-stat__number">{{ queueMatches.length }}</div>
          <div class="ec-stat__label">In Queue</div>
        </div>
      </template>
    </div>

    <!-- Status + CTA bar -->
    <div class="ec-status-bar">
      <div>
        <div class="ec-status-bar__eyebrow">Tournament Status</div>
        <div class="ec-status-bar__text">
          <span
            class="ec-status-dot"
            :class="`ec-status-dot--${tournament.status}`"
          />
          {{ statusLabel }}
        </div>
      </div>
      <v-btn
        color="primary"
        :to="ctaRoute"
        class="ec-cta-btn"
        elevation="4"
      >
        {{ ctaLabel }}
      </v-btn>
    </div>

    <!-- Quick links (active only) -->
    <div
      v-if="tournament.status === 'active'"
      class="ec-quick-links"
    >
      <v-btn
        variant="outlined"
        size="small"
        class="ec-quick-link"
        :to="`/tournaments/${tournamentId}/checkin`"
      >
        Check-in
      </v-btn>
      <v-btn
        variant="outlined"
        size="small"
        class="ec-quick-link"
        :to="`/tournaments/${tournamentId}/brackets`"
      >
        Brackets
      </v-btn>
      <v-btn
        variant="outlined"
        size="small"
        class="ec-quick-link"
        :to="`/tournaments/${tournamentId}/live-view`"
      >
        Live View
      </v-btn>
      <v-btn
        variant="outlined"
        size="small"
        class="ec-quick-link"
        :to="`/tournaments/${tournamentId}/leaderboard`"
      >
        Leaderboard
      </v-btn>
      <v-btn
        variant="outlined"
        size="small"
        class="ec-quick-link"
        :to="`/tournaments/${tournamentId}/score`"
      >
        Share Links
      </v-btn>
    </div>

    <!-- Operations — 2-col (active only) -->
    <div
      v-if="tournament.status === 'active'"
      class="ec-operations"
    >
      <!-- Left 3fr: Active Matches -->
      <div class="ec-operations__left">
        <ActiveMatchesSection
          :matches="enrichedActiveMatches"
          :show-actions="true"
          @enter-score="handleEnterScore"
          @complete-match="handleCompleteMatch"
        />
      </div>

      <!-- Right 2fr: Queue + Category Progress -->
      <div class="ec-operations__right">
        <ReadyQueue
          :matches="queueMatchesTop3"
          :categories="categories"
          :get-participant-name="getParticipantName"
          :get-category-name="getCategoryName"
          :enable-assign="false"
          @select="handleQueueSelect"
        />
        <div
          v-if="queueMatches.length > 3"
          class="ec-queue-more"
        >
          <span class="text-body-2 text-medium-emphasis">
            {{ queueMatches.length - 3 }} more waiting
          </span>
          <v-btn
            variant="text"
            size="small"
            color="primary"
            :to="`/tournaments/${tournamentId}/match-control`"
          >
            View all →
          </v-btn>
        </div>
        <CategoryProgressPanel
          :statuses="categoryStageStatuses"
          class="mt-3"
        />
      </div>
    </div>

    <!-- Pre-event: Organizer checklist (draft / registration) -->
    <div
      v-if="['draft', 'registration'].includes(tournament.status)"
      class="pa-5"
    >
      <organizer-checklist :tournament-id="tournamentId" />
    </div>

    <!-- Schedule Result Alert -->
    <v-alert
      v-if="scheduleResult && scheduleResult.unscheduled > 0"
      type="warning"
      variant="tonal"
      closable
      class="ma-4"
      @click:close="scheduleResult = null"
    >
      <div class="d-flex align-center">
        <v-icon
          icon="mdi-alert"
          class="mr-2"
        />
        <div class="font-weight-bold">
          {{ scheduleResult.unscheduled }} match(es) could not be scheduled
        </div>
      </div>
      <v-divider class="my-2" />
      <v-list
        density="compact"
        class="bg-transparent"
      >
        <v-list-item
          v-for="item in scheduleResult.unscheduledDetails"
          :key="item.matchId"
          class="px-0"
        >
          <template #prepend>
            <v-icon
              icon="mdi-information"
              size="small"
              color="warning"
            />
          </template>
          <v-list-item-title>Match ID: {{ item.matchId }}</v-list-item-title>
          <v-list-item-subtitle class="text-warning">
            {{ item.reason || 'Unknown reason' }}
          </v-list-item-subtitle>
        </v-list-item>
      </v-list>
    </v-alert>
  </v-container>

  <!-- Loading State -->
  <v-container
    v-else-if="loading"
    class="fill-height"
  >
    <v-row
      align="center"
      justify="center"
    >
      <v-progress-circular
        indeterminate
        size="64"
        color="primary"
      />
    </v-row>
  </v-container>

  <!-- Complete Tournament Confirmation Dialog -->
  <v-dialog
    v-model="showCompleteDialog"
    max-width="480"
    persistent
  >
    <v-card>
      <v-card-title class="d-flex align-center pa-4 pb-2">
        <v-icon
          start
          icon="mdi-trophy"
          color="success"
        />
        Complete Tournament?
      </v-card-title>
      <v-card-text>
        <p class="mb-3">
          You're about to mark <strong>{{ tournament?.name }}</strong> as completed.
        </p>
        <v-alert
          type="warning"
          variant="tonal"
          density="compact"
        >
          This will close all active scoring. This action cannot be undone.
        </v-alert>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn
          variant="text"
          @click="showCompleteDialog = false"
        >
          Cancel
        </v-btn>
        <v-btn
          color="success"
          variant="elevated"
          @click="updateStatus('completed'); showCompleteDialog = false"
        >
          Complete Tournament
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <!-- Delete Confirmation Dialog -->
  <v-dialog
    v-model="showDeleteDialog"
    max-width="500"
  >
    <v-card>
      <v-card-title class="text-h5 text-error">
        <v-icon
          start
          icon="mdi-alert"
          color="error"
        />
        Delete Tournament?
      </v-card-title>
      <v-card-text>
        Are you sure you want to delete <strong>{{ tournament?.name }}</strong>? This action cannot be undone and will remove all matches, scores, and participant data.
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn
          variant="text"
          :disabled="deleteLoading"
          @click="showDeleteDialog = false"
        >
          Cancel
        </v-btn>
        <v-btn
          color="error"
          variant="elevated"
          :loading="deleteLoading"
          @click="handleDeleteTournament"
        >
          Delete Forever
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <!-- Complete Match Winner Dialog -->
  <v-dialog
    v-model="showCompleteMatchDialog"
    max-width="400"
    persistent
  >
    <v-card v-if="matchToComplete">
      <v-card-title>Select Winner</v-card-title>
      <v-card-text>
        <p class="mb-4">
          Who won this match?
        </p>
        <v-btn
          block
          color="primary"
          class="mb-2"
          @click="confirmCompleteMatch(matchToComplete.participant1Id)"
        >
          {{ getParticipantName(matchToComplete.participant1Id) }}
        </v-btn>
        <v-btn
          block
          color="primary"
          variant="outlined"
          @click="confirmCompleteMatch(matchToComplete.participant2Id)"
        >
          {{ getParticipantName(matchToComplete.participant2Id) }}
        </v-btn>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn
          variant="text"
          @click="showCompleteMatchDialog = false"
        >
          Cancel
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <!-- Scoring QR Code Dialog -->
  <ScoringQrDialog
    v-model="showScoringQrDialog"
    :tournament-id="tournamentId"
    @copied="notificationStore.showToast('success', 'Scoring link copied!')"
  />

  <TournamentAnnouncementCardDialog
    v-model="showAnnouncementCardDialog"
    :tournament-name="tournament?.name || 'Tournament'"
    :tournament-date="tournament?.startDate || null"
    :tournament-location="tournament?.location || null"
    :logo-url="tournamentLogoUrl"
    @downloaded="notificationStore.showToast('success', 'Announcement card downloaded')"
  />
</template>
```

- [ ] **Step 10: Replace the scoped styles**

Replace the entire `<style scoped lang="scss">` block (everything from `<style` to `</style>`):

```scss
<style scoped lang="scss">
@use '@/styles/variables.scss' as *;

// ── Outer container ──────────────────────────────────────────────
.event-center-container {
  background: #f1f5f9;
  min-height: 100%;
}

// ── Header band ──────────────────────────────────────────────────
.ec-header {
  background: #fff;
  padding: 16px 20px;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.ec-header__left {
  min-width: 0;
}

.ec-tournament-name {
  font-size: 20px;
  font-weight: 800;
  color: #0f172a;
  letter-spacing: -0.3px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ec-tournament-meta {
  font-size: 12px;
  color: #64748b;
  margin-top: 2px;
}

.ec-meta-sep {
  margin: 0 6px;
}

.ec-header__right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

// LIVE badge
.ec-live-badge {
  display: flex;
  align-items: center;
  gap: 5px;
  background: #dcfce7;
  border: 1px solid #86efac;
  padding: 5px 12px;
  border-radius: 20px;
}

.ec-live-dot {
  width: 7px;
  height: 7px;
  background: #16a34a;
  border-radius: 50%;
  display: inline-block;
  animation: ec-pulse 1.5s ease-in-out infinite;
}

.ec-live-text {
  font-size: 11px;
  font-weight: 700;
  color: #15803d;
  letter-spacing: 0.5px;
}

@keyframes ec-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.35; }
}

// ── Stats row ─────────────────────────────────────────────────────
.ec-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  background: #fff;
  border-bottom: 1px solid #e2e8f0;
}

.ec-stat {
  padding: 14px 18px;
  border-right: 1px solid #e2e8f0;

  &:last-child {
    border-right: none;
  }

  &--orange {
    background: #fff7ed;
  }

  &--green {
    background: #f0fdf4;
  }

  &--purple {
    background: #f5f3ff;
  }
}

.ec-stat__number {
  font-size: 28px;
  font-weight: 800;
  line-height: 1;
  color: #0f172a;
  font-variant-numeric: tabular-nums;

  .ec-stat--orange & {
    color: #ea580c;
  }

  .ec-stat--green & {
    color: #16a34a;
  }

  .ec-stat--purple & {
    color: #7c3aed;
  }
}

.ec-stat__unit {
  font-size: 18px;
}

.ec-stat__label {
  font-size: 10px;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  margin-top: 4px;
}

// ── Status + CTA bar ──────────────────────────────────────────────
.ec-status-bar {
  background: #fff;
  padding: 14px 20px;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.ec-status-bar__eyebrow {
  font-size: 10px;
  font-weight: 700;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  margin-bottom: 5px;
}

.ec-status-bar__text {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: #0f172a;
}

.ec-status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  background: #64748b;

  &--active {
    background: #f97316;
  }

  &--registration {
    background: #1d4ed8;
  }

  &--completed {
    background: #16a34a;
  }
}

.ec-cta-btn {
  box-shadow: 0 4px 14px rgba(29, 78, 216, 0.3) !important;
  flex-shrink: 0;
}

// ── Quick links ───────────────────────────────────────────────────
.ec-quick-links {
  background: #fff;
  padding: 10px 20px;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.ec-quick-link {
  font-size: 12px !important;
  font-weight: 600 !important;
  color: #475569 !important;
  border-color: #e2e8f0 !important;
  background: #f8fafc !important;

  &:hover {
    border-color: #cbd5e1 !important;
    color: #1d4ed8 !important;
    background: #f1f5f9 !important;
  }
}

// ── Operations 2-col ──────────────────────────────────────────────
.ec-operations {
  display: grid;
  grid-template-columns: 3fr 2fr;
  gap: 16px;
  padding: 16px 20px;
  background: #f8fafc;
  align-items: start;
}

.ec-operations__right {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.ec-queue-more {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 4px 0;
}
</style>
```

- [ ] **Step 11: Type-check**

```bash
npm run type-check
```

Expected: No TypeScript errors

- [ ] **Step 12: Run existing unit tests to catch regressions**

```bash
npx vitest run tests/unit/
```

Expected: All previously passing tests still pass. `CategoryProgressPanel.test.ts` (6 tests) pass.

- [ ] **Step 13: Manual smoke test**

Start the dev server (already running on :3000) and verify:

```
- [ ] Log in as organizer
- [ ] Navigate to an active tournament → Event Center
- [ ] Header shows tournament name, date, location, sport, LIVE badge, Manage button
- [ ] Stats row shows 4 colored stat cards with real numbers
- [ ] Status bar shows "In Progress" with orange dot + "Enter Match Control" CTA
- [ ] Quick links row is visible with 5 buttons
- [ ] Active Matches panel is on the left (with Score/Done action buttons)
- [ ] Ready Queue shows top 3 + "View all" link if more exist
- [ ] Category Progress shows progress bars
- [ ] Click "Enter Match Control" → navigates to match-control route
- [ ] Click a quick link (Brackets) → navigates correctly
- [ ] Navigate to a draft tournament → see Organizer Checklist, no operations panels, no quick links
- [ ] Navigate to a completed tournament → see "View Results" CTA, no operations panels
- [ ] Manage dropdown → all items present including Print, Export, Settings, Delete
- [ ] Complete match dialog still works from Active Matches Score/Done buttons
- [ ] Manage dropdown → Generate Schedule works and shows schedule result alert if applicable
- [ ] Sponsor strip is gone
- [ ] Info strip is gone
- [ ] MatchStatsDashboard is gone from the page
```

- [ ] **Step 14: Commit**

```bash
git add src/features/tournaments/views/TournamentDashboardView.vue
git commit -m "feat: redesign Event Center — focused organizer dashboard with 2-col layout"
```

---

## Summary

| What | File | Why |
|------|------|-----|
| New `CategoryProgressPanel` component | `src/features/tournaments/components/CategoryProgressPanel.vue` | Read-only per-category progress bars for right panel |
| Removed: TournamentBrandMark, TournamentSponsorStrip imports | `TournamentDashboardView.vue` | Components no longer used in new layout |
| Added: `showManageControls`, `queueMatchesTop3`, status computeds | `TournamentDashboardView.vue` | Drive new header + stats bar + compact queue |
| Added: `handleEnterScore`, `handleCompleteMatch` | `TournamentDashboardView.vue` | Wire up `show-actions: true` on ActiveMatchesSection |
| New outer layout (header → stats → CTA bar → quick links → 2-col) | `TournamentDashboardView.vue` | Remove clutter, premium focused organizer UX |
| Lifecycle-aware panels | `TournamentDashboardView.vue` | Operations only shown during `active`; checklist only during `draft`/`registration` |
| Replaced scoped styles | `TournamentDashboardView.vue` | New design tokens — clean white + colored accents |
