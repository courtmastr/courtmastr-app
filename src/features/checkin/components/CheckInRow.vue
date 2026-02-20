<script setup lang="ts">
import { ref, computed } from 'vue';
import type { Registration } from '@/types';

interface Props {
  registration: Registration;
  participantName: string;
  categoryName: string;
  isSelected: boolean;
  isActive?: boolean;
  bibNumber?: number | null;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  select: [selected: boolean];
  checkIn: [];
  undo: [];
  restore: [];
  markNoShow: [];
  updateBib: [bibNumber: number | null];
}>();

const showNoShowConfirm = ref(false);
const bibInput = ref<number | null>(props.bibNumber ?? null);

const statusConfig = computed(() => {
  switch (props.registration.status) {
    case 'approved':
      return {
        color: 'grey' as const,
        label: 'Approved',
        primaryAction: {
          label: 'Check In',
          color: 'success' as const,
          icon: 'mdi-check',
          handler: () => emit('checkIn'),
        },
      };
    case 'checked_in':
      return {
        color: 'success' as const,
        label: 'Checked In',
        primaryAction: {
          label: 'Undo',
          color: 'grey' as const,
          icon: 'mdi-undo',
          handler: () => emit('undo'),
        },
      };
    case 'no_show':
      return {
        color: 'error' as const,
        label: 'No Show',
        primaryAction: {
          label: 'Restore',
          color: 'grey' as const,
          icon: 'mdi-restore',
          handler: () => emit('restore'),
        },
      };
    default:
      return {
        color: 'grey' as const,
        label: props.registration.status,
        primaryAction: null,
      };
  }
});

const hasBib = computed(() => !!props.registration.bibNumber);

function handlePrimaryAction() {
  statusConfig.value.primaryAction?.handler();
}

function handleMarkNoShow() {
  showNoShowConfirm.value = true;
}

function confirmNoShow() {
  showNoShowConfirm.value = false;
  emit('markNoShow');
}

function saveBib() {
  if (bibInput.value !== props.bibNumber) {
    emit('updateBib', bibInput.value);
  }
}
</script>

<template>
  <div
    :class="['checkin-row', { 'checkin-row--active': isActive }]"
    tabindex="0"
    @keydown.enter.prevent="handlePrimaryAction"
    @keydown.space.prevent="emit('select', !isSelected)"
  >
    <v-card
      variant="outlined"
      :class="['checkin-row__card', `checkin-row__card--${registration.status}`]"
      density="compact"
    >
      <v-card-text class="pa-3">
        <div class="d-flex align-center gap-3">
          <!-- Selection Checkbox -->
          <v-checkbox-btn
            :model-value="isSelected"
            density="compact"
            hide-details
            @update:model-value="emit('select', $event)"
          />

          <!-- Participant Info -->
          <div class="flex-grow-1 min-width-0">
            <div class="d-flex align-center gap-2">
              <span class="text-body-1 font-weight-medium text-truncate">
                {{ participantName }}
              </span>
              <v-chip
                :color="statusConfig.color"
                size="x-small"
                label
                variant="tonal"
              >
                {{ statusConfig.label }}
              </v-chip>
            </div>
            <div class="text-caption text-medium-emphasis">
              {{ categoryName }}
            </div>
          </div>

          <!-- Bib Number Input -->
          <div class="checkin-row__bib">
            <v-text-field
              v-model.number="bibInput"
              type="number"
              min="1"
              hide-details
              density="compact"
              variant="outlined"
              placeholder="Bib #"
              style="max-width: 80px;"
              :bg-color="hasBib ? 'success-lighten-4' : undefined"
              @blur="saveBib"
              @keydown.enter="saveBib"
            />
          </div>

          <!-- Primary Action Button -->
          <v-btn
            v-if="statusConfig.primaryAction"
            :color="statusConfig.primaryAction.color"
            :prepend-icon="statusConfig.primaryAction.icon"
            size="small"
            variant="elevated"
            class="checkin-row__primary-btn"
            @click="statusConfig.primaryAction.handler"
          >
            {{ statusConfig.primaryAction.label }}
          </v-btn>

          <!-- Overflow Menu -->
          <v-menu location="bottom end">
            <template #activator="{ props: menuProps }">
              <v-btn
                icon="mdi-dots-vertical"
                variant="text"
                size="small"
                density="compact"
                v-bind="menuProps"
              />
            </template>
            
            <v-list density="compact">
              <!-- Mark No Show (only when approved) -->
              <v-list-item
                v-if="registration.status === 'approved'"
                prepend-icon="mdi-account-off"
                title="Mark No Show"
                base-color="error"
                @click="handleMarkNoShow"
              />
              
              <!-- Edit Bib (always available) -->
              <v-list-item
                prepend-icon="mdi-numeric"
                title="Edit Bib Number"
                @click="() => { /* focus bib input */ }"
              />
              
              <v-divider v-if="registration.status === 'approved'" />
              
              <!-- Undo/Restore in menu as well -->
              <v-list-item
                v-if="registration.status === 'checked_in'"
                prepend-icon="mdi-undo"
                title="Undo Check-in"
                @click="emit('undo')"
              />
              <v-list-item
                v-if="registration.status === 'no_show'"
                prepend-icon="mdi-restore"
                title="Restore Participant"
                @click="emit('restore')"
              />
            </v-list>
          </v-menu>
        </div>
      </v-card-text>
    </v-card>

    <!-- No Show Confirmation Dialog -->
    <v-dialog
      v-model="showNoShowConfirm"
      max-width="400"
    >
      <v-card>
        <v-card-title class="text-h6">
          Confirm No Show
        </v-card-title>
        <v-card-text>
          Are you sure you want to mark <strong>{{ participantName }}</strong> as "No Show"?
          <br><br>
          This will prevent them from being included in match scheduling.
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn
            variant="text"
            @click="showNoShowConfirm = false"
          >
            Cancel
          </v-btn>
          <v-btn
            color="error"
            variant="elevated"
            @click="confirmNoShow"
          >
            Mark No Show
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<style scoped>
.checkin-row {
  outline: none;
}

.checkin-row--active .checkin-row__card {
  border-color: rgb(var(--v-theme-primary));
  box-shadow: 0 0 0 2px rgba(var(--v-theme-primary), 0.2);
}

.checkin-row__card {
  transition: all 0.15s ease;
}

.checkin-row__card--approved {
  border-left: 3px solid rgb(var(--v-theme-grey));
}

.checkin-row__card--checked_in {
  border-left: 3px solid rgb(var(--v-theme-success));
}

.checkin-row__card--no_show {
  border-left: 3px solid rgb(var(--v-theme-error));
  opacity: 0.9;
}

.checkin-row__card:focus-within {
  border-color: rgb(var(--v-theme-primary));
}

.checkin-row__primary-btn {
  min-width: 100px;
}

.min-width-0 {
  min-width: 0;
}

/* Keyboard navigation focus indicator */
.checkin-row:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 2px;
  border-radius: 4px;
}
</style>
