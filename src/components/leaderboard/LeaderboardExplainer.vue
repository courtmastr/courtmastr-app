<template>
  <v-expansion-panels
    variant="accordion"
    class="mb-4"
  >
    <v-expansion-panel>
      <v-expansion-panel-title>
        <v-icon
          start
          color="primary"
        >
          mdi-help-circle-outline
        </v-icon>
        How are rankings calculated?
      </v-expansion-panel-title>
      <v-expansion-panel-text>
        <v-row>
          <!-- Step 1: Match Points -->
          <v-col
            cols="12"
            md="4"
          >
            <v-card
              variant="tonal"
              color="primary"
              class="pa-3 h-100"
            >
              <div class="d-flex align-center mb-2">
                <v-avatar
                  color="primary"
                  size="28"
                  class="mr-2"
                >
                  <span class="text-white font-weight-bold text-body-2">1</span>
                </v-avatar>
                <span class="font-weight-bold">Match Points</span>
              </div>
              <p class="text-body-2 mb-3">
                Every match earns points — win or lose, you always get something.
              </p>
              <v-list
                density="compact"
                bg-color="transparent"
                class="pa-0"
              >
                <v-list-item density="compact">
                  <template #prepend>
                    <v-icon
                      color="success"
                      size="18"
                    >
                      mdi-trophy
                    </v-icon>
                  </template>
                  <v-list-item-title class="text-body-2">
                    <strong>Win</strong> → 2 points
                  </v-list-item-title>
                </v-list-item>
                <v-list-item density="compact">
                  <template #prepend>
                    <v-icon
                      color="warning"
                      size="18"
                    >
                      mdi-minus-circle
                    </v-icon>
                  </template>
                  <v-list-item-title class="text-body-2">
                    <strong>Loss</strong> → 1 point
                  </v-list-item-title>
                </v-list-item>
                <v-list-item density="compact">
                  <template #prepend>
                    <v-icon
                      color="info"
                      size="18"
                    >
                      mdi-fast-forward
                    </v-icon>
                  </template>
                  <v-list-item-title class="text-body-2">
                    <strong>Walkover (W/O)</strong> → 2 points, scored 0–0
                  </v-list-item-title>
                </v-list-item>
              </v-list>
            </v-card>
          </v-col>

          <!-- Step 2: Tiebreakers -->
          <v-col
            cols="12"
            md="4"
          >
            <v-card
              variant="tonal"
              color="secondary"
              class="pa-3 h-100"
            >
              <div class="d-flex align-center mb-2">
                <v-avatar
                  color="secondary"
                  size="28"
                  class="mr-2"
                >
                  <span class="text-white font-weight-bold text-body-2">2</span>
                </v-avatar>
                <span class="font-weight-bold">When Points Are Tied</span>
              </div>
              <p class="text-body-2 mb-3">
                If two or more teams have the same match points, we use these tiebreakers in order.
                Teams that have never played each other (e.g. from different pools) skip Head-to-Head
                and go directly to Set Difference.
              </p>
              <div
                v-for="(tb, i) in tiebreakers"
                :key="i"
                class="d-flex align-start mb-2"
              >
                <v-chip
                  size="x-small"
                  color="secondary"
                  class="mr-2 mt-1 flex-shrink-0"
                >
                  {{ i + 1 }}
                </v-chip>
                <div>
                  <div class="text-body-2 font-weight-medium">
                    {{ tb.label }}
                  </div>
                  <div class="text-caption text-medium-emphasis">
                    {{ tb.explain }}
                  </div>
                </div>
              </div>
            </v-card>
          </v-col>

          <!-- Step 3: Fairness / BYE -->
          <v-col
            cols="12"
            md="4"
          >
            <v-card
              variant="tonal"
              color="info"
              class="pa-3 h-100"
            >
              <div class="d-flex align-center mb-2">
                <v-avatar
                  color="info"
                  size="28"
                  class="mr-2"
                >
                  <span class="text-white font-weight-bold text-body-2">3</span>
                </v-avatar>
                <span class="font-weight-bold">Fairness — Uneven Pools</span>
              </div>
              <p class="text-body-2 mb-2">
                When the number of teams doesn't divide evenly into pools,
                one pool gets a <strong>BYE slot</strong> (an empty opponent).
              </p>
              <p class="text-body-2 mb-2">
                Both real players in that pool automatically receive a
                <strong>Walkover Win</strong> against the BYE — so everyone
                in that pool plays and earns the same number of matches as all other pools.
              </p>
              <p class="text-body-2 mb-0">
                Tiebreakers like Set Difference and Point Difference are
                <strong>calculated per match played</strong>, so teams with
                a BYE are never unfairly compared to teams who played more matches.
                If all tiebreakers are exhausted, teams are listed <strong>alphabetically</strong>
                — this is fair and consistent, and final standings are resolved in elimination play.
              </p>
            </v-card>
          </v-col>
        </v-row>
      </v-expansion-panel-text>
    </v-expansion-panel>
  </v-expansion-panels>
</template>

<script setup lang="ts">
const tiebreakers = [
  {
    label: 'Head-to-Head',
    explain: 'Did the two tied teams play each other directly? If yes, the winner of that match ranks higher. Only applies to 2-way ties.',
  },
  {
    label: 'Set Difference (per match)',
    explain: 'Sets won minus sets lost, divided by matches played. Per-match calculation ensures fairness when teams have played different numbers of matches (e.g. bye pools). Higher is better.',
  },
  {
    label: 'Point Difference (per match)',
    explain: 'Total rally points scored minus total given up, divided by matches played. Walkovers count as 0–0 and do not affect this number. Higher is better.',
  },
  {
    label: 'Equal Standing',
    explain: 'All tiebreakers exhausted — teams are statistically identical. They are listed alphabetically on screen. Final ranking between these teams will be decided in the elimination phase.',
  },
];
</script>
