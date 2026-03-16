<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { useOrganizationsStore } from '@/stores/organizations';
import type { Organization, Tournament } from '@/types';

const route = useRoute();
const orgStore = useOrganizationsStore();

const org = ref<Organization | null>(null);
const tournaments = ref<Tournament[]>([]);
const loading = ref(true);
const notFound = ref(false);

const slug = computed(() => route.params.orgSlug as string);

const sportEmoji: Record<string, string> = {
  badminton: '🏸',
  tennis: '🎾',
  pickleball: '🏓',
  squash: '🟡',
  tabletennis: '🏓',
};

const getSportEmoji = (sport: string | null | undefined) =>
  sport ? (sportEmoji[sport.toLowerCase()] ?? '🏆') : '🏆';

const statusColor: Record<string, string> = {
  live: '#22C55E',
  registration: '#3B82F6',
  draft: '#94A3B8',
  completed: '#64748B',
};
const statusLabel: Record<string, string> = {
  live: 'LIVE',
  registration: 'OPEN',
  draft: 'UPCOMING',
  completed: 'COMPLETED',
};

const getStatusColor = (status: string) => statusColor[status] ?? '#94A3B8';
const getStatusLabel = (status: string) => statusLabel[status] ?? status.toUpperCase();

const dateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const formatDate = (d: Date | null | undefined) => (d && !Number.isNaN(d.getTime()) ? dateFormatter.format(d) : null);

const getTournamentDateRange = (t: Tournament) => {
  const start = formatDate(t.startDate as unknown as Date);
  const end = formatDate(t.endDate as unknown as Date);
  if (!start && !end) return 'Date TBA';
  if (start && end && start !== end) return `${start} – ${end}`;
  return start ?? end ?? 'Date TBA';
};

// Derived stats
const totalTournaments = computed(() => tournaments.value.length);
const liveTournaments = computed(() => tournaments.value.filter((t) => t.status === 'live'));
const upcomingTournaments = computed(() => tournaments.value.filter((t) => t.status === 'registration' || t.status === 'draft'));
const completedTournaments = computed(() => tournaments.value.filter((t) => t.status === 'completed'));
const sports = computed(() => {
  const set = new Set<string>();
  tournaments.value.forEach((t) => { if (t.sport) set.add(t.sport); });
  return Array.from(set);
});

// Org initials for avatar fallback
const orgInitials = computed(() => {
  if (!org.value?.name) return '?';
  return org.value.name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
});

onMounted(async () => {
  try {
    const result = await orgStore.fetchOrgBySlug(slug.value);
    if (!result) {
      notFound.value = true;
      return;
    }
    org.value = result;
    await orgStore.fetchOrgTournaments(result.id);
    tournaments.value = orgStore.orgTournaments;
  } catch {
    notFound.value = true;
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <!-- Loading -->
  <div v-if="loading" class="org-public-loading">
    <v-progress-circular indeterminate color="#F59E0B" size="48" />
  </div>

  <!-- Not Found -->
  <div v-else-if="notFound" class="org-not-found">
    <v-icon size="72" color="#475569">mdi-office-building-remove</v-icon>
    <h2 class="org-not-found__title">Organization not found</h2>
    <p class="org-not-found__sub">The page <strong>{{ slug }}</strong> doesn't exist or may have moved.</p>
    <v-btn variant="outlined" color="#F59E0B" to="/" class="mt-4">Go Home</v-btn>
  </div>

  <!-- Org Page -->
  <div v-else-if="org" class="org-public">

    <!-- ── Hero ─────────────────────────────────────────────────────────── -->
    <div class="org-hero">
      <!-- Banner -->
      <div
        class="org-hero__banner"
        :style="org.bannerUrl ? `background-image: url('${org.bannerUrl}')` : ''"
      >
        <div class="org-hero__banner-overlay" />
      </div>

      <!-- Logo + Identity -->
      <div class="org-hero__identity">
        <div class="org-hero__logo-wrap">
          <img
            v-if="org.logoUrl"
            :src="org.logoUrl"
            :alt="org.name"
            class="org-hero__logo-img"
          />
          <div v-else class="org-hero__logo-initials">
            {{ orgInitials }}
          </div>
        </div>

        <div class="org-hero__meta">
          <h1 class="org-hero__name">{{ org.name }}</h1>
          <p v-if="org.about" class="org-hero__tagline">{{ org.about }}</p>
          <div class="org-hero__chips">
            <span v-for="sport in sports" :key="sport" class="org-hero__sport-chip">
              {{ getSportEmoji(sport) }} {{ sport }}
            </span>
            <a
              v-if="org.website"
              :href="org.website"
              target="_blank"
              rel="noopener noreferrer"
              class="org-hero__website-link"
            >
              <v-icon size="14">mdi-open-in-new</v-icon>
              {{ org.website.replace(/^https?:\/\//, '') }}
            </a>
          </div>
        </div>
      </div>
    </div>

    <!-- ── Stats Bar ──────────────────────────────────────────────────── -->
    <div class="org-stats-bar">
      <div class="org-stats-bar__item">
        <span class="org-stats-bar__value">{{ totalTournaments }}</span>
        <span class="org-stats-bar__label">Tournaments</span>
      </div>
      <div class="org-stats-bar__divider" />
      <div class="org-stats-bar__item">
        <span class="org-stats-bar__value">{{ liveTournaments.length }}</span>
        <span class="org-stats-bar__label">Live Now</span>
      </div>
      <div class="org-stats-bar__divider" />
      <div class="org-stats-bar__item">
        <span class="org-stats-bar__value">{{ completedTournaments.length }}</span>
        <span class="org-stats-bar__label">Completed</span>
      </div>
      <div class="org-stats-bar__divider" />
      <div class="org-stats-bar__item">
        <span class="org-stats-bar__value">{{ sports.length || '—' }}</span>
        <span class="org-stats-bar__label">Sports</span>
      </div>
    </div>

    <!-- ── Tournaments ────────────────────────────────────────────────── -->
    <div class="org-content">

      <!-- Live Section -->
      <section v-if="liveTournaments.length" class="org-section">
        <h2 class="org-section__heading">
          <span class="org-section__live-dot" />
          Live Now
        </h2>
        <div class="org-tournaments-grid">
          <router-link
            v-for="t in liveTournaments"
            :key="t.id"
            :to="`/tournaments/${t.id}/landing`"
            class="org-tournament-card org-tournament-card--live"
          >
            <div class="org-tournament-card__sport">{{ getSportEmoji(t.sport) }}</div>
            <div class="org-tournament-card__body">
              <div class="org-tournament-card__header">
                <span class="org-tournament-card__name">{{ t.name }}</span>
                <span
                  class="org-tournament-card__badge"
                  :style="`background: ${getStatusColor(t.status)}22; color: ${getStatusColor(t.status)}`"
                >{{ getStatusLabel(t.status) }}</span>
              </div>
              <div class="org-tournament-card__date">{{ getTournamentDateRange(t) }}</div>
              <div v-if="t.location" class="org-tournament-card__location">
                <v-icon size="13">mdi-map-marker</v-icon> {{ t.location }}
              </div>
            </div>
            <v-icon class="org-tournament-card__chevron" size="18">mdi-chevron-right</v-icon>
          </router-link>
        </div>
      </section>

      <!-- Upcoming / Registration Open Section -->
      <section v-if="upcomingTournaments.length" class="org-section">
        <h2 class="org-section__heading">Upcoming &amp; Open</h2>
        <div class="org-tournaments-grid">
          <router-link
            v-for="t in upcomingTournaments"
            :key="t.id"
            :to="`/tournaments/${t.id}/landing`"
            class="org-tournament-card org-tournament-card--upcoming"
          >
            <div class="org-tournament-card__sport">{{ getSportEmoji(t.sport) }}</div>
            <div class="org-tournament-card__body">
              <div class="org-tournament-card__header">
                <span class="org-tournament-card__name">{{ t.name }}</span>
                <span
                  class="org-tournament-card__badge"
                  :style="`background: ${getStatusColor(t.status)}22; color: ${getStatusColor(t.status)}`"
                >{{ getStatusLabel(t.status) }}</span>
              </div>
              <div class="org-tournament-card__date">{{ getTournamentDateRange(t) }}</div>
              <div v-if="t.location" class="org-tournament-card__location">
                <v-icon size="13">mdi-map-marker</v-icon> {{ t.location }}
              </div>
            </div>
            <v-icon class="org-tournament-card__chevron" size="18">mdi-chevron-right</v-icon>
          </router-link>
        </div>
      </section>

      <!-- Completed Section -->
      <section v-if="completedTournaments.length" class="org-section">
        <h2 class="org-section__heading">Past Tournaments</h2>
        <div class="org-tournaments-grid">
          <router-link
            v-for="t in completedTournaments"
            :key="t.id"
            :to="`/tournaments/${t.id}/landing`"
            class="org-tournament-card org-tournament-card--completed"
          >
            <div class="org-tournament-card__sport">{{ getSportEmoji(t.sport) }}</div>
            <div class="org-tournament-card__body">
              <div class="org-tournament-card__header">
                <span class="org-tournament-card__name">{{ t.name }}</span>
                <span
                  class="org-tournament-card__badge"
                  :style="`background: ${getStatusColor(t.status)}22; color: ${getStatusColor(t.status)}`"
                >{{ getStatusLabel(t.status) }}</span>
              </div>
              <div class="org-tournament-card__date">{{ getTournamentDateRange(t) }}</div>
              <div v-if="t.location" class="org-tournament-card__location">
                <v-icon size="13">mdi-map-marker</v-icon> {{ t.location }}
              </div>
            </div>
            <v-icon class="org-tournament-card__chevron" size="18">mdi-chevron-right</v-icon>
          </router-link>
        </div>
      </section>

      <!-- Empty State -->
      <section v-if="!totalTournaments" class="org-empty">
        <v-icon size="56" color="#475569">mdi-calendar-blank</v-icon>
        <p class="org-empty__text">No tournaments yet. Check back soon.</p>
      </section>

    </div><!-- /org-content -->

    <!-- ── Find Players CTA ──────────────────────────────────────────── -->
    <div style="text-align:center;padding:24px 0 8px;">
      <v-btn
        to="/find"
        variant="outlined"
        color="primary"
        prepend-icon="mdi-account-search"
        size="small"
      >
        Search All Players
      </v-btn>
    </div>

    <!-- ── Footer Attribution ─────────────────────────────────────────── -->
    <div class="org-footer">
      Powered by <strong>CourtMastr</strong>
    </div>

  </div><!-- /org-public -->
</template>

<style scoped>
/* ── Layout ──────────────────────────────────────────────────────────────── */
.org-public-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  background: #0F172A;
}

.org-not-found {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  background: #0F172A;
  color: #CBD5E1;
  gap: 12px;
  padding: 32px;
  text-align: center;
}
.org-not-found__title {
  font-size: 1.5rem;
  font-weight: 700;
  color: #F1F5F9;
}
.org-not-found__sub {
  color: #94A3B8;
  font-size: 0.95rem;
}

.org-public {
  min-height: 100vh;
  background: #0F172A;
  color: #F1F5F9;
}

/* ── Hero ─────────────────────────────────────────────────────────────────── */
.org-hero {
  position: relative;
  padding-bottom: 0;
}

.org-hero__banner {
  height: 220px;
  background: linear-gradient(135deg, #1E3A5F 0%, #0F172A 100%);
  background-size: cover;
  background-position: center;
  position: relative;
}

.org-hero__banner-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(to bottom, rgba(15,23,42,0.2) 0%, rgba(15,23,42,0.85) 100%);
}

.org-hero__identity {
  display: flex;
  align-items: flex-end;
  gap: 20px;
  padding: 0 24px 24px;
  margin-top: -60px;
  position: relative;
  z-index: 1;
}

.org-hero__logo-wrap {
  flex-shrink: 0;
  width: 96px;
  height: 96px;
  border-radius: 16px;
  border: 3px solid #1E293B;
  overflow: hidden;
  background: #1E293B;
  box-shadow: 0 4px 20px rgba(0,0,0,0.5);
}

.org-hero__logo-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.org-hero__logo-initials {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #1D4ED8, #7C3AED);
  font-size: 2rem;
  font-weight: 700;
  color: #fff;
  letter-spacing: -1px;
}

.org-hero__meta {
  flex: 1;
  min-width: 0;
  padding-bottom: 4px;
}

.org-hero__name {
  font-size: 1.75rem;
  font-weight: 800;
  color: #F1F5F9;
  line-height: 1.2;
  margin: 0 0 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.org-hero__tagline {
  font-size: 0.9rem;
  color: #94A3B8;
  margin: 0 0 8px;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.org-hero__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.org-hero__sport-chip {
  background: #1E293B;
  border: 1px solid #334155;
  border-radius: 20px;
  padding: 2px 10px;
  font-size: 0.78rem;
  color: #CBD5E1;
  text-transform: capitalize;
}

.org-hero__website-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.78rem;
  color: #60A5FA;
  text-decoration: none;
  border: 1px solid #1E40AF55;
  border-radius: 20px;
  padding: 2px 10px;
  background: #1E3A5F33;
}
.org-hero__website-link:hover {
  color: #93C5FD;
  border-color: #3B82F6;
}

/* ── Stats Bar ────────────────────────────────────────────────────────────── */
.org-stats-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  background: #1E293B;
  border-top: 1px solid #334155;
  border-bottom: 1px solid #334155;
  padding: 16px 24px;
  gap: 0;
}

.org-stats-bar__item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.org-stats-bar__value {
  font-size: 1.5rem;
  font-weight: 800;
  color: #F59E0B;
  line-height: 1;
}

.org-stats-bar__label {
  font-size: 0.7rem;
  color: #64748B;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: 600;
}

.org-stats-bar__divider {
  width: 1px;
  height: 32px;
  background: #334155;
  margin: 0 16px;
}

/* ── Content ─────────────────────────────────────────────────────────────── */
.org-content {
  padding: 24px 16px 40px;
  max-width: 860px;
  margin: 0 auto;
}

.org-section {
  margin-bottom: 32px;
}

.org-section__heading {
  font-size: 1rem;
  font-weight: 700;
  color: #CBD5E1;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.org-section__live-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #22C55E;
  box-shadow: 0 0 0 3px rgba(34,197,94,0.3);
  animation: livePulse 2s ease-in-out infinite;
}

@keyframes livePulse {
  0%, 100% { box-shadow: 0 0 0 3px rgba(34,197,94,0.3); }
  50%       { box-shadow: 0 0 0 6px rgba(34,197,94,0.1); }
}

/* ── Tournament Cards ────────────────────────────────────────────────────── */
.org-tournaments-grid {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.org-tournament-card {
  display: flex;
  align-items: center;
  gap: 14px;
  background: #1E293B;
  border-radius: 12px;
  padding: 14px 16px;
  text-decoration: none;
  color: inherit;
  border-left: 3px solid transparent;
  transition: background 0.15s, border-color 0.15s;
}

.org-tournament-card--live {
  border-left-color: #22C55E;
}

.org-tournament-card--upcoming {
  border-left-color: #3B82F6;
}

.org-tournament-card--completed {
  border-left-color: #334155;
  opacity: 0.85;
}

.org-tournament-card:hover {
  background: #263348;
}

.org-tournament-card__sport {
  font-size: 1.6rem;
  flex-shrink: 0;
  line-height: 1;
}

.org-tournament-card__body {
  flex: 1;
  min-width: 0;
}

.org-tournament-card__header {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.org-tournament-card__name {
  font-size: 0.95rem;
  font-weight: 600;
  color: #F1F5F9;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.org-tournament-card__badge {
  font-size: 0.65rem;
  font-weight: 800;
  padding: 2px 8px;
  border-radius: 4px;
  letter-spacing: 0.05em;
  white-space: nowrap;
}

.org-tournament-card__date {
  font-size: 0.8rem;
  color: #64748B;
  margin-top: 3px;
}

.org-tournament-card__location {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 0.78rem;
  color: #64748B;
  margin-top: 2px;
}

.org-tournament-card__chevron {
  color: #475569;
  flex-shrink: 0;
}

/* ── Empty ───────────────────────────────────────────────────────────────── */
.org-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 48px 24px;
  text-align: center;
}

.org-empty__text {
  color: #475569;
  font-size: 0.95rem;
}

/* ── Footer ──────────────────────────────────────────────────────────────── */
.org-footer {
  text-align: center;
  padding: 20px;
  color: #334155;
  font-size: 0.78rem;
  border-top: 1px solid #1E293B;
}

/* ── Responsive ──────────────────────────────────────────────────────────── */
@media (min-width: 600px) {
  .org-hero__banner {
    height: 280px;
  }
  .org-hero__identity {
    padding: 0 32px 28px;
  }
  .org-hero__name {
    font-size: 2.2rem;
  }
  .org-content {
    padding: 32px 32px 48px;
  }
}
</style>
