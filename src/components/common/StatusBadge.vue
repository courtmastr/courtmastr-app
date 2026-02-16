<script setup lang="ts">
import { computed } from 'vue';

type StatusType = 'match' | 'registration' | 'general';

interface Props {
  status: string;
  type?: StatusType;
  size?: 'x-small' | 'small' | 'default';
  showIcon?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  type: 'general',
  size: 'small',
  showIcon: true
});

const statusConfig = computed(() => {
  const normalizedStatus = props.status?.toLowerCase().replace(/_/g, ' ') || '';
  
  // Match statuses
  if (props.type === 'match' || ['scheduled', 'ready', 'in progress', 'completed', 'walkover', 'cancelled'].includes(normalizedStatus)) {
    switch (normalizedStatus) {
      case 'scheduled':
        return { color: 'info', label: 'Scheduled', icon: 'mdi-calendar-clock' };
      case 'ready':
        return { color: 'warning', label: 'Ready', icon: 'mdi-check-circle' };
      case 'in progress':
        return { color: 'success', label: 'In Progress', icon: 'mdi-play-circle' };
      case 'completed':
        return { color: 'success', label: 'Completed', icon: 'mdi-check' };
      case 'walkover':
        return { color: 'grey', label: 'Walkover', icon: 'mdi-flag' };
      case 'cancelled':
        return { color: 'error', label: 'Cancelled', icon: 'mdi-close-circle' };
      default:
        return { color: 'grey', label: props.status, icon: 'mdi-help-circle' };
    }
  }
  
  // Registration statuses
  if (props.type === 'registration' || ['pending', 'approved', 'checked in', 'rejected', 'withdrawn', 'no show'].includes(normalizedStatus)) {
    switch (normalizedStatus) {
      case 'pending':
        return { color: 'warning', label: 'Pending', icon: 'mdi-clock' };
      case 'approved':
        return { color: 'info', label: 'Approved', icon: 'mdi-check' };
      case 'checked in':
        return { color: 'success', label: 'Checked In', icon: 'mdi-check-decagram' };
      case 'rejected':
        return { color: 'error', label: 'Rejected', icon: 'mdi-close' };
      case 'withdrawn':
        return { color: 'grey', label: 'Withdrawn', icon: 'mdi-account-off' };
      case 'no show':
        return { color: 'error', label: 'No Show', icon: 'mdi-account-cancel' };
      default:
        return { color: 'grey', label: props.status, icon: 'mdi-help-circle' };
    }
  }
  
  // General statuses
  switch (normalizedStatus) {
    case 'active':
      return { color: 'success', label: 'Active', icon: 'mdi-check-circle' };
    case 'inactive':
      return { color: 'error', label: 'Inactive', icon: 'mdi-close-circle' };
    case 'draft':
      return { color: 'grey', label: 'Draft', icon: 'mdi-pencil' };
    case 'locked':
      return { color: 'warning', label: 'Locked', icon: 'mdi-lock' };
    default:
      return { color: 'grey', label: props.status, icon: 'mdi-help-circle' };
  }
});
</script>

<template>
  <v-chip
    :color="statusConfig.color"
    :size="size"
    :prepend-icon="showIcon ? statusConfig.icon : undefined"
    variant="tonal"
    label
  >
    {{ statusConfig.label }}
  </v-chip>
</template>
