<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { useTournamentStore } from '@/stores/tournaments';
import BracketView from '@/features/brackets/components/BracketView.vue';

const route = useRoute();
const tournamentStore = useTournamentStore();

const tournamentId = computed(() => route.params.tournamentId as string);
const tournament = computed(() => tournamentStore.currentTournament);
const categories = computed(() => tournamentStore.categories);
const loading = computed(() => tournamentStore.loading);

const selectedCategory = ref<string | null>(null);
const notFound = ref(false);

onMounted(async () => {
  try {
    await tournamentStore.fetchTournament(tournamentId.value);
  } catch {
    notFound.value = true;
    return;
  }
  tournamentStore.subscribeTournament(tournamentId.value);

  if (categories.value.length > 0) {
    selectedCategory.value = categories.value[0].id;
  }
});
</script>

<template>
  <v-container fluid>
    <!-- Header -->
    <v-row class="mb-4">
      <v-col cols="12">
        <div v-if="tournament">
          <h1 class="text-h4 font-weight-bold">
            {{ tournament.name }}
          </h1>
          <p class="text-body-2 text-grey">
            Live Tournament Bracket
          </p>
        </div>
        <v-skeleton-loader
          v-else-if="!notFound"
          type="heading"
        />
      </v-col>
    </v-row>

    <!-- Not Found -->
    <v-row v-if="notFound">
      <v-col cols="12">
        <v-card>
          <v-card-text class="text-center py-8">
            <v-icon
              size="64"
              color="grey-lighten-1"
            >
              mdi-alert-circle-outline
            </v-icon>
            <h2 class="text-h6 mt-4">
              Tournament not found
            </h2>
            <p class="text-body-2 text-grey mt-2">
              This tournament does not exist or has been removed.
            </p>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <template v-else>
      <!-- Category Selection -->
      <v-row class="mb-4">
        <v-col
          cols="12"
          md="4"
        >
          <v-select
            v-model="selectedCategory"
            :items="categories"
            item-title="name"
            item-value="id"
            label="Select Category"
            :loading="loading"
          />
        </v-col>
      </v-row>

      <!-- Bracket -->
      <v-row>
        <v-col cols="12">
          <v-card>
            <v-card-text>
              <BracketView
                v-if="selectedCategory"
                :tournament-id="tournamentId"
                :category-id="selectedCategory"
              />
              <div
                v-else
                class="text-center py-8"
              >
                <p class="text-grey">
                  Select a category to view the bracket
                </p>
              </div>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>
    </template>
  </v-container>
</template>
