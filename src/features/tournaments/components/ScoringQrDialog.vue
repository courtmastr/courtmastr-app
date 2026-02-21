<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import QRCode from 'qrcode';
import BaseDialog from '@/components/common/BaseDialog.vue';

const props = defineProps<{
  modelValue: boolean;
  tournamentId: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  'copied': [];
}>();

const qrDataUrl = ref('');

const scoringUrl = computed(() =>
  `${window.location.origin}/tournaments/${props.tournamentId}/score`
);

async function generateQr() {
  qrDataUrl.value = await QRCode.toDataURL(scoringUrl.value, { width: 240, margin: 1 });
}

watch(() => props.modelValue, (open) => {
  if (open) generateQr();
});

async function copyLink() {
  await navigator.clipboard.writeText(scoringUrl.value);
  emit('copied');
}
</script>

<template>
  <BaseDialog
    :model-value="modelValue"
    title="Share Scoring Link"
    max-width="400"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <template #actions>
      <v-spacer />
      <v-btn
        variant="text"
        @click="emit('update:modelValue', false)"
      >
        Close
      </v-btn>
    </template>

    <div class="text-center mb-4">
      <v-img
        v-if="qrDataUrl"
        :src="qrDataUrl"
        width="240"
        class="mx-auto rounded"
        alt="Scoring QR code"
      />
      <v-skeleton-loader
        v-else
        type="image"
        width="240"
        class="mx-auto"
      />
    </div>

    <v-text-field
      :model-value="scoringUrl"
      readonly
      density="compact"
      variant="outlined"
      hide-details
      append-inner-icon="mdi-content-copy"
      class="mb-3"
      @click:append-inner="copyLink"
    />

    <div class="text-caption text-medium-emphasis">
      Anyone with this link can enter scores without logging in. Print or display at each court.
    </div>
  </BaseDialog>
</template>
