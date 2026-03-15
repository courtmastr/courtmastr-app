<script setup lang="ts">
import { ref, watch } from 'vue';
import type { TournamentLogo, TournamentSponsor } from '@/types';

interface TournamentBrandingDraft {
  tournamentLogo: TournamentLogo | null;
  tournamentLogoFile: File | null;
  removeTournamentLogo: boolean;
  sponsors: TournamentSponsor[];
  sponsorLogoFiles: Record<string, File | null>;
}

const props = defineProps<{
  tournamentId: string;
  sponsors: TournamentSponsor[];
  tournamentLogo: TournamentLogo | null | undefined;
}>();

const emit = defineEmits<{
  updateBranding: [payload: TournamentBrandingDraft];
}>();

const MAX_SPONSORS = 20;

const sponsorRows = ref<TournamentSponsor[]>([]);
const tournamentLogoPreview = ref<TournamentLogo | null>(null);
const tournamentLogoFile = ref<File | null>(null);
const removeTournamentLogo = ref(false);
const sponsorLogoFiles = ref<Record<string, File | null>>({});
const limitMessage = ref('');

const cloneTournamentLogo = (logo: TournamentLogo | null | undefined): TournamentLogo | null =>
  logo ? { ...logo } : null;

const cloneSponsor = (sponsor: TournamentSponsor): TournamentSponsor => ({
  ...sponsor,
});

const cloneSponsorFiles = (
  files: Record<string, File | null>
): Record<string, File | null> => ({ ...files });

const createPreviewUrl = (file: File): string => {
  if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
    return URL.createObjectURL(file);
  }

  return '';
};

const buildDraftPayload = (): TournamentBrandingDraft => ({
  tournamentLogo: cloneTournamentLogo(tournamentLogoPreview.value),
  tournamentLogoFile: tournamentLogoFile.value,
  removeTournamentLogo: removeTournamentLogo.value,
  sponsors: sponsorRows.value.map(cloneSponsor),
  sponsorLogoFiles: cloneSponsorFiles(sponsorLogoFiles.value),
});

const emitCurrentState = (): void => {
  emit('updateBranding', buildDraftPayload());
};

const resetDraft = (): void => {
  sponsorRows.value = props.sponsors.map(cloneSponsor);
  tournamentLogoPreview.value = cloneTournamentLogo(props.tournamentLogo);
  tournamentLogoFile.value = null;
  removeTournamentLogo.value = false;
  sponsorLogoFiles.value = {};
  limitMessage.value = '';
  emitCurrentState();
};

watch(
  () => [props.sponsors, props.tournamentLogo] as const,
  resetDraft,
  { deep: true, immediate: true }
);

const normalizeSponsorOrder = (): void => {
  sponsorRows.value = sponsorRows.value.map((sponsor, index) => ({
    ...sponsor,
    displayOrder: index,
  }));
};

const buildSponsorId = (): string =>
  `sponsor-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const addSponsor = (): void => {
  if (sponsorRows.value.length >= MAX_SPONSORS) {
    limitMessage.value = 'You can add up to 20 sponsors per tournament.';
    return;
  }

  sponsorRows.value = [
    ...sponsorRows.value,
    {
      id: buildSponsorId(),
      name: '',
      logoUrl: '',
      logoPath: '',
      website: '',
      displayOrder: sponsorRows.value.length,
    },
  ];
  limitMessage.value = '';
  normalizeSponsorOrder();
  emitCurrentState();
};

const moveSponsor = (index: number, direction: -1 | 1): void => {
  const nextIndex = index + direction;

  if (nextIndex < 0 || nextIndex >= sponsorRows.value.length) {
    return;
  }

  const nextRows = [...sponsorRows.value];
  const current = nextRows[index];
  nextRows[index] = nextRows[nextIndex];
  nextRows[nextIndex] = current;
  sponsorRows.value = nextRows;
  normalizeSponsorOrder();
  emitCurrentState();
};

const removeSponsor = (index: number): void => {
  const [removedSponsor] = sponsorRows.value.splice(index, 1);

  if (removedSponsor) {
    delete sponsorLogoFiles.value[removedSponsor.id];
  }

  limitMessage.value = '';
  normalizeSponsorOrder();
  emitCurrentState();
};

const updateSponsorField = (
  index: number,
  field: 'name' | 'website',
  value: string
): void => {
  const sponsor = sponsorRows.value[index];

  if (!sponsor) {
    return;
  }

  sponsor[field] = value;
  emitCurrentState();
};

const coerceSelectedFile = (value: File | File[] | null | undefined): File | null => {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
};

const handleTournamentLogoChange = (value: File | File[] | null | undefined): void => {
  const file = coerceSelectedFile(value);
  tournamentLogoFile.value = file;
  removeTournamentLogo.value = false;

  if (file) {
    tournamentLogoPreview.value = {
      url: createPreviewUrl(file),
      storagePath: props.tournamentLogo?.storagePath ?? '',
    };
  } else {
    tournamentLogoPreview.value = cloneTournamentLogo(props.tournamentLogo);
  }

  emitCurrentState();
};

const clearTournamentLogo = (): void => {
  tournamentLogoPreview.value = null;
  tournamentLogoFile.value = null;
  removeTournamentLogo.value = true;
  emitCurrentState();
};

const handleSponsorLogoChange = (
  index: number,
  value: File | File[] | null | undefined
): void => {
  const sponsor = sponsorRows.value[index];

  if (!sponsor) {
    return;
  }

  const file = coerceSelectedFile(value);
  const originalSponsor = props.sponsors.find((item) => item.id === sponsor.id);

  sponsorLogoFiles.value = {
    ...sponsorLogoFiles.value,
    [sponsor.id]: file,
  };

  sponsor.logoUrl = file ? createPreviewUrl(file) : originalSponsor?.logoUrl ?? '';
  sponsor.logoPath = originalSponsor?.logoPath ?? '';
  emitCurrentState();
};
</script>

<template>
  <v-card class="mb-4">
    <v-card-title>
      <v-icon start>
        mdi-image-multiple
      </v-icon>
      Tournament Branding
    </v-card-title>
    <v-card-text>
      <v-alert
        type="info"
        variant="tonal"
        density="compact"
        class="mb-4"
      >
        Add one tournament logo and up to 20 sponsor logos for public pages and overlays.
      </v-alert>

      <v-alert
        v-if="limitMessage"
        type="warning"
        variant="tonal"
        density="compact"
        class="mb-4"
      >
        {{ limitMessage }}
      </v-alert>

      <div class="branding-section mb-6">
        <div class="branding-section__header">
          <div>
            <div class="text-subtitle-1 font-weight-bold">
              Tournament Logo
            </div>
            <div class="text-body-2 text-medium-emphasis">
              One primary logo used across tournament and public-facing screens.
            </div>
          </div>
          <v-btn
            v-if="tournamentLogoPreview"
            variant="text"
            color="error"
            prepend-icon="mdi-delete-outline"
            @click="clearTournamentLogo"
          >
            Remove Logo
          </v-btn>
        </div>

        <div class="branding-logo-preview mb-4">
          <v-img
            v-if="tournamentLogoPreview?.url"
            :src="tournamentLogoPreview.url"
            :alt="`${props.tournamentId} tournament logo`"
            class="branding-logo-preview__image"
            cover
          />
          <div
            v-else
            class="branding-logo-preview__placeholder"
          >
            <v-icon size="32">
              mdi-image-outline
            </v-icon>
            <span>No logo uploaded</span>
          </div>
        </div>

        <v-file-input
          label="Upload tournament logo"
          accept="image/*"
          variant="outlined"
          density="comfortable"
          prepend-icon="mdi-upload"
          clearable
          show-size
          hide-details="auto"
          @update:model-value="handleTournamentLogoChange"
        />
      </div>

      <div class="branding-section">
        <div class="branding-section__header">
          <div>
            <div class="d-flex align-center gap-2">
              <span class="text-subtitle-1 font-weight-bold">Sponsors</span>
              <v-chip
                size="small"
                variant="outlined"
              >
                {{ sponsorRows.length }}/20
              </v-chip>
            </div>
            <div class="text-body-2 text-medium-emphasis">
              Each sponsor needs a name, logo, optional website, and display order.
            </div>
          </div>
          <v-btn
            data-testid="add-sponsor"
            color="primary"
            prepend-icon="mdi-plus"
            @click="addSponsor"
          >
            Add Sponsor
          </v-btn>
        </div>

        <v-alert
          v-if="sponsorRows.length === 0"
          type="info"
          variant="tonal"
          density="compact"
          class="mt-4"
        >
          No sponsors added yet.
        </v-alert>

        <div
          v-for="(sponsor, index) in sponsorRows"
          :key="sponsor.id"
          class="sponsor-row mt-4"
        >
          <div class="sponsor-row__actions">
            <v-btn
              icon="mdi-arrow-up"
              variant="text"
              size="small"
              :disabled="index === 0"
              :aria-label="`Move sponsor ${sponsor.name || index + 1} up`"
              @click="moveSponsor(index, -1)"
            />
            <v-btn
              icon="mdi-arrow-down"
              variant="text"
              size="small"
              :disabled="index === sponsorRows.length - 1"
              :aria-label="`Move sponsor ${sponsor.name || index + 1} down`"
              @click="moveSponsor(index, 1)"
            />
            <v-btn
              icon="mdi-delete-outline"
              variant="text"
              size="small"
              color="error"
              :aria-label="`Remove sponsor ${sponsor.name || index + 1}`"
              @click="removeSponsor(index)"
            />
          </div>

          <v-row>
            <v-col
              cols="12"
              md="4"
            >
              <v-text-field
                :model-value="sponsor.name"
                label="Sponsor Name"
                variant="outlined"
                density="comfortable"
                hide-details="auto"
                @update:model-value="updateSponsorField(index, 'name', String($event ?? ''))"
              />
            </v-col>
            <v-col
              cols="12"
              md="4"
            >
              <v-text-field
                :model-value="sponsor.website ?? ''"
                label="Website (Optional)"
                variant="outlined"
                density="comfortable"
                hide-details="auto"
                @update:model-value="updateSponsorField(index, 'website', String($event ?? ''))"
              />
            </v-col>
            <v-col
              cols="12"
              md="4"
            >
              <v-file-input
                label="Sponsor Logo"
                accept="image/*"
                variant="outlined"
                density="comfortable"
                prepend-icon="mdi-image-plus"
                clearable
                show-size
                hide-details="auto"
                @update:model-value="handleSponsorLogoChange(index, $event)"
              />
            </v-col>
          </v-row>

          <div
            v-if="sponsor.logoUrl"
            class="sponsor-row__preview"
          >
            <v-img
              :src="sponsor.logoUrl"
              :alt="`${sponsor.name || 'Sponsor'} logo`"
              class="sponsor-row__preview-image"
              contain
            />
          </div>
        </div>
      </div>
    </v-card-text>
  </v-card>
</template>

<style scoped>
.branding-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.branding-section__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.branding-logo-preview {
  border: 1px dashed rgba(var(--v-theme-outline), 0.5);
  border-radius: 16px;
  min-height: 160px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(var(--v-theme-surface-variant), 0.18);
  overflow: hidden;
}

.branding-logo-preview__image {
  width: 100%;
  max-width: 320px;
  height: 160px;
}

.branding-logo-preview__placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: rgba(var(--v-theme-on-surface), 0.65);
}

.sponsor-row {
  border: 1px solid rgba(var(--v-theme-outline), 0.35);
  border-radius: 16px;
  padding: 16px;
  background: rgba(var(--v-theme-surface-variant), 0.12);
}

.sponsor-row__actions {
  display: flex;
  justify-content: flex-end;
  gap: 4px;
  margin-bottom: 8px;
}

.sponsor-row__preview {
  display: flex;
  justify-content: flex-start;
  margin-top: 8px;
}

.sponsor-row__preview-image {
  width: 140px;
  height: 72px;
  border-radius: 12px;
  background: rgb(var(--v-theme-surface));
}
</style>
