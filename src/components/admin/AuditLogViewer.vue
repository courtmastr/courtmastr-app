<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuditStore } from '@/stores/audit';
import FilterBar from '@/components/common/FilterBar.vue';

interface Props {
  tournamentId: string;
}

const props = defineProps<Props>();
const router = useRouter();
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
  { title: 'Score Corrected', value: 'match_score_corrected' },
  { title: 'Match Completed', value: 'match_completed' },
  { title: 'Registration Approved', value: 'registration_approved' },
  { title: 'Registration Rejected', value: 'registration_rejected' },
  { title: 'Registration Checked In', value: 'registration_checked_in' },
  { title: 'Tournament Created', value: 'tournament_created' },
  { title: 'Tournament Updated', value: 'tournament_updated' },
  { title: 'Bracket Generated', value: 'bracket_generated' },
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
  if (action.includes('updated')) return 'warning';
  if (action === 'match_score_corrected') return 'deep-orange-accent-3';
  if (action.includes('rejected') || action.includes('no_show')) return 'error';
  if (action.includes('approved') || action.includes('checked_in')) return 'info';
  return 'grey';
}

function getActionIcon(action: string): string {
  if (action.includes('created')) return 'mdi-plus-circle-outline';
  if (action.includes('updated')) return 'mdi-pencil-outline';
  if (action === 'match_score_corrected') return 'mdi-clipboard-edit-outline';
  if (action.includes('registration')) return 'mdi-account-check-outline';
  if (action.includes('bracket')) return 'mdi-sitemap';
  return 'mdi-history';
}

function formatAction(action: string): string {
  return action
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function formatDate(date: any): string {
  const d = date instanceof Date ? date : (date?.toDate ? date.toDate() : new Date(date));
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

function getTimeAgo(date: any): string {
  const d = date instanceof Date ? date : (date?.toDate ? date.toDate() : new Date(date));
  const diff = Math.floor((new Date().getTime() - d.getTime()) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return formatDate(d);
}

function goToEntity(log: any) {
  if (log.targetType === 'match') {
    router.push({
      path: `/tournaments/${props.tournamentId}/matches/${log.targetId}/score`,
      query: log.details?.categoryId ? { category: log.details.categoryId } : undefined
    });
  }
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
    <v-card class="premium-card rounded-xl overflow-hidden elevation-2">
      <v-card-title class="d-flex align-center py-6 px-6 glass-header">
        <div class="header-icon-container mr-4">
          <v-icon
            size="28"
            color="primary"
          >
            mdi-fingerprint
          </v-icon>
        </div>
        <div>
          <div class="text-h6 font-weight-black text-primary">
            System Audit Trail
          </div>
          <div class="text-caption text-medium-emphasis">
            Complete history of administrative operations
          </div>
        </div>
        <v-spacer />
        <v-chip
          size="small"
          variant="flat"
          color="primary"
          class="font-weight-bold"
        >
          {{ filteredLogs.length }} ENTRIES
        </v-chip>
      </v-card-title>

      <v-card-text class="pa-0">
        <div class="pa-4 glass-filter-bar">
          <FilterBar
            v-model:search="searchQuery"
            :enable-category="false"
            :enable-status="true"
            :enable-court="false"
            :status-options="actionOptions"
            :sort-options="sortOptions"
            search-label="Filter activity..."
            search-placeholder="Search records..."
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
                  label="Performed By"
                  no-filter
                  clearable
                  density="compact"
                  variant="outlined"
                  hide-details
                  rounded="lg"
                  class="actor-select"
                />
              </v-col>
            </template>
          </FilterBar>
        </div>

        <v-data-table
          :items="filteredLogs"
          :headers="[
            { title: 'Timestamp', key: 'createdAt', width: '180px' },
            { title: 'Operator', key: 'actorName', width: '180px' },
            { title: 'Operation', key: 'action', width: '220px' },
            { title: 'Activity Summary & Data', key: 'details' },
            { title: '', key: 'actions', width: '80px', sortable: false },
          ]"
          :loading="loading"
          density="comfortable"
          class="audit-table"
        >
          <template #item.createdAt="{ item }">
            <div class="d-flex flex-column">
              <span class="text-body-2 font-weight-bold">{{ formatDate(item.createdAt) }}</span>
              <span class="text-caption text-primary font-weight-bold uppercase">{{ getTimeAgo(item.createdAt) }}</span>
            </div>
          </template>

          <template #item.actorName="{ item }">
            <div class="d-flex align-center">
              <v-avatar
                size="32"
                class="mr-3 actor-avatar"
                elevation="2"
              >
                <v-img
                  v-if="item.actorPhotoUrl"
                  :src="item.actorPhotoUrl"
                />
                <span
                  v-else
                  class="text-caption font-weight-black"
                >
                  {{ item.actorName.charAt(0).toUpperCase() }}
                </span>
              </v-avatar>
              <div class="d-flex flex-column">
                <span class="text-body-2 font-weight-bold">{{ item.actorName }}</span>
                <span class="text-caption text-medium-emphasis">{{ item.actorRole || 'Organizer' }}</span>
              </div>
            </div>
          </template>

          <template #item.action="{ item }">
            <v-chip
              :color="getActionColor(item.action)"
              size="small"
              class="font-weight-black action-chip"
              variant="flat"
              label
            >
              <v-icon
                start
                size="14"
              >
                {{ getActionIcon(item.action) }}
              </v-icon>
              {{ formatAction(item.action).toUpperCase() }}
            </v-chip>
          </template>

          <template #item.details="{ item }">
            <div class="activity-detail-container pa-2">
              <div class="text-body-2 font-weight-medium mb-1">
                <template v-if="item.action === 'match_score_corrected'">
                  <div class="d-flex align-center flex-wrap ga-2">
                    <span class="text-primary font-weight-black">{{ item.details?.participant1Name }}</span>
                    <v-icon size="14">
                      mdi-sword-cross
                    </v-icon>
                    <span class="text-primary font-weight-black">{{ item.details?.participant2Name }}</span>
                    <v-chip
                      size="x-small"
                      color="warning"
                      class="font-weight-black"
                      variant="tonal"
                    >
                      {{ item.details?.correctionType === 'manual' ? 'MANUAL' : 'CORRECTION' }}
                    </v-chip>
                  </div>
                  <div class="text-caption mt-1 text-medium-emphasis">
                    Changed from <span class="text-decoration-line-through">{{ item.previousValues?.score }}</span> 
                    to <span class="font-weight-bold text-success">{{ item.newValues?.score }}</span>
                  </div>
                </template>
                <template v-else>
                  {{ item.description || formatAction(item.action) }}
                </template>
              </div>
              
              <div
                v-if="item.details?.reason"
                class="reason-note pa-2 rounded-lg mt-2"
              >
                <v-icon
                  size="14"
                  class="mr-1"
                >
                  mdi-chat-processing-outline
                </v-icon>
                <span class="text-caption font-italic">"{{ item.details.reason }}"</span>
              </div>
            </div>
          </template>

          <template #item.actions="{ item }">
            <v-btn
              v-if="item.targetType === 'match'"
              icon="mdi-chevron-right"
              variant="text"
              color="primary"
              density="comfortable"
              @click="goToEntity(item)"
            >
              <v-tooltip activator="parent">
                View Match Details
              </v-tooltip>
            </v-btn>
          </template>

          <template #no-data>
            <div class="d-flex flex-column align-center py-12">
              <v-icon
                size="64"
                color="grey-lighten-2"
                class="mb-4"
              >
                mdi-database-off-outline
              </v-icon>
              <div class="text-h6 text-medium-emphasis">
                No audit events recorded
              </div>
            </div>
          </template>
        </v-data-table>
      </v-card-text>
    </v-card>
  </div>
</template>

<style scoped>
.audit-log-viewer {
  padding: 1rem;
}

.premium-card {
  background: rgba(var(--v-theme-surface), 0.7) !important;
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.glass-header {
  background: rgba(var(--v-theme-primary), 0.05);
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.05);
}

.header-icon-container {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(var(--v-theme-primary), 0.1);
  border-radius: 14px;
}

.glass-filter-bar {
  background: rgba(var(--v-theme-surface), 0.4);
}

.actor-avatar {
  background: linear-gradient(135deg, rgb(var(--v-theme-primary)) 0%, #1a237e 100%);
  color: white;
}

.action-chip {
  letter-spacing: 0.05em;
  font-size: 10px !important;
}

.activity-detail-container {
  max-width: 500px;
}

.reason-note {
  background: rgba(var(--v-theme-on-surface), 0.03);
  border-left: 3px solid rgb(var(--v-theme-warning));
}

.audit-table :deep(.v-data-table__tr:hover) {
  background-color: rgba(var(--v-theme-primary), 0.03) !important;
}

.audit-table :deep(th) {
  text-transform: uppercase;
  font-size: 11px !important;
  font-weight: 800 !important;
  color: rgba(var(--v-theme-on-surface), 0.6) !important;
  letter-spacing: 1px;
}

.uppercase {
  text-transform: uppercase;
  font-size: 9px;
  letter-spacing: 0.5px;
}

.ga-2 {
  gap: 8px;
}

.actor-select :deep(.v-field__outline) {
  opacity: 0.5;
}
</style>
