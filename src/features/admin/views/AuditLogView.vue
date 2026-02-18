<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import AuditLogViewer from '@/components/admin/AuditLogViewer.vue';

const route = useRoute();
const tournamentId = computed(() => route.params.tournamentId as string);
</script>

<template>
  <AuditLogViewer :tournament-id="tournamentId" />
</template>
