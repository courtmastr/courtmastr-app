<script setup lang="ts">
interface Props {
  averageMinutes: number | null;
  medianMinutes: number | null;
  minMinutes: number | null;
  maxMinutes: number | null;
  configuredMinutes: number | null;
  observedMatchCount: number;
  excludedMatchCount: number;
}

defineProps<Props>();

const formatMinutes = (value: number | null): string => {
  return value === null ? 'Not enough data yet' : `${value} min`;
};
</script>

<template>
  <v-card>
    <v-card-title class="text-subtitle-1 d-flex align-center ga-2">
      Duration Metrics
      <v-tooltip location="top">
        <template #activator="{ props }">
          <v-icon
            size="16"
            color="medium-emphasis"
            v-bind="props"
          >
            mdi-help-circle-outline
          </v-icon>
        </template>
        Based on observed duration (`completedAt - startedAt`) for completed matches.
      </v-tooltip>
    </v-card-title>
    <v-card-text>
      <div class="d-flex justify-space-between py-1">
        <span class="d-flex align-center ga-1">
          Avg
          <v-tooltip location="top">
            <template #activator="{ props }">
              <v-icon
                size="14"
                color="medium-emphasis"
                v-bind="props"
              >
                mdi-information-outline
              </v-icon>
            </template>
            Average observed match duration in minutes.
          </v-tooltip>
        </span>
        <strong>{{ formatMinutes(averageMinutes) }}</strong>
      </div>
      <div class="d-flex justify-space-between py-1">
        <span class="d-flex align-center ga-1">
          Median
          <v-tooltip location="top">
            <template #activator="{ props }">
              <v-icon
                size="14"
                color="medium-emphasis"
                v-bind="props"
              >
                mdi-information-outline
              </v-icon>
            </template>
            Middle observed duration (or midpoint of the two middle values).
          </v-tooltip>
        </span>
        <strong>{{ formatMinutes(medianMinutes) }}</strong>
      </div>
      <div class="d-flex justify-space-between py-1">
        <span>Min</span>
        <strong>{{ formatMinutes(minMinutes) }}</strong>
      </div>
      <div class="d-flex justify-space-between py-1">
        <span>Max</span>
        <strong>{{ formatMinutes(maxMinutes) }}</strong>
      </div>
      <div class="d-flex justify-space-between py-1">
        <span class="d-flex align-center ga-1">
          Configured Duration
          <v-tooltip location="top">
            <template #activator="{ props }">
              <v-icon
                size="14"
                color="medium-emphasis"
                v-bind="props"
              >
                mdi-information-outline
              </v-icon>
            </template>
            Tournament default duration from settings, shown for planning reference.
          </v-tooltip>
        </span>
        <strong>{{ formatMinutes(configuredMinutes) }}</strong>
      </div>
      <div
        class="text-caption text-medium-emphasis mt-2"
        aria-live="polite"
      >
        Observed matches: {{ observedMatchCount }} · Excluded: {{ excludedMatchCount }}
      </div>
    </v-card-text>
  </v-card>
</template>
