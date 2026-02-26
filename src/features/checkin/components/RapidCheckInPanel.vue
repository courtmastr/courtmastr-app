<script setup lang="ts">
import { ref } from 'vue';

export interface UrgentCheckInItem {
  id: string;
  title: string;
  subtitle: string;
  startsInLabel?: string;
  canCheckIn: boolean;
}

export interface RecentCheckInItem {
  id: string;
  name: string;
  detail: string;
  canUndo: boolean;
}

interface Props {
  urgentItems: UrgentCheckInItem[];
  recentItems: RecentCheckInItem[];
  loading?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
});

const emit = defineEmits<{
  scanSubmit: [raw: string];
  quickCheckIn: [registrationId: string];
  undoItem: [registrationId: string];
}>();

const scanValue = ref('');

const submitScan = (): void => {
  const raw = scanValue.value.trim();
  if (!raw) return;
  emit('scanSubmit', raw);
  scanValue.value = '';
};

const handleQuickCheckIn = (registrationId: string): void => {
  emit('quickCheckIn', registrationId);
};

const handleUndo = (registrationId: string): void => {
  emit('undoItem', registrationId);
};
</script>

<template>
  <div class="rapid-checkin-panel d-flex ga-4">
    <v-card
      class="rapid-checkin-panel__scanner pa-4"
      variant="outlined"
    >
      <div class="text-overline mb-2">
        Scanner Input
      </div>
      <v-text-field
        v-model="scanValue"
        data-testid="scan-input"
        placeholder="Scan QR or type Bib #"
        density="comfortable"
        variant="outlined"
        autofocus
        :loading="loading"
        prepend-inner-icon="mdi-qrcode-scan"
        @keydown.enter.prevent="submitScan"
      />
      <v-btn
        data-testid="scan-submit-btn"
        color="primary"
        block
        :disabled="!scanValue.trim()"
        @click="submitScan"
      >
        Check In
      </v-btn>
    </v-card>

    <div class="rapid-checkin-panel__lists d-flex flex-column ga-4">
      <v-card
        class="pa-3"
        variant="outlined"
      >
        <div class="text-subtitle-2 mb-2">
          Now Playing (Next 30 mins)
        </div>
        <v-list
          density="compact"
          class="py-0"
        >
          <v-list-item
            v-for="item in props.urgentItems"
            :key="item.id"
            :title="item.title"
            :subtitle="item.subtitle"
          >
            <template #append>
              <v-chip
                v-if="item.startsInLabel"
                color="error"
                size="x-small"
                label
                class="mr-2"
              >
                {{ item.startsInLabel }}
              </v-chip>
              <v-btn
                size="small"
                :color="item.canCheckIn ? 'error' : 'default'"
                :variant="item.canCheckIn ? 'elevated' : 'tonal'"
                :disabled="!item.canCheckIn"
                @click="handleQuickCheckIn(item.id)"
              >
                Check In
              </v-btn>
            </template>
          </v-list-item>
          <v-list-item
            v-if="props.urgentItems.length === 0"
            title="No urgent matches in next 30 minutes"
            subtitle="Use scanner input to check in players."
          />
        </v-list>
      </v-card>

      <v-card
        class="pa-3"
        variant="outlined"
      >
        <div class="text-subtitle-2 mb-2">
          Recent Check-ins
        </div>
        <v-list
          density="compact"
          class="py-0"
        >
          <v-list-item
            v-for="item in props.recentItems"
            :key="item.id"
            :title="item.name"
            :subtitle="item.detail"
          >
            <template #append>
              <v-btn
                v-if="item.canUndo"
                size="small"
                variant="text"
                data-testid="recent-undo-btn"
                @click="handleUndo(item.id)"
              >
                Undo
              </v-btn>
            </template>
          </v-list-item>
          <v-list-item
            v-if="props.recentItems.length === 0"
            title="No recent check-ins yet"
          />
        </v-list>
      </v-card>
    </div>
  </div>
</template>

<style scoped>
.rapid-checkin-panel {
  width: 100%;
}

.rapid-checkin-panel__scanner {
  flex: 0 0 320px;
}

.rapid-checkin-panel__lists {
  min-width: 0;
  flex: 1;
}

@media (max-width: 960px) {
  .rapid-checkin-panel {
    flex-direction: column;
  }

  .rapid-checkin-panel__scanner {
    flex-basis: auto;
  }
}
</style>
