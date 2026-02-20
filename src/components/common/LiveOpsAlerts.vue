<script setup lang="ts">
import { computed } from 'vue';
import { useAlertsStore, type LiveOpsAlert } from '@/stores/alerts';

interface Props {
  tournamentId: string;
  maxAlerts?: number;
  showAcknowledged?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  maxAlerts: 5,
  showAcknowledged: false,
});

const alertsStore = useAlertsStore();

const displayedAlerts = computed(() => {
  let filtered = alertsStore.activeAlerts;
  if (props.showAcknowledged) {
    filtered = alertsStore.alerts.filter((a) => a.status !== 'resolved');
  }
  return filtered.slice(0, props.maxAlerts);
});

const hasAlerts = computed(() => displayedAlerts.value.length > 0);

const severityConfig: Record<LiveOpsAlert['severity'], { color: string; icon: string }> = {
  critical: { color: 'error', icon: 'mdi-alert-circle' },
  warning: { color: 'warning', icon: 'mdi-alert' },
  info: { color: 'info', icon: 'mdi-information' },
};

const categoryIcons: Record<LiveOpsAlert['category'], string> = {
  court: 'mdi-court-sport',
  match: 'mdi-tournament',
  schedule: 'mdi-calendar-clock',
  registration: 'mdi-account-group',
  system: 'mdi-server',
};

function getSeverityColor(severity: LiveOpsAlert['severity']): string {
  return severityConfig[severity].color;
}

function getCategoryIcon(category: LiveOpsAlert['category']): string {
  return categoryIcons[category];
}

async function acknowledgeAlert(alertId: string) {
  await alertsStore.acknowledgeAlert(props.tournamentId, alertId, 'current-user');
}

async function resolveAlert(alertId: string) {
  await alertsStore.resolveAlert(props.tournamentId, alertId, 'current-user');
}
</script>

<template>
  <v-card v-if="hasAlerts">
    <v-card-title class="d-flex align-center">
      <v-icon
        start
        color="error"
        class="mr-2"
      >
        mdi-bell-alert
      </v-icon>
      Live Alerts
      <v-chip
        :color="alertsStore.hasCriticalAlerts ? 'error' : 'warning'"
        size="small"
        class="ml-2"
      >
        {{ alertsStore.alertCount }}
      </v-chip>
    </v-card-title>
    <v-divider />
    <v-list density="compact">
      <v-list-item
        v-for="alert in displayedAlerts"
        :key="alert.id"
        :class="`bg-${getSeverityColor(alert.severity)}-lighten-5`"
      >
        <template #prepend>
          <v-avatar
            :color="getSeverityColor(alert.severity)"
            size="32"
          >
            <v-icon
              color="white"
              size="18"
            >
              {{ getCategoryIcon(alert.category) }}
            </v-icon>
          </v-avatar>
        </template>

        <v-list-item-title class="font-weight-medium">
          {{ alert.title }}
        </v-list-item-title>
        <v-list-item-subtitle class="text-caption">
          {{ alert.message }}
        </v-list-item-subtitle>

        <template #append>
          <v-btn
            v-if="alert.status === 'active'"
            icon="mdi-check"
            size="small"
            variant="text"
            color="success"
            @click="resolveAlert(alert.id)"
          />
          <v-btn
            v-if="alert.status === 'active'"
            icon="mdi-eye"
            size="small"
            variant="text"
            @click="acknowledgeAlert(alert.id)"
          />
        </template>
      </v-list-item>
    </v-list>
  </v-card>
</template>
