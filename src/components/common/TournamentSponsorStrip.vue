<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { TournamentSponsor } from '@/types';

interface TournamentSponsorStripProps {
  sponsors: TournamentSponsor[];
  dense?: boolean;
  maxVisible?: number;
}

const props = withDefaults(defineProps<TournamentSponsorStripProps>(), {
  dense: false,
  maxVisible: 20,
});

const failedSponsorIds = ref<string[]>([]);

const orderedSponsors = computed(() =>
  [...props.sponsors]
    .sort((left, right) => left.displayOrder - right.displayOrder)
    .slice(0, props.maxVisible)
);

watch(
  () => props.sponsors,
  () => {
    failedSponsorIds.value = [];
  },
  { deep: true, immediate: true }
);

const hasFailedLogo = (sponsorId: string): boolean => failedSponsorIds.value.includes(sponsorId);

const markLogoFailed = (sponsorId: string): void => {
  if (!failedSponsorIds.value.includes(sponsorId)) {
    failedSponsorIds.value = [...failedSponsorIds.value, sponsorId];
  }
};

const getSponsorAltText = (sponsor: TournamentSponsor): string => `${sponsor.name} logo`;
</script>

<template>
  <div
    v-if="orderedSponsors.length > 0"
    class="tournament-sponsor-strip"
    :class="{ 'tournament-sponsor-strip--dense': dense }"
  >
    <component
      :is="sponsor.website ? 'a' : 'div'"
      v-for="sponsor in orderedSponsors"
      :key="sponsor.id"
      class="tournament-sponsor-strip__item"
      :href="sponsor.website || undefined"
      :target="sponsor.website ? '_blank' : undefined"
      :rel="sponsor.website ? 'noopener noreferrer' : undefined"
    >
      <v-img
        v-if="sponsor.logoUrl && !hasFailedLogo(sponsor.id)"
        :src="sponsor.logoUrl"
        :alt="getSponsorAltText(sponsor)"
        class="tournament-sponsor-strip__logo"
        contain
        @error="markLogoFailed(sponsor.id)"
      />
      <span
        v-else
        class="tournament-sponsor-strip__name"
      >
        {{ sponsor.name }}
      </span>
    </component>
  </div>
</template>

<style scoped>
.tournament-sponsor-strip {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}

.tournament-sponsor-strip--dense {
  gap: 8px;
}

.tournament-sponsor-strip__item {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 52px;
  min-width: 96px;
  max-width: 180px;
  padding: 8px 14px;
  border-radius: 18px;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  background: rgba(var(--v-theme-surface), 0.9);
  box-shadow: 0 10px 20px rgba(15, 23, 42, 0.06);
  text-decoration: none;
}

.tournament-sponsor-strip--dense .tournament-sponsor-strip__item {
  min-height: 42px;
  min-width: 72px;
  padding: 6px 10px;
  border-radius: 14px;
}

.tournament-sponsor-strip__logo {
  width: 100%;
  min-width: 72px;
  max-width: 132px;
  height: 36px;
}

.tournament-sponsor-strip--dense .tournament-sponsor-strip__logo {
  min-width: 58px;
  max-width: 104px;
  height: 28px;
}

.tournament-sponsor-strip__name {
  font-size: 0.82rem;
  line-height: 1.2;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  text-align: center;
  color: rgba(var(--v-theme-on-surface), 0.72);
}
</style>
