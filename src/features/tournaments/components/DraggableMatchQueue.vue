<template>
  <v-card>
    <v-card-title class="d-flex align-center justify-space-between">
      <span>Match Queue ({{ matches.length }})</span>
      <v-menu>
        <template #activator="{ props: menuProps }">
          <v-btn
            v-bind="menuProps"
            icon="mdi-dots-vertical"
            size="small"
            variant="text"
            aria-label="Queue options"
          />
        </template>
        <v-list density="compact">
          <v-list-item @click="$emit('resetOrder')">
            <v-icon
              start
              size="small"
            >
              mdi-refresh
            </v-icon>
            Reset to FIFO
          </v-list-item>
          <v-list-item @click="$emit('sortByRound')">
            <v-icon
              start
              size="small"
            >
              mdi-sort
            </v-icon>
            Sort by Round
          </v-list-item>
        </v-list>
      </v-menu>
    </v-card-title>

    <draggable
      v-model="localMatches"
      item-key="id"
      handle=".drag-handle"
      animation="200"
      ghost-class="ghost"
      @end="onDragEnd"
    >
      <template #item="{ element: match, index }">
        <v-list-item class="drag-item">
          <template #prepend>
            <div class="drag-handle mr-2">
              <v-icon>mdi-drag-vertical</v-icon>
            </div>
            <v-badge
              :content="index + 1"
              color="primary"
              class="mr-2"
            />
          </template>

          <v-list-item-title>
            {{ getMatchDisplayName(match) }}
          </v-list-item-title>
          <v-list-item-subtitle>
            Round {{ match.round }} • {{ match.categoryName || 'Unknown Category' }}
          </v-list-item-subtitle>

          <template #append>
            <v-select
              v-model="selectedCourt[match.id]"
              :items="availableCourts"
              item-title="name"
              item-value="id"
              density="compact"
              variant="outlined"
              placeholder="Assign Court"
              class="court-select"
              @update:model-value="(courtId) => courtId && assignMatch(match.id, courtId)"
            />
          </template>
        </v-list-item>
      </template>
    </draggable>

    <v-card-text
      v-if="matches.length === 0"
      class="text-center text-grey"
    >
      No matches in queue
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import draggable from 'vuedraggable';
import { useMatchDisplay } from '@/composables/useMatchDisplay';
import type { Match, Court } from '@/types';

const props = defineProps<{
  matches: Match[];
  availableCourts: Court[];
}>();

const emit = defineEmits<{
  reorder: [matchIds: string[]];
  assign: [matchId: string, courtId: string];
  resetOrder: [];
  sortByRound: [];
}>();

const { getMatchDisplayName } = useMatchDisplay();

const localMatches = ref<Match[]>([...props.matches]);
const selectedCourt = ref<Record<string, string>>({});

watch(() => props.matches, (newMatches) => {
  localMatches.value = [...newMatches];
}, { deep: true });

function onDragEnd() {
  const matchIds = localMatches.value.map(m => m.id);
  emit('reorder', matchIds);
}

function assignMatch(matchId: string, courtId: string) {
  emit('assign', matchId, courtId);
  selectedCourt.value[matchId] = '';
}
</script>

<style scoped>
.drag-handle {
  cursor: grab;
  opacity: 0.5;
}
.drag-handle:hover {
  opacity: 1;
}
.ghost {
  opacity: 0.5;
  background: rgb(var(--v-theme-primary));
}
.court-select {
  width: 150px;
}
</style>
