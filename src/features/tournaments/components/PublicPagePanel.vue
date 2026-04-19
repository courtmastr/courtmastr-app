<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import QRCode from 'qrcode';
import { usePublishSnapshot } from '@/composables/usePublishSnapshot';
import { useTbdSchedule } from '@/composables/useTbdSchedule';
import { useNotificationStore } from '@/stores/notifications';
import { useTournamentStore } from '@/stores/tournaments';
import type { Category } from '@/types';

interface Props {
  tournamentId: string;
  categories: Category[];
  slug?: string;
  lastPushedAt?: Date | null;
}

const props = defineProps<Props>();

const notificationStore = useNotificationStore();
const tournamentStore = useTournamentStore();
const { publishing, publishSnapshot } = usePublishSnapshot();
const { entries: tbdEntries, loading: tbdLoading, loadTbdEntries, addTbdEntry, removeTbdEntry } = useTbdSchedule();

// QR code
const qrDataUrl = ref<string>('');
const showQrDialog = ref(false);

// Slug editing
const editingSlug = ref(false);
const slugDraft = ref('');
const savingSlug = ref(false);

function startEditSlug() {
  slugDraft.value = props.slug ?? '';
  editingSlug.value = true;
}

function sanitizeSlug(v: string): string {
  return v.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

async function saveSlug() {
  const clean = sanitizeSlug(slugDraft.value);
  if (!clean) return;
  if (clean === props.slug) { editingSlug.value = false; return; }
  savingSlug.value = true;
  try {
    await tournamentStore.updateTournament(props.tournamentId, { slug: clean });
    notificationStore.showToast('success', 'URL updated');
    editingSlug.value = false;
  } catch {
    notificationStore.showToast('error', 'Failed to update URL');
  } finally {
    savingSlug.value = false;
  }
}

// TBD form
const showAddForm = ref(false);
const newEntry = ref({
  categoryId: '',
  roundLabel: '',
  startDateTime: '',  // datetime-local value e.g. "2026-04-15T10:00"
  endDateTime: '',
  court: '',
});

function formatDateTime(dt: string): string {
  if (!dt) return '';
  const d = new Date(dt);
  return d.toLocaleString('en-US', {
    month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

const origin = window.location.origin;

const publicUrl = computed(() => {
  if (!props.slug) return null;
  return `${origin}/t/${props.slug}`;
});

const lastPushedLabel = computed(() => {
  if (!props.lastPushedAt) return 'Never';
  const diff = Date.now() - new Date(props.lastPushedAt).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(props.lastPushedAt).toLocaleDateString();
});

async function handlePush() {
  try {
    await publishSnapshot(props.tournamentId);
    notificationStore.showToast('success', 'Public page updated');
  } catch {
    notificationStore.showToast('error', 'Failed to publish. Please try again.');
  }
}

async function openQr() {
  if (!publicUrl.value) return;
  qrDataUrl.value = await QRCode.toDataURL(publicUrl.value, {
    width: 280,
    margin: 2,
    color: { dark: '#000000', light: '#ffffff' },
  });
  showQrDialog.value = true;
}

function copyLink() {
  if (!publicUrl.value) return;
  navigator.clipboard.writeText(publicUrl.value);
  notificationStore.showToast('success', 'Link copied to clipboard');
}

function downloadQr() {
  if (!qrDataUrl.value) return;
  const a = document.createElement('a');
  a.href = qrDataUrl.value;
  a.download = `tournament-qr-${props.slug ?? 'page'}.png`;
  a.click();
}

async function handleAddTbd() {
  if (!newEntry.value.categoryId || !newEntry.value.roundLabel || !newEntry.value.startDateTime || !newEntry.value.endDateTime) {
    notificationStore.showToast('error', 'Please fill in all required fields');
    return;
  }
  try {
    await addTbdEntry(props.tournamentId, {
      categoryId: newEntry.value.categoryId,
      roundLabel: newEntry.value.roundLabel,
      startTime: formatDateTime(newEntry.value.startDateTime),
      endTime: formatDateTime(newEntry.value.endDateTime),
      court: newEntry.value.court || undefined,
    });
    newEntry.value = { categoryId: '', roundLabel: '', startDateTime: '', endDateTime: '', court: '' };
    showAddForm.value = false;
    notificationStore.showToast('success', 'TBD entry added');
  } catch (err) {
    // error surfaced to user via toast below
    notificationStore.showToast('error', 'Failed to add TBD entry');
  }
}

async function handleRemoveTbd(entryId: string) {
  await removeTbdEntry(props.tournamentId, entryId);
  notificationStore.showToast('success', 'TBD entry removed');
}

onMounted(async () => {
  await loadTbdEntries(props.tournamentId);
});

watch(() => props.tournamentId, async (newId) => {
  if (newId) await loadTbdEntries(newId);
});
</script>

<template>
  <v-card
    variant="outlined"
    class="pub-panel"
  >
    <v-card-title class="pub-panel__header">
      <div class="d-flex align-center justify-space-between w-100">
        <span>
          <v-icon
            size="18"
            class="mr-1"
          >mdi-web</v-icon>
          Public Page
        </span>
        <v-chip
          v-if="slug"
          size="x-small"
          color="success"
          variant="flat"
        >
          <v-icon
            start
            size="10"
          >
            mdi-circle
          </v-icon>
          {{ lastPushedAt ? 'Live' : 'Not published' }}
        </v-chip>
      </div>
    </v-card-title>

    <v-card-text class="pa-3">
      <!-- Slug editor -->
      <div
        v-if="editingSlug"
        class="pub-panel__slug-edit"
      >
        <span class="pub-panel__slug-prefix">{{ `${origin}/t/` }}</span>
        <input
          v-model="slugDraft"
          class="pub-panel__slug-input"
          autofocus
          @keydown.enter="saveSlug"
          @keydown.esc="editingSlug = false"
        >
        <v-btn
          size="x-small"
          color="primary"
          variant="flat"
          :loading="savingSlug"
          @click="saveSlug"
        >
          Save
        </v-btn>
        <v-btn
          size="x-small"
          variant="text"
          @click="editingSlug = false"
        >
          Cancel
        </v-btn>
      </div>
      <div
        v-else
        class="pub-panel__url"
      >
        <v-icon
          size="14"
          color="primary"
          class="mr-1"
        >
          mdi-link
        </v-icon>
        <span class="pub-panel__url-text">{{ publicUrl ?? `${origin}/t/…` }}</span>
        <v-btn
          icon="mdi-pencil-outline"
          variant="text"
          size="x-small"
          class="pub-panel__url-edit"
          @click="startEditSlug"
        />
      </div>
      <div
        v-if="lastPushedAt"
        class="pub-panel__meta"
      >
        Last updated: {{ lastPushedLabel }}
      </div>

      <!-- Actions -->
      <div class="d-flex gap-2 mt-3">
        <v-btn
          color="primary"
          variant="flat"
          size="small"
          :loading="publishing"
          class="flex-grow-1"
          prepend-icon="mdi-upload"
          @click="handlePush"
        >
          Push Update
        </v-btn>
        <v-btn
          v-if="publicUrl"
          variant="outlined"
          size="small"
          icon="mdi-qrcode"
          @click="openQr"
        />
        <v-btn
          v-if="publicUrl"
          variant="outlined"
          size="small"
          icon="mdi-content-copy"
          @click="copyLink"
        />
      </div>
    </v-card-text>

    <v-divider />

    <!-- TBD Schedule Editor -->
    <v-card-text class="pa-3">
      <div class="pub-panel__section-header">
        <span class="pub-panel__section-title">
          <v-icon
            size="16"
            class="mr-1"
          >mdi-calendar-clock</v-icon>
          TBD Schedule
        </span>
        <v-btn
          size="x-small"
          variant="tonal"
          prepend-icon="mdi-plus"
          @click="showAddForm = !showAddForm"
        >
          Add
        </v-btn>
      </div>
      <div class="pub-panel__section-sub">
        Placeholder slots shown on the public page before matchups are known.
        Removed automatically when real matches are pushed for that round.
      </div>

      <!-- Add form -->
      <v-expand-transition>
        <div
          v-if="showAddForm"
          class="pub-panel__add-form mt-2"
        >
          <v-select
            v-model="newEntry.categoryId"
            :items="[{ title: 'All Divisions', value: '__all__' }, ...categories.map(c => ({ title: c.name, value: c.id }))]"
            label="Division *"
            density="compact"
            variant="outlined"
            class="mb-2"
          />
          <v-text-field
            v-model="newEntry.roundLabel"
            label="Round label * (e.g. QF, Semi Finals)"
            density="compact"
            variant="outlined"
            class="mb-2"
          />
          <div class="d-flex gap-2 mb-2">
            <v-text-field
              v-model="newEntry.startDateTime"
              label="Start *"
              type="datetime-local"
              density="compact"
              variant="outlined"
            />
            <v-text-field
              v-model="newEntry.endDateTime"
              label="End *"
              type="datetime-local"
              density="compact"
              variant="outlined"
            />
          </div>
          <v-text-field
            v-model="newEntry.court"
            label="Court (optional)"
            density="compact"
            variant="outlined"
            placeholder="Court 1–2"
            class="mb-2"
          />
          <div class="d-flex gap-2">
            <v-btn
              size="small"
              color="primary"
              variant="flat"
              @click="handleAddTbd"
            >
              Save
            </v-btn>
            <v-btn
              size="small"
              variant="text"
              @click="showAddForm = false"
            >
              Cancel
            </v-btn>
          </div>
        </div>
      </v-expand-transition>

      <!-- Existing entries -->
      <div
        v-if="tbdLoading"
        class="pub-panel__tbd-loading"
      >
        <v-progress-linear
          indeterminate
          color="primary"
        />
      </div>
      <div
        v-else-if="tbdEntries.length === 0 && !showAddForm"
        class="pub-panel__tbd-empty"
      >
        No TBD entries yet
      </div>
      <div
        v-for="entry in tbdEntries"
        :key="entry.id"
        class="pub-panel__tbd-entry"
      >
        <div class="pub-panel__tbd-entry-info">
          <span class="pub-panel__tbd-category">
            {{ entry.categoryId === '__all__' ? 'All Divisions' : (categories.find(c => c.id === entry.categoryId)?.name ?? entry.categoryId) }}
          </span>
          <span class="pub-panel__tbd-round">{{ entry.roundLabel }}</span>
          <span class="pub-panel__tbd-time">{{ entry.startTime }} – {{ entry.endTime }}</span>
          <span
            v-if="entry.court"
            class="pub-panel__tbd-court"
          >{{ entry.court }}</span>
        </div>
        <v-btn
          icon="mdi-delete-outline"
          variant="text"
          size="x-small"
          color="error"
          @click="handleRemoveTbd(entry.id)"
        />
      </div>
    </v-card-text>
  </v-card>

  <!-- QR Dialog -->
  <v-dialog
    v-model="showQrDialog"
    max-width="320"
  >
    <v-card>
      <v-card-title class="text-h6 pa-4">
        Share Public Page
      </v-card-title>
      <v-card-text class="text-center pa-4">
        <img
          v-if="qrDataUrl"
          :src="qrDataUrl"
          alt="QR Code"
          class="pub-panel__qr-img"
        >
        <div class="pub-panel__qr-url mt-2">
          {{ publicUrl }}
        </div>
      </v-card-text>
      <v-card-actions class="pa-3">
        <v-btn
          color="primary"
          variant="flat"
          prepend-icon="mdi-download"
          @click="downloadQr"
        >
          Download QR
        </v-btn>
        <v-btn
          variant="outlined"
          prepend-icon="mdi-content-copy"
          @click="copyLink"
        >
          Copy Link
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.pub-panel__header {
  font-size: 14px;
  font-weight: 600;
  padding: 12px 16px 8px;
}
.pub-panel__url {
  display: flex;
  align-items: center;
  background: rgba(0,0,0,0.05);
  border-radius: 6px;
  padding: 4px 6px 4px 8px;
  font-size: 12px;
}
.pub-panel__url-text {
  flex: 1;
  color: rgb(var(--v-theme-primary));
  font-family: monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pub-panel__url-edit {
  flex-shrink: 0;
  opacity: 0.5;
}
.pub-panel__url-edit:hover { opacity: 1; }

.pub-panel__slug-edit {
  display: flex;
  align-items: center;
  gap: 4px;
  background: rgba(0,0,0,0.05);
  border-radius: 6px;
  padding: 4px 8px;
  font-size: 11px;
  flex-wrap: wrap;
}
.pub-panel__slug-prefix {
  font-family: monospace;
  font-size: 10px;
  color: rgba(var(--v-theme-on-surface), 0.4);
  white-space: nowrap;
}
.pub-panel__slug-input {
  flex: 1;
  min-width: 80px;
  background: transparent;
  border: none;
  border-bottom: 1px solid rgb(var(--v-theme-primary));
  outline: none;
  font-family: monospace;
  font-size: 12px;
  color: rgb(var(--v-theme-on-surface));
  padding: 1px 2px;
}
.pub-panel__meta {
  font-size: 11px;
  color: rgba(var(--v-theme-on-surface), 0.5);
  margin-top: 4px;
}
.pub-panel__section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}
.pub-panel__section-title {
  font-size: 13px;
  font-weight: 600;
  display: flex;
  align-items: center;
}
.pub-panel__section-sub {
  font-size: 11px;
  color: rgba(var(--v-theme-on-surface), 0.5);
  margin-bottom: 8px;
  line-height: 1.4;
}
.pub-panel__add-form {
  background: rgba(0,0,0,0.04);
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 8px;
}
.pub-panel__tbd-loading {
  padding: 8px 0;
}
.pub-panel__tbd-empty {
  font-size: 12px;
  color: rgba(var(--v-theme-on-surface), 0.4);
  padding: 8px 0;
}
.pub-panel__tbd-entry {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 0;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.08);
}
.pub-panel__tbd-entry-info {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
}
.pub-panel__tbd-category {
  font-size: 11px;
  font-weight: 600;
  color: rgb(var(--v-theme-primary));
}
.pub-panel__tbd-round {
  font-size: 11px;
  color: rgba(var(--v-theme-on-surface), 0.8);
}
.pub-panel__tbd-time {
  font-size: 10px;
  color: rgba(var(--v-theme-on-surface), 0.5);
}
.pub-panel__tbd-court {
  font-size: 10px;
  color: rgba(var(--v-theme-on-surface), 0.4);
}
.pub-panel__qr-img {
  width: 200px;
  height: 200px;
  border-radius: 8px;
}
.pub-panel__qr-url {
  font-size: 11px;
  color: rgb(var(--v-theme-primary));
  font-family: monospace;
  word-break: break-all;
}
</style>
