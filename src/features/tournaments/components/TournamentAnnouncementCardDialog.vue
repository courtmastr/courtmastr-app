<script setup lang="ts">
import { computed, ref } from 'vue';
import html2canvas from 'html2canvas';

interface TournamentAnnouncementCardDialogProps {
  modelValue: boolean;
  tournamentName: string;
  tournamentDate?: Date | null;
  tournamentLocation?: string | null;
  logoUrl?: string | null;
}

const props = withDefaults(defineProps<TournamentAnnouncementCardDialogProps>(), {
  tournamentDate: null,
  tournamentLocation: null,
  logoUrl: null,
});

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  downloaded: [];
}>();

const cardRef = ref<HTMLElement | null>(null);
const downloading = ref(false);

const hasLocation = computed(() => Boolean(props.tournamentLocation?.trim()));
const cardDateLabel = computed(() => {
  if (!props.tournamentDate) return 'Date TBD';
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(props.tournamentDate);
});

const dialogOpen = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
});

const handleDownload = async (): Promise<void> => {
  if (!cardRef.value || downloading.value) return;

  downloading.value = true;
  try {
    const canvas = await html2canvas(cardRef.value, {
      backgroundColor: '#0f172a',
      scale: 2,
      useCORS: true,
      logging: false,
    });
    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = 'courtmastr-announcement-card.png';
    link.click();
    emit('downloaded');
  } catch (error) {
    console.error('Failed to export tournament announcement card:', error);
  } finally {
    downloading.value = false;
  }
};
</script>

<template>
  <v-dialog
    v-model="dialogOpen"
    max-width="760"
  >
    <v-card>
      <v-card-title class="d-flex align-center justify-space-between flex-wrap ga-2">
        <span class="text-h6">Tournament Announcement Card</span>
        <v-chip
          size="small"
          color="primary"
          variant="tonal"
        >
          Shareable PNG
        </v-chip>
      </v-card-title>
      <v-card-text>
        <p class="text-body-2 text-medium-emphasis mb-4">
          Download and post this on social channels to announce your event.
        </p>

        <div class="announcement-card-shell">
          <article
            ref="cardRef"
            class="announcement-card"
            aria-label="Tournament announcement card preview"
          >
            <div class="announcement-card__top">
              <div class="announcement-card__brand d-flex align-center ga-2">
                <img
                  src="/logo.svg"
                  alt=""
                  width="22"
                  height="22"
                >
                <span>CourtMastr</span>
              </div>
              <div class="announcement-card__badge">
                Powered by CourtMastr
              </div>
            </div>

            <div class="announcement-card__main">
              <p class="announcement-card__label mb-2">
                Tournament Announcement
              </p>
              <h2 class="announcement-card__title">
                {{ tournamentName }}
              </h2>
              <p class="announcement-card__meta mb-0">
                {{ cardDateLabel }}
                <template v-if="hasLocation">
                  · {{ tournamentLocation }}
                </template>
              </p>
            </div>

            <div class="announcement-card__logo-wrap">
              <img
                :src="logoUrl || '/logo.svg'"
                alt="Tournament logo"
                class="announcement-card__logo"
              >
            </div>
          </article>
        </div>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn
          variant="text"
          @click="dialogOpen = false"
        >
          Close
        </v-btn>
        <v-btn
          color="primary"
          :loading="downloading"
          @click="handleDownload"
        >
          Download PNG
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.announcement-card-shell {
  background: linear-gradient(145deg, rgba(15, 23, 42, 0.06), rgba(29, 78, 216, 0.1));
  border-radius: 16px;
  padding: 16px;
}

.announcement-card {
  border-radius: 14px;
  background: linear-gradient(160deg, #0f172a 0%, #16213f 45%, #1d4ed8 100%);
  color: #ffffff;
  padding: 18px;
  min-height: 280px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.announcement-card__top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.announcement-card__brand {
  font-size: 0.85rem;
  font-weight: 700;
  letter-spacing: 0.04em;
}

.announcement-card__badge {
  border: 1px solid rgba(255, 255, 255, 0.34);
  border-radius: 999px;
  padding: 4px 10px;
  font-size: 0.72rem;
  letter-spacing: 0.02em;
}

.announcement-card__main {
  flex: 1;
}

.announcement-card__label {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  opacity: 0.86;
}

.announcement-card__title {
  margin: 0 0 8px;
  font-family: 'Barlow Condensed', 'Inter', sans-serif;
  font-size: clamp(2rem, 4vw, 2.8rem);
  line-height: 0.95;
}

.announcement-card__meta {
  font-size: 0.95rem;
  opacity: 0.9;
}

.announcement-card__logo-wrap {
  display: flex;
  justify-content: flex-end;
}

.announcement-card__logo {
  width: 92px;
  height: 92px;
  object-fit: contain;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.94);
  padding: 10px;
}

@media (max-width: 599px) {
  .announcement-card__top {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
