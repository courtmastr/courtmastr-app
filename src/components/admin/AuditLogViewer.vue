<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useAuditStore, type AuditRecord, type AuditActionType } from '@/stores/audit';
import CompactDataTable from '@/components/common/CompactDataTable.vue';
import FilterBar from '@/components/common/FilterBar.vue';
import StatusBadge from '@/components/common/StatusBadge.vue';

interface Props {
  tournamentId: string;
}

const props = defineProps<Props>();

const auditStore = useAuditStore();

const searchQuery = ref('');
const selectedAction = ref<string>('all');
const selectedActor = ref<string>('all');
const selectedSort = ref<string>('newest');

const auditLogs = computed(() => auditStore.auditLogs);
const loading = computed(() => auditStore.loading);

const uniqueActors = computed(() => {
  const actors = new Map<string, string>();
  auditLogs.value.forEach(log => {
    if (!actors.has(log.actorId)) {
      actors.set(log.actorId, log.actorName);
    }
  });
  return Array.from(actors.entries()).map(([id, name]) => ({ id, name }));
});

const actionOptions = [
  { title: 'All Actions', value: 'all' },
  { title: 'Tournament Created', value: 'tournament_created' },
  { title: 'Tournament Updated', value: 'tournament_updated' },
  { title: 'Tournament Status Changed', value: 'tournament_status_changed' },
  { title: 'Category Created', value: 'category_created' },
  { title: 'Category Deleted', value: 'category_deleted' },
  { title: 'Court Created', value: 'court_created' },
  { title: 'Court Deleted', value: 'court_deleted' },
  { title: 'Registration Approved', value: 'registration_approved' },
  { title: 'Registration Rejected', value: 'registration_rejected' },
  { title: 'Registration Checked In', value: 'registration_checked_in' },
  { title: 'Registration Check-in Undo', value: 'registration_checked_in_undo' },
  { title: 'Registration No Show', value: 'registration_no_show' },
  { title: 'Match Completed', value: 'match_completed' },
  { title: 'Score Corrected', value: 'match_score_corrected' },
  { title: 'Bracket Generated', value: 'bracket_generated' },
  { title: 'Bracket Regenerated', value: 'bracket_regenerated' },
  { title: 'Seeding Updated', value: 'seeding_updated' },
  { title: 'Schedule Generated', value: 'schedule_generated' },
];

const actorFilterOptions = computed(() => [
  { title: 'All Actors', value: 'all' },
  ...uniqueActors.value.map(actor => ({ title: actor.name, value: actor.id })),
]);

const sortOptions = [
  { title: 'Newest First', value: 'newest' },
  { title: 'Oldest First', value: 'oldest' },
];

const filteredLogs = computed(() => {
  let result = [...auditLogs.value];

  if (selectedAction.value !== 'all') {
    result = result.filter(log => log.action === selectedAction.value);
  }

  if (selectedActor.value !== 'all') {
    result = result.filter(log => log.actorId === selectedActor.value);
  }

  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase();
    result = result.filter(log =>
      log.actorName.toLowerCase().includes(query) ||
      log.action.toLowerCase().includes(query) ||
      JSON.stringify(log.details).toLowerCase().includes(query)
    );
  }

  if (selectedSort.value === 'oldest') {
    result.reverse();
  }

  return result;
});

const hasActiveFilters = computed(() =>
  selectedAction.value !== 'all' ||
  selectedActor.value !== 'all' ||
  searchQuery.value.trim() !== ''
);

function clearFilters(): void {
  selectedAction.value = 'all';
  selectedActor.value = 'all';
  searchQuery.value = '';
}

function getActionColor(action: string): string {
  if (action.includes('created') || action.includes('generated')) return 'success';
  if (action.includes('deleted')) return 'error';
  if (action.includes('updated') || action.includes('corrected')) return 'warning';
  if (action.includes('rejected') || action.includes('no_show')) return 'error';
  if (action.includes('approved') || action.includes('checked_in')) return 'info';
  return 'grey';
}

function formatAction(action: string): string {
  return action
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function getDetailsSummary(details: Record<string, unknown>): string {
  const parts: string[] = [];

  if (details.participantName) {
    parts.push(String(details.participantName));
  }
  if (details.tournamentName) {
    parts.push(String(details.tournamentName));
  }
  if (details.categoryName) {
    parts.push(String(details.categoryName));
  }
  if (details.courtName) {
    parts.push(String(details.courtName));
  }
  if (details.score) {
    parts.push(`Score: ${details.score}`);
  }
  if (details.reason) {
    parts.push(`Reason: ${details.reason}`);
  }

  return parts.join(' • ') || JSON.stringify(details).slice(0, 100);
}

onMounted(() => {
  auditStore.subscribeAuditLogs(props.tournamentId, 100);
});

onUnmounted(() => {
  auditStore.unsubscribe();
});
</script>

<template>
  <div class="audit-log-viewer">
    <v-card>
      <v-card-title class="d-flex align-center py-4">
        <v-icon start class="mr-2">
          mdi-shield-account
        </v-icon>
        Audit Trail
        <v-spacer />
        <v-chip
          size="small"
          variant="tonal"
          color="info"
        >
          {{ filteredLogs.length }} entries
        </v-chip>
      </v-card-title>

      <v-card-text>
        <FilterBar
          v-model:search="searchQuery"
          :enable-category="false"
          :enable-status="true"
          :enable-court="false"
          :status-options="actionOptions"
          :sort-options="sortOptions"
          search-label="Search logs..."
          search-placeholder="Search by actor, action, or details..."
          :has-active-filters="hasActiveFilters"
          @clear="clearFilters"
        >
          <template #extra>
            <v-col
              cols="12"
              sm="6"
              md="3"
            >
              <v-autocomplete
                v-model="selectedActor"
                :items="actorFilterOptions"
                item-title="title"
                item-value="value"
                label="Actor"
                no-filter
                clearable
                density="compact"
                variant="outlined"
                hide-details
              />
            </v-col>
          </template>
        </FilterBar>

        <v-data-table
          :items="filteredLogs"
          :headers="[
            { title: 'Time', key: 'createdAt', width: '150px' },
            { title: 'Actor', key: 'actorName', width: '150px' },
            { title: 'Action', key: 'action', width: '180px' },
            { title: 'Details', key: 'details' },
          ]"
          :loading="loading"
          density="compact"
          class="audit-table"
        >
          <template #item.createdAt="{ item }">
            <span class="text-caption">
              {{ formatDate(item.createdAt) }}
            </span>
          </template>

          <template #item.actorName="{ item }">
            <div class="d-flex align-center">
              <v-avatar
                size="24"
                class="mr-2"
                color="primary"
              >
                <span class="text-caption">
                  {{ item.actorName.charAt(0).toUpperCase() }}
                </span>
              </v-avatar>
              <span class="text-body-2">{{ item.actorName }}</span>
            </div>
          </template>

          <template #item.action="{ item }">
            <v-chip
              :color="getActionColor(item.action)"
              size="small"
              variant="tonal"
              label
            >
              {{ formatAction(item.action) }}
            </v-chip>
          </template>

          <template #item.details="{ item }">
            <div class="text-body-2">
              {{ getDetailsSummary(item.details) }}
            </div>
            <div
              v-if="item.previousValues || item.newValues"
              class="text-caption text-medium-emphasis mt-1"
            >
              <span v-if="item.previousValues">
                Before: {{ JSON.stringify(item.previousValues).slice(0, 50) }}
              </span>
              <span v-if="item.previousValues && item.newValues"> → </span>
              <span v-if="item.newValues">
                After: {{ JSON.stringify(item.newValues).slice(0, 50) }}
              </span>
            </div>
          </template>

          <template #no-data>
            <v-alert
              type="info"
              variant="tonal"
              class="ma-4"
            >
              No audit logs found
            </v-alert>
          </template>
        </v-data-table>
      </v-card-text>
    </v-card>
  </div>
</template>

<style scoped>
.audit-log-viewer {
  height: 100%;
}

.audit-table :deep(.v-data-table__tr) {
  cursor: default;
}

.audit-table :deep(.v-data-table__tr:hover) {
  background-color: rgba(var(--v-theme-primary), 0.05);
}
</style>
