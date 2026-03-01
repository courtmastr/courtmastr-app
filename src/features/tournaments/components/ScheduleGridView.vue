<script setup lang="ts">
import { computed, ref } from 'vue';
import type { Court, Match } from '@/types';
import { SCHEDULE_DEFAULTS, SCHEDULE_STATUS } from '@/scheduling/scheduleRules';
import {
  buildDisplayCodeMap,
  buildGlobalMatchKey,
  getCategoryAlias,
} from '@/features/tournaments/utils/matchDisplayIdentity';
import {
  buildGridCellMap,
  computeMatchRowSpan,
  computeTimeSlots,
  type GridCellMatch,
  type GridCellValue,
} from './ScheduleGridView';

type PublicStateFilter = 'all' | 'published' | 'draft' | 'not_scheduled';
type GridCardMode = 'timing' | 'code';

const props = defineProps<{
  matches: Match[];
  allMatches?: Match[];
  courts: Court[];
  publicState?: PublicStateFilter;
  getCategoryName: (id: string) => string;
  getParticipantName: (id: string | undefined) => string;
}>();

const SLOT_INTERVAL_MINUTES = SCHEDULE_DEFAULTS.slotIntervalMinutes;
const CELL_HEIGHT_PX = 40;
const GRID_TOOLBAR_HEIGHT_PX = 44;
const cardMode = ref<GridCardMode>('timing');

const getMatchStart = (match: Match): Date | undefined => match.plannedStartAt ?? match.scheduledTime;
const getMatchEnd = (match: Match): Date | undefined => {
  if (match.plannedEndAt) return match.plannedEndAt;
  const start = getMatchStart(match);
  if (!start) return undefined;
  return new Date(start.getTime() + SCHEDULE_DEFAULTS.matchDurationMinutes * 60_000);
};

const getScheduleState = (match: Match): PublicStateFilter => {
  if (match.scheduleStatus === SCHEDULE_STATUS.published || Boolean(match.publishedAt)) {
    return 'published';
  }
  if (getMatchStart(match)) {
    return 'draft';
  }
  return 'not_scheduled';
};

const filteredMatches = computed<Match[]>(() => {
  if (!props.publicState || props.publicState === 'all') return props.matches;
  return props.matches.filter((match) => getScheduleState(match) === props.publicState);
});

const scheduledMatches = computed<Match[]>(() =>
  filteredMatches.value.filter((match) => Boolean(getMatchStart(match)) && !isStructuralByeMatch(match))
);

const unscheduledMatches = computed<Match[]>(() =>
  filteredMatches.value.filter((match) => !getMatchStart(match) || isStructuralByeMatch(match))
);

const identitySourceMatches = computed<Match[]>(() => props.allMatches ?? props.matches);

const displayCodeMap = computed<Map<string, string>>(() =>
  buildDisplayCodeMap(identitySourceMatches.value, props.getCategoryName)
);

const activeCourts = computed<Court[]>(() =>
  [...props.courts]
    .filter((court) => court.status !== 'maintenance')
    .sort((a, b) => a.number - b.number)
);

const courtIds = computed<string[]>(() => activeCourts.value.map((court) => court.id));

const gridStart = computed<Date | null>(() => {
  if (scheduledMatches.value.length === 0) return null;
  const earliestStartMs = Math.min(
    ...scheduledMatches.value.map((match) => (getMatchStart(match) as Date).getTime())
  );
  const intervalMs = SLOT_INTERVAL_MINUTES * 60_000;
  return new Date(Math.floor(earliestStartMs / intervalMs) * intervalMs);
});

const gridEnd = computed<Date | null>(() => {
  if (scheduledMatches.value.length === 0) return null;
  const latestEndMs = Math.max(
    ...scheduledMatches.value.map((match) => (getMatchEnd(match) as Date).getTime())
  );
  const intervalMs = SLOT_INTERVAL_MINUTES * 60_000;
  return new Date(Math.ceil(latestEndMs / intervalMs) * intervalMs);
});

const timeSlots = computed<Date[]>(() => {
  if (!gridStart.value || !gridEnd.value) return [];
  return computeTimeSlots(gridStart.value, gridEnd.value, SLOT_INTERVAL_MINUTES);
});

const gridMatches = computed<GridCellMatch[]>(() =>
  scheduledMatches.value.map((match) => ({
    ...match,
    plannedStartAt: getMatchStart(match),
    plannedEndAt: getMatchEnd(match),
  }))
);

const cellMap = computed<Map<string, GridCellValue>>(() => {
  if (!gridStart.value) return new Map<string, GridCellValue>();
  return buildGridCellMap(
    gridMatches.value,
    gridStart.value,
    courtIds.value,
    SLOT_INTERVAL_MINUTES
  );
});

const getCellKey = (slotIndex: number, courtIndex: number): string => `${slotIndex}:${courtIndex}`;

const getCell = (slotIndex: number, courtIndex: number): GridCellValue | undefined =>
  cellMap.value.get(getCellKey(slotIndex, courtIndex));

const getMatchFromCell = (slotIndex: number, courtIndex: number): Match | null => {
  const value = getCell(slotIndex, courtIndex);
  if (!value || value === 'continuation') return null;
  return value as unknown as Match;
};

const formatSlotTime = (date: Date): string =>
  date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

const getCardTimeRange = (match: Match): string => {
  const start = getMatchStart(match);
  if (!start) return 'TBD';
  const end = getMatchEnd(match);
  return `${formatSlotTime(start)}${end ? `-${formatSlotTime(end)}` : ''}`;
};

const getMatchRowSpan = (match: Match): number =>
  computeMatchRowSpan(
    {
      plannedStartAt: getMatchStart(match),
      plannedEndAt: getMatchEnd(match),
    },
    SLOT_INTERVAL_MINUTES
  );

const isStructuralByeMatch = (match: Match): boolean => {
  const oneSided =
    (Boolean(match.participant1Id) && !match.participant2Id) ||
    (!match.participant1Id && Boolean(match.participant2Id));
  if (!oneSided) return false;
  const isFinalized =
    Boolean(match.winnerId) || match.status === 'completed' || match.status === 'walkover';
  const isRoundOne = (match.bracketPosition?.round ?? match.round) === 1;
  return isRoundOne || isFinalized;
};

const getSlotLabel = (match: Match, slot: 'participant1' | 'participant2'): string => {
  const participantId = slot === 'participant1' ? match.participant1Id : match.participant2Id;
  if (participantId) {
    return props.getParticipantName(participantId);
  }
  const otherParticipantId = slot === 'participant1' ? match.participant2Id : match.participant1Id;
  if (!otherParticipantId) {
    return 'TBD';
  }
  return isStructuralByeMatch(match) ? 'BYE' : 'TBD';
};

const getMatchLabel = (match: Match): string => {
  const participant1 = getSlotLabel(match, 'participant1');
  const participant2 = getSlotLabel(match, 'participant2');
  return `${participant1} vs ${participant2}`;
};

const getDisplayCode = (match: Match): string =>
  displayCodeMap.value.get(buildGlobalMatchKey(match)) ?? match.id;

const getScheduleChipColor = (match: Match): string => {
  const state = getScheduleState(match);
  if (state === 'published') return 'primary';
  if (state === 'draft') return 'grey';
  return 'grey-lighten-2';
};

const getScheduleChipLabel = (match: Match): string => {
  const state = getScheduleState(match);
  if (state === 'published') return 'Published';
  if (state === 'draft') return 'Draft';
  return 'Not Scheduled';
};

const toCategoryColor = (categoryId: string): string => {
  let hash = 0;
  for (let index = 0; index < categoryId.length; index += 1) {
    hash = ((hash << 5) - hash) + categoryId.charCodeAt(index);
    hash |= 0;
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue} 68% 45%)`;
};

const getCategoryColor = (categoryId: string): string => toCategoryColor(categoryId);

interface CategoryLegendItem {
  categoryId: string;
  categoryName: string;
  alias: string;
  color: string;
}

const categoryLegendItems = computed<CategoryLegendItem[]>(() => {
  const legendByCategory = new Map<string, CategoryLegendItem>();

  for (const match of filteredMatches.value) {
    if (legendByCategory.has(match.categoryId)) continue;
    const categoryName = props.getCategoryName(match.categoryId);
    legendByCategory.set(match.categoryId, {
      categoryId: match.categoryId,
      categoryName,
      alias: getCategoryAlias(categoryName),
      color: getCategoryColor(match.categoryId),
    });
  }

  return [...legendByCategory.values()].sort((a, b) =>
    a.categoryName.localeCompare(b.categoryName)
  );
});

const visibleLegendItems = computed<CategoryLegendItem[]>(() => categoryLegendItems.value.slice(0, 5));
const hiddenLegendCount = computed<number>(() =>
  Math.max(0, categoryLegendItems.value.length - visibleLegendItems.value.length)
);
</script>

<template>
  <div class="schedule-grid-wrapper">
    <div
      v-if="timeSlots.length > 0"
      class="grid-mode-toolbar px-4 d-flex align-center justify-space-between ga-2"
    >
      <div class="d-flex align-center ga-2 grid-legend-row">
        <span class="text-caption text-medium-emphasis">Category Colors</span>
        <v-tooltip
          v-for="item in visibleLegendItems"
          :key="item.categoryId"
          :text="item.categoryName"
          location="top"
        >
          <template #activator="{ props: tooltipProps }">
            <span
              v-bind="tooltipProps"
              class="grid-legend-item"
            >
              <span
                class="grid-category-tile"
                :style="{ backgroundColor: item.color }"
              />
              <span class="grid-legend-alias">{{ item.alias }}</span>
            </span>
          </template>
        </v-tooltip>
        <span
          v-if="hiddenLegendCount > 0"
          class="text-caption text-medium-emphasis"
        >
          +{{ hiddenLegendCount }}
        </span>
      </div>

      <div class="d-flex align-center ga-2">
        <span class="text-caption text-medium-emphasis">Card View</span>
        <v-btn-toggle
          v-model="cardMode"
          density="compact"
          variant="outlined"
          mandatory
        >
          <v-btn
            value="timing"
            prepend-icon="mdi-clock-outline"
            size="x-small"
          >
            Timing
          </v-btn>
          <v-btn
            value="code"
            prepend-icon="mdi-pound"
            size="x-small"
          >
            Code IDs
          </v-btn>
        </v-btn-toggle>
      </div>
    </div>

    <v-alert
      v-if="timeSlots.length === 0"
      type="info"
      variant="tonal"
      class="ma-4"
    >
      No scheduled matches to display.
      <template v-if="unscheduledMatches.length > 0">
        {{ unscheduledMatches.length }} match{{ unscheduledMatches.length !== 1 ? 'es' : '' }} are not yet scheduled.
      </template>
    </v-alert>

    <div
      v-else
      class="schedule-grid"
      :style="{
        '--grid-toolbar-offset': `${GRID_TOOLBAR_HEIGHT_PX}px`,
        gridTemplateColumns: `70px repeat(${activeCourts.length}, minmax(160px, 1fr))`,
        gridTemplateRows: `40px repeat(${timeSlots.length}, ${CELL_HEIGHT_PX}px)`,
      }"
    >
      <div class="grid-header grid-corner" />

      <div
        v-for="court in activeCourts"
        :key="court.id"
        class="grid-header grid-court-header"
      >
        {{ court.name }}
      </div>

      <template
        v-for="(slot, slotIndex) in timeSlots"
        :key="slot.getTime()"
      >
        <div class="grid-time-label">
          {{ formatSlotTime(slot) }}
        </div>

        <template
          v-for="(court, courtIndex) in activeCourts"
          :key="`${slot.getTime()}-${court.id}`"
        >
          <v-tooltip
            v-if="getMatchFromCell(slotIndex, courtIndex)"
            location="top"
            :open-delay="120"
            max-width="360"
          >
            <template #activator="{ props: tooltipProps }">
              <div
                v-bind="tooltipProps"
                class="grid-match-card"
                :style="{
                  gridRow: `${slotIndex + 2} / span ${getMatchRowSpan(getMatchFromCell(slotIndex, courtIndex) as Match)}`,
                  gridColumn: `${courtIndex + 2}`,
                }"
              >
                <div class="grid-match-head">
                  <span
                    class="grid-category-tile"
                    :style="{ backgroundColor: getCategoryColor((getMatchFromCell(slotIndex, courtIndex) as Match).categoryId) }"
                  />
                  <span class="grid-primary-label">
                    {{ cardMode === 'code'
                      ? getDisplayCode(getMatchFromCell(slotIndex, courtIndex) as Match)
                      : getCardTimeRange(getMatchFromCell(slotIndex, courtIndex) as Match) }}
                  </span>
                  <v-chip
                    size="x-small"
                    :color="getScheduleChipColor(getMatchFromCell(slotIndex, courtIndex) as Match)"
                    class="grid-status-chip"
                  >
                    {{ getScheduleChipLabel(getMatchFromCell(slotIndex, courtIndex) as Match) }}
                  </v-chip>
                </div>
                <div
                  class="grid-match-line"
                  :class="{ 'grid-match-line--code': cardMode === 'code' }"
                >
                  {{ getMatchLabel(getMatchFromCell(slotIndex, courtIndex) as Match) }}
                </div>
              </div>
            </template>
            <div class="grid-tooltip-content">
              <div class="text-caption text-medium-emphasis">
                {{ getCategoryName((getMatchFromCell(slotIndex, courtIndex) as Match).categoryId) }}
              </div>
              <div class="text-body-2 font-weight-medium">
                {{ getMatchLabel(getMatchFromCell(slotIndex, courtIndex) as Match) }}
              </div>
              <div class="text-caption mt-1">
                Code: {{ getDisplayCode(getMatchFromCell(slotIndex, courtIndex) as Match) }}
              </div>
              <div class="text-caption">
                Time: {{ getCardTimeRange(getMatchFromCell(slotIndex, courtIndex) as Match) }}
              </div>
            </div>
          </v-tooltip>

          <div
            v-else-if="!cellMap.has(getCellKey(slotIndex, courtIndex))"
            class="grid-empty-cell"
            :style="{ gridRow: slotIndex + 2, gridColumn: courtIndex + 2 }"
          />
        </template>
      </template>
    </div>

    <v-expansion-panels
      v-if="unscheduledMatches.length > 0"
      class="mt-4 mx-4"
    >
      <v-expansion-panel>
        <v-expansion-panel-title>
          <v-icon
            color="warning"
            class="mr-2"
          >
            mdi-clock-alert-outline
          </v-icon>
          {{ unscheduledMatches.length }} match{{ unscheduledMatches.length !== 1 ? 'es' : '' }} not yet scheduled
        </v-expansion-panel-title>
        <v-expansion-panel-text>
          <v-list density="compact">
            <v-list-item
              v-for="match in unscheduledMatches"
              :key="match.id"
              :title="`${getDisplayCode(match)} • ${getMatchLabel(match)}`"
              :subtitle="getCategoryName(match.categoryId)"
            />
          </v-list>
        </v-expansion-panel-text>
      </v-expansion-panel>
    </v-expansion-panels>
  </div>
</template>

<style scoped>
.schedule-grid-wrapper {
  overflow: visible;
}

.schedule-grid {
  display: grid;
  min-width: 560px;
}

.grid-header {
  position: sticky;
  top: var(--grid-toolbar-offset, 0px);
  z-index: 2;
  background: rgb(var(--v-theme-surface));
  border-bottom: 1px solid rgb(var(--v-theme-outline-variant));
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0 8px;
}

.grid-corner {
  left: 0;
  z-index: 3;
}

.grid-time-label {
  position: sticky;
  left: 0;
  z-index: 1;
  background: rgb(var(--v-theme-surface-variant));
  border-right: 1px solid rgb(var(--v-theme-outline-variant));
  border-bottom: 1px solid rgb(var(--v-theme-outline-variant));
  font-size: 0.7rem;
  color: rgb(var(--v-theme-on-surface-variant));
  display: flex;
  align-items: flex-start;
  justify-content: flex-end;
  padding: 4px 8px 0 0;
}

.grid-mode-toolbar {
  position: sticky;
  top: 0;
  z-index: 4;
  min-height: 44px;
  background: rgb(var(--v-theme-surface));
  border-bottom: 1px solid rgb(var(--v-theme-outline-variant));
}

.grid-legend-row {
  min-width: 0;
  overflow: hidden;
}

.grid-legend-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: 1px solid rgb(var(--v-theme-outline-variant));
  border-radius: 10px;
  padding: 1px 6px 1px 5px;
  background: rgb(var(--v-theme-surface-variant));
}

.grid-legend-alias {
  font-size: 0.68rem;
  font-weight: 700;
  line-height: 1;
  color: rgb(var(--v-theme-on-surface));
}

.grid-match-card {
  margin: 2px;
  padding: 5px 6px;
  border: 1px solid rgb(var(--v-theme-outline-variant));
  border-radius: 6px;
  background: rgb(var(--v-theme-surface));
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 3px;
  z-index: 1;
}

.grid-match-head {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.grid-category-tile {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 3px;
  flex: 0 0 auto;
}

.grid-primary-label {
  font-size: 0.72rem;
  font-weight: 700;
  color: rgb(var(--v-theme-on-surface));
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.grid-match-line {
  font-size: 0.76rem;
  line-height: 1.2;
  color: rgb(var(--v-theme-on-surface));
  display: -webkit-box;
  overflow: hidden;
  text-overflow: ellipsis;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.grid-match-line--code {
  font-size: 0.72rem;
  -webkit-line-clamp: 1;
}

.grid-status-chip {
  height: 16px;
  font-size: 0.64rem;
}

.grid-tooltip-content {
  line-height: 1.35;
}

.grid-empty-cell {
  border-right: 1px solid rgb(var(--v-theme-outline-variant));
  border-bottom: 1px solid rgb(var(--v-theme-outline-variant));
}
</style>
