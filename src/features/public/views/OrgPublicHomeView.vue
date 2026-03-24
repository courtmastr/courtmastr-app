<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { useOrganizationsStore } from '@/stores/organizations';
import OrgSponsorCarousel from '@/components/common/OrgSponsorCarousel.vue';
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
  active: '#22C55E', // was 'live'
  registration: '#3B82F6',
  draft: '#94A3B8',
  completed: '#64748B',
};
const statusLabel: Record<string, string> = {
  active: 'LIVE', // was 'live'
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
const activeTournaments = computed(() => tournaments.value.filter((t) => t.status === 'active'));
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

// Stats bar
const upcomingCount = computed(() => upcomingTournaments.value.length);
const yearsActive = computed(() => {
  if (!org.value?.foundedYear) return null;
  return new Date().getFullYear() - org.value.foundedYear;
});

// Sponsors
const orgSponsors = computed(() => org.value?.sponsors ?? []);

// Social links
const socialLinks = computed(() => org.value?.socialLinks ?? {});
const hasSocialLinks = computed(() =>
  !!(socialLinks.value.instagram || socialLinks.value.facebook || socialLinks.value.youtube || socialLinks.value.twitter)
);

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
  <div
    v-if="loading"
    class="org-public-loading"
  >
    <v-progress-circular
      indeterminate
      color="#F59E0B"
      size="48"
    />
  </div>

  <!-- Not Found -->
  <div
    v-else-if="notFound"
    class="org-not-found"
  >
    <v-icon
      size="72"
      color="#475569"
    >
      mdi-office-building-remove
    </v-icon>
    <h2 class="org-not-found__title">
      Organization not found
    </h2>
    <p class="org-not-found__sub">
      The page <strong>{{ slug }}</strong> doesn't exist or may have moved.
    </p>
    <v-btn
      variant="outlined"
      color="#F59E0B"
      to="/"
      class="mt-4"
    >
      Go Home
    </v-btn>
  </div>

  <!-- Org Page -->
  <div
    v-else-if="org"
    class="org-public"
  >
    <!-- ── Hero ─────────────────────────────────────────────────────────── -->
    <div class="org-hero">
      <div 
        class="org-hero__banner" 
        :style="org.bannerUrl ? `background-image: url('${org.bannerUrl}')` : ''"
      >
        <div class="org-hero__banner-overlay" />
      </div>

      <v-container class="org-hero__container">
        <div class="org-hero__identity">
          <div class="org-hero__logo-wrap">
            <img
              v-if="org.logoUrl"
              :src="org.logoUrl"
              :alt="org.name"
              class="org-hero__logo-img"
            >
            <div
              v-else
              class="org-hero__logo-initials"
            >
              {{ orgInitials }}
            </div>
          </div>

          <div class="org-hero__meta">
            <h1 class="org-hero__name">
              {{ org.name }}
            </h1>
            
            <div class="org-hero__chips mt-3">
              <span
                v-if="org.city"
                class="org-hero__chip org-hero__chip--timezone"
              >
                <v-icon
                  size="14"
                  class="mr-1"
                >mdi-map-marker</v-icon> {{ org.city }}
              </span>
              <span
                v-if="org.timezone"
                class="org-hero__chip org-hero__chip--timezone"
              >
                <v-icon
                  size="14"
                  class="mr-1"
                >mdi-earth</v-icon> {{ org.timezone.replace('_', ' ') }}
              </span>
              <span
                v-if="org.foundedYear"
                class="org-hero__chip org-hero__chip--timezone"
              >
                <v-icon
                  size="14"
                  class="mr-1"
                >mdi-calendar-star</v-icon> Est. {{ org.foundedYear }}
              </span>
              <span
                v-for="sport in sports"
                :key="sport"
                class="org-hero__chip org-hero__chip--sport"
              >
                {{ getSportEmoji(sport) }} {{ sport }}
              </span>
            </div>

            <!-- Social links -->
            <div
              v-if="hasSocialLinks"
              class="org-hero__social mt-4"
            >
              <a
                v-if="socialLinks.instagram"
                :href="socialLinks.instagram.startsWith('http') ? socialLinks.instagram : `https://instagram.com/${socialLinks.instagram.replace('@','')}`"
                target="_blank"
                rel="noopener noreferrer"
                class="org-hero__social-btn"
                aria-label="Instagram"
              >
                <v-icon size="22">mdi-instagram</v-icon>
              </a>
              <a
                v-if="socialLinks.facebook"
                :href="socialLinks.facebook.startsWith('http') ? socialLinks.facebook : `https://facebook.com/${socialLinks.facebook}`"
                target="_blank"
                rel="noopener noreferrer"
                class="org-hero__social-btn"
                aria-label="Facebook"
              >
                <v-icon size="22">mdi-facebook</v-icon>
              </a>
              <a
                v-if="socialLinks.youtube"
                :href="socialLinks.youtube.startsWith('http') ? socialLinks.youtube : `https://youtube.com/@${socialLinks.youtube.replace('@','')}`"
                target="_blank"
                rel="noopener noreferrer"
                class="org-hero__social-btn"
                aria-label="YouTube"
              >
                <v-icon size="22">mdi-youtube</v-icon>
              </a>
              <a
                v-if="socialLinks.twitter"
                :href="socialLinks.twitter.startsWith('http') ? socialLinks.twitter : `https://x.com/${socialLinks.twitter.replace('@','')}`"
                target="_blank"
                rel="noopener noreferrer"
                class="org-hero__social-btn"
                aria-label="X / Twitter"
              >
                <v-icon size="22">mdi-twitter</v-icon>
              </a>
            </div>
          </div>
        </div>
      </v-container>
    </div>

    <!-- ── Stats Bar ────────────────────────────────────────────────────── -->
    <div class="org-stats-bar">
      <v-container class="org-stats-bar__inner">
        <div class="org-stats-bar__tile">
          <span class="org-stats-bar__value">{{ totalTournaments }}</span>
          <span class="org-stats-bar__label">Events</span>
        </div>
        <div class="org-stats-bar__divider" />
        <div class="org-stats-bar__tile">
          <span class="org-stats-bar__value org-stats-bar__value--live">{{ activeTournaments.length }}</span>
          <span class="org-stats-bar__label">Live</span>
        </div>
        <div class="org-stats-bar__divider" />
        <div class="org-stats-bar__tile">
          <span class="org-stats-bar__value org-stats-bar__value--blue">{{ upcomingCount }}</span>
          <span class="org-stats-bar__label">Upcoming</span>
        </div>
        <div class="org-stats-bar__divider" />
        <div class="org-stats-bar__tile">
          <span class="org-stats-bar__value org-stats-bar__value--muted">{{ completedTournaments.length }}</span>
          <span class="org-stats-bar__label">Completed</span>
        </div>
        <div class="org-stats-bar__divider" />
        <div class="org-stats-bar__tile">
          <span class="org-stats-bar__value">{{ sports.length || '—' }}</span>
          <span class="org-stats-bar__label">{{ sports.length === 1 ? 'Sport' : 'Sports' }}</span>
        </div>
        <template v-if="yearsActive !== null">
          <div class="org-stats-bar__divider" />
          <div class="org-stats-bar__tile">
            <span class="org-stats-bar__value org-stats-bar__value--gold">{{ yearsActive }}+</span>
            <span class="org-stats-bar__label">Years Active</span>
          </div>
        </template>
      </v-container>
    </div>

    <!-- ── Main Layout ──────────────────────────────────────────────────── -->
    <v-container class="org-main-layout pb-12 pt-8">
      <v-row>
        <!-- ── Left Column: About & Info ─────────────────────────────────── -->
        <v-col
          cols="12"
          md="4"
          lg="4"
          class="org-sidebar"
        >
          <v-card
            class="org-card mb-6"
            elevation="0"
          >
            <v-card-text class="pa-6">
              <h3 class="org-sidebar__heading mb-3">
                About Us
              </h3>
              <p class="org-about-text">
                {{ org.about || 'Welcome to our organization!' }}
              </p>

              <div class="org-contact-links mt-6">
                <a
                  v-if="org.website"
                  :href="org.website.startsWith('http') ? org.website : `https://${org.website}`"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="org-link-item"
                >
                  <v-icon
                    size="20"
                    color="#60A5FA"
                    class="mr-3"
                  >mdi-web</v-icon>
                  <span class="text-truncate">{{ org.website.replace(/^https?:\/\//, '').replace(/\/$/, '') }}</span>
                </a>
                
                <a
                  v-if="org.contactEmail"
                  :href="`mailto:${org.contactEmail}`"
                  class="org-link-item mt-3"
                >
                  <v-icon
                    size="20"
                    color="#60A5FA"
                    class="mr-3"
                  >mdi-email-outline</v-icon>
                  <span class="text-truncate">{{ org.contactEmail }}</span>
                </a>
              </div>
            </v-card-text>
          </v-card>

          <v-card
            class="org-card mb-6"
            elevation="0"
          >
            <v-card-text class="pa-6">
              <h3 class="org-sidebar__heading mb-5">
                Quick Stats
              </h3>
              <div class="org-stats-grid">
                <div class="org-stat-box">
                  <span class="org-stat-value text-primary">{{ totalTournaments }}</span>
                  <span class="org-stat-label">Events</span>
                </div>
                <div class="org-stat-box">
                  <span class="org-stat-value text-success">{{ activeTournaments.length }}</span>
                  <span class="org-stat-label">Live</span>
                </div>
                <div class="org-stat-box">
                  <span class="org-stat-value text-grey-lighten-1">{{ completedTournaments.length }}</span>
                  <span class="org-stat-label">Past</span>
                </div>
              </div>
            </v-card-text>
          </v-card>

          <!-- ── Find Players CTA ──────────────────────────────────────────── -->
          <v-btn
            to="/find"
            color="#F97316"
            prepend-icon="mdi-account-search"
            block
            size="large"
            class="org-cta-btn mb-6"
            elevation="4"
          >
            Search All Players
          </v-btn>
        </v-col>

        <!-- ── Right Column: Tournaments ──────────────────────────────────── -->
        <v-col
          cols="12"
          md="8"
          lg="8"
          class="org-content-area"
        >
          <!-- Live Section -->
          <section
            v-if="activeTournaments.length"
            class="org-section mb-10"
          >
            <h2 class="org-section__heading text-success">
              <span class="org-section__dot org-section__dot--live" />
              Live Now
            </h2>
            <div class="org-tournaments-grid">
              <router-link
                v-for="t in activeTournaments"
                :key="t.id"
                :to="`/tournaments/${t.id}/landing`"
                class="org-tournament-card org-tournament-card--live"
              >
                <div class="org-tournament-card__sport">
                  {{ getSportEmoji(t.sport) }}
                </div>
                <div class="org-tournament-card__body">
                  <div class="org-tournament-card__header">
                    <span class="org-tournament-card__name">{{ t.name }}</span>
                    <span
                      class="org-tournament-card__badge"
                      :style="`background: ${getStatusColor(t.status)}22; color: ${getStatusColor(t.status)}`"
                    >{{ getStatusLabel(t.status) }}</span>
                  </div>
                  <div class="org-tournament-card__date">
                    {{ getTournamentDateRange(t) }}
                  </div>
                  <div
                    v-if="t.location"
                    class="org-tournament-card__location"
                  >
                    <v-icon
                      size="14"
                      class="mr-1"
                    >
                      mdi-map-marker
                    </v-icon> {{ t.location }}
                  </div>
                </div>
                <v-icon
                  class="org-tournament-card__chevron"
                  size="24"
                >
                  mdi-chevron-right
                </v-icon>
              </router-link>
            </div>
          </section>

          <!-- Upcoming Section -->
          <section
            v-if="upcomingTournaments.length"
            class="org-section mb-10"
          >
            <h2 class="org-section__heading text-info">
              <span class="org-section__dot org-section__dot--upcoming" />
              Upcoming &amp; Open
            </h2>
            <div class="org-tournaments-grid">
              <router-link
                v-for="t in upcomingTournaments"
                :key="t.id"
                :to="`/tournaments/${t.id}/landing`"
                class="org-tournament-card org-tournament-card--upcoming"
              >
                <div class="org-tournament-card__sport">
                  {{ getSportEmoji(t.sport) }}
                </div>
                <div class="org-tournament-card__body">
                  <div class="org-tournament-card__header">
                    <span class="org-tournament-card__name">{{ t.name }}</span>
                    <span
                      class="org-tournament-card__badge"
                      :style="`background: ${getStatusColor(t.status)}22; color: ${getStatusColor(t.status)}`"
                    >{{ getStatusLabel(t.status) }}</span>
                  </div>
                  <div class="org-tournament-card__date">
                    {{ getTournamentDateRange(t) }}
                  </div>
                  <div
                    v-if="t.location"
                    class="org-tournament-card__location"
                  >
                    <v-icon
                      size="14"
                      class="mr-1"
                    >
                      mdi-map-marker
                    </v-icon> {{ t.location }}
                  </div>
                </div>
                <v-icon
                  class="org-tournament-card__chevron"
                  size="24"
                >
                  mdi-chevron-right
                </v-icon>
              </router-link>
            </div>
          </section>

          <!-- Completed Section -->
          <section
            v-if="completedTournaments.length"
            class="org-section"
          >
            <h2 class="org-section__heading text-grey-lighten-1">
              Past Tournaments
            </h2>
            <div class="org-tournaments-grid">
              <router-link
                v-for="t in completedTournaments"
                :key="t.id"
                :to="`/tournaments/${t.id}/landing`"
                class="org-tournament-card org-tournament-card--completed"
              >
                <div class="org-tournament-card__sport">
                  {{ getSportEmoji(t.sport) }}
                </div>
                <div class="org-tournament-card__body">
                  <div class="org-tournament-card__header">
                    <span class="org-tournament-card__name">{{ t.name }}</span>
                    <span
                      class="org-tournament-card__badge"
                      :style="`background: ${getStatusColor(t.status)}22; color: ${getStatusColor(t.status)}`"
                    >{{ getStatusLabel(t.status) }}</span>
                  </div>
                  <div class="org-tournament-card__date">
                    {{ getTournamentDateRange(t) }}
                  </div>
                  <div
                    v-if="t.location"
                    class="org-tournament-card__location"
                  >
                    <v-icon
                      size="14"
                      class="mr-1"
                    >
                      mdi-map-marker
                    </v-icon> {{ t.location }}
                  </div>
                </div>
                <v-icon
                  class="org-tournament-card__chevron"
                  size="24"
                >
                  mdi-chevron-right
                </v-icon>
              </router-link>
            </div>
          </section>

          <section
            v-if="!totalTournaments"
            class="org-empty"
          >
            <v-icon
              size="56"
              color="#475569"
            >
              mdi-calendar-blank
            </v-icon>
            <p class="org-empty__text">
              No tournaments yet. Check back soon.
            </p>
          </section>
        </v-col>
      </v-row>
    </v-container>

    <!-- ── Sponsor Carousel ───────────────────────────────────────────── -->
    <OrgSponsorCarousel
      v-if="orgSponsors.length"
      :sponsors="orgSponsors"
    />

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
  font-family: 'Barlow', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}

/* ── Hero ─────────────────────────────────────────────────────────────────── */
.org-hero {
  position: relative;
  border-bottom: 1px solid #1E293B;
}

.org-hero__banner {
  height: 280px;
  background: linear-gradient(135deg, #1E3A5F 0%, #0F172A 100%);
  background-size: cover;
  background-position: center;
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 0;
}

.org-hero__banner-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(to bottom, rgba(15,23,42,0.2) 0%, rgba(15,23,42,1) 100%);
}

.org-hero__container {
  position: relative;
  z-index: 1;
  padding-top: 200px;
  padding-bottom: 32px;
}

.org-hero__identity {
  display: flex;
  align-items: flex-end;
  gap: 32px;
}

.org-hero__logo-wrap {
  flex-shrink: 0;
  width: 140px;
  height: 140px;
  border-radius: 24px;
  border: 4px solid #0F172A;
  overflow: hidden;
  background: #1E293B;
  box-shadow: 0 16px 40px rgba(0,0,0,0.6);
}

.org-hero__logo-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  background: white; /* In case of transparent logos */
}

.org-hero__logo-initials {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #2563EB, #3B82F6);
  font-size: 3.5rem;
  font-weight: 800;
  color: #fff;
  letter-spacing: -2px;
}

.org-hero__meta {
  flex: 1;
  min-width: 0;
  padding-bottom: 12px;
}

.org-hero__name {
  font-family: 'Barlow Condensed', sans-serif;
  font-size: 3.5rem;
  font-weight: 800;
  color: #F8FAFC;
  line-height: 1.1;
  margin: 0;
  white-space: normal;
  text-shadow: 0 4px 12px rgba(0,0,0,0.5);
}

.org-hero__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
}

.org-hero__chip {
  background: #1E293B;
  border: 1px solid #334155;
  border-radius: 20px;
  padding: 6px 14px;
  font-size: 0.85rem;
  font-weight: 600;
  color: #E2E8F0;
  display: inline-flex;
  align-items: center;
  box-shadow: 0 2px 8px rgba(0,0,0,0.2);
}

.org-hero__chip--timezone {
  color: #94A3B8;
}
.org-hero__chip--sport {
  text-transform: capitalize;
}

/* ── Social Links ─────────────────────────────────────────────────────────── */
.org-hero__social {
  display: flex;
  gap: 8px;
  align-items: center;
}

.org-hero__social-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: #1E293B;
  border: 1px solid #334155;
  color: #64748B;
  text-decoration: none;
  transition: color 200ms ease, border-color 200ms ease, background 200ms ease;
}
.org-hero__social-btn:hover,
.org-hero__social-btn:focus-visible {
  color: #E2E8F0;
  border-color: #475569;
  background: #263348;
  outline: none;
}
.org-hero__social-btn:focus-visible {
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.5);
}

/* ── Stats Bar ────────────────────────────────────────────────────────────── */
.org-stats-bar {
  background: linear-gradient(90deg, #1A2535 0%, #0F1B2D 50%, #1A2535 100%);
  border-top: 1px solid #1E293B;
  border-bottom: 1px solid #1E293B;
  overflow-x: auto;
  scrollbar-width: none;
}
.org-stats-bar::-webkit-scrollbar { display: none; }

.org-stats-bar__inner {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0;
  padding-top: 0 !important;
  padding-bottom: 0 !important;
  min-height: 96px;
}

.org-stats-bar__tile {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 20px 32px;
  flex: 1;
  min-width: 100px;
  text-align: center;
}

.org-stats-bar__divider {
  width: 1px;
  height: 40px;
  background: #1E293B;
  flex-shrink: 0;
}

.org-stats-bar__value {
  font-family: 'Barlow Condensed', sans-serif;
  font-size: 2.75rem;
  font-weight: 800;
  line-height: 1;
  color: #F8FAFC;
  letter-spacing: -0.02em;
}
.org-stats-bar__value--live   { color: #22C55E; }
.org-stats-bar__value--blue   { color: #3B82F6; }
.org-stats-bar__value--muted  { color: #64748B; }
.org-stats-bar__value--gold   { color: #F59E0B; }

.org-stats-bar__label {
  font-size: 0.68rem;
  color: #475569;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-weight: 700;
}

/* ── Left Sidebar (Cards) ────────────────────────────────────────────────── */
.org-card {
  background: #1E293B !important;
  border: 1px solid #334155;
  border-radius: 20px !important;
  color: #F8FAFC !important;
}

.org-sidebar__heading {
  font-size: 1.15rem;
  font-weight: 800;
  color: #F8FAFC;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.org-about-text {
  font-size: 1rem;
  line-height: 1.6;
  color: #CBD5E1;
  white-space: pre-wrap;
}

.org-contact-links {
  display: flex;
  flex-direction: column;
}

.org-link-item {
  display: flex;
  align-items: center;
  color: #E2E8F0;
  text-decoration: none;
  font-size: 0.95rem;
  font-weight: 600;
  transition: color 150ms ease;
  overflow: hidden;
}
.org-link-item:hover, .org-link-item:focus-visible {
  color: #60A5FA;
  outline: none;
}
.org-link-item:focus-visible {
  text-decoration: underline;
}

/* ── Stats ───────────────────────────────────────────────────────────────── */
.org-stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  text-align: center;
}

.org-stat-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  background: #0F172A;
  padding: 16px 8px;
  border-radius: 12px;
  border: 1px solid #1E293B;
}

.org-stat-value {
  font-family: 'Barlow Condensed', sans-serif;
  font-size: 2rem;
  font-weight: 800;
  line-height: 1;
}

.org-stat-label {
  font-size: 0.7rem;
  color: #64748B;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: 700;
}

/* ── Content Area (Tournaments) ──────────────────────────────────────────── */
.org-section__heading {
  font-family: 'Barlow Condensed', sans-serif;
  font-size: 1.75rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  margin-bottom: 24px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.org-section__dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}

.org-section__dot--live {
  background: #22C55E;
  box-shadow: 0 0 0 4px rgba(34,197,94,0.2);
  animation: livePulse 2s ease-in-out infinite;
}

.org-section__dot--upcoming {
  background: #3B82F6;
  box-shadow: 0 0 0 4px rgba(59,130,246,0.2);
}

@keyframes livePulse {
  0%, 100% { box-shadow: 0 0 0 4px rgba(34,197,94,0.2); }
  50%       { box-shadow: 0 0 0 8px rgba(34,197,94,0.1); }
}

.org-tournaments-grid {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.org-tournament-card {
  display: flex;
  align-items: center;
  gap: 24px;
  background: #1E293B;
  border-radius: 20px;
  padding: 24px;
  text-decoration: none;
  color: inherit;
  border: 1px solid #334155;
  border-left: 8px solid transparent;
  transition: all 200ms cubic-bezier(0.4, 0, 0.2, 1);
  min-height: 112px;
}

.org-tournament-card--live {
  border-left-color: #22C55E;
}
.org-tournament-card--upcoming {
  border-left-color: #3B82F6;
}
.org-tournament-card--completed {
  border-left-color: #475569;
  opacity: 0.85;
}

.org-tournament-card:hover, .org-tournament-card:focus-visible {
  background: #263348;
  transform: translateY(-4px);
  box-shadow: 0 16px 40px rgba(0,0,0,0.4);
  border-color: #475569;
  outline: none;
}
.org-tournament-card:focus-visible {
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.5);
}

.org-tournament-card__sport {
  font-size: 2.5rem;
  flex-shrink: 0;
  line-height: 1;
  background: #0F172A;
  width: 72px;
  height: 72px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  box-shadow: inset 0 2px 8px rgba(0,0,0,0.3);
}

.org-tournament-card__body {
  flex: 1;
  min-width: 0;
}

.org-tournament-card__header {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}

.org-tournament-card__name {
  font-size: 1.4rem;
  font-weight: 800;
  color: #F8FAFC;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  letter-spacing: -0.01em;
}

.org-tournament-card__badge {
  font-size: 0.8rem;
  font-weight: 800;
  padding: 4px 12px;
  border-radius: 12px;
  letter-spacing: 0.05em;
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
}

.org-tournament-card__date {
  font-size: 1rem;
  color: #94A3B8;
  font-weight: 500;
}

.org-tournament-card__location {
  display: flex;
  align-items: center;
  font-size: 0.95rem;
  color: #64748B;
  margin-top: 8px;
  font-weight: 500;
}

.org-tournament-card__chevron {
  color: #64748B;
  flex-shrink: 0;
  transition: transform 200ms cubic-bezier(0.4, 0, 0.2, 1), color 200ms ease;
}

.org-tournament-card:hover .org-tournament-card__chevron,
.org-tournament-card:focus-visible .org-tournament-card__chevron {
  color: #F97316;
  transform: translateX(6px);
}

/* ── CTA Button ──────────────────────────────────────────────────────────── */
.org-cta-btn {
  font-weight: 800 !important;
  letter-spacing: 0.05em !important;
  min-height: 56px !important;
  border-radius: 16px !important;
  text-transform: uppercase !important;
  font-size: 1.05rem !important;
}

/* ── Empty & Footer ──────────────────────────────────────────────────────── */
.org-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 64px 24px;
  text-align: center;
  background: #1E293B;
  border-radius: 20px;
  border: 2px dashed #334155;
}
.org-empty__text {
  color: #94A3B8;
  font-size: 1.1rem;
  max-width: 300px;
  line-height: 1.5;
  font-weight: 500;
}

.org-footer {
  text-align: center;
  padding: 40px 24px;
  color: #64748B;
  font-size: 0.95rem;
  font-weight: 600;
}

/* ── Responsive ──────────────────────────────────────────────────────────── */
@media (max-width: 959px) {
  .org-hero__container {
    padding-top: 220px;
  }
  .org-hero__identity {
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 20px;
  }
  .org-hero__logo-wrap {
    width: 120px;
    height: 120px;
  }
  .org-hero__name {
    font-size: 2.75rem;
  }
  .org-hero__chips {
    justify-content: center;
  }
  .org-hero__social {
    justify-content: center;
  }
  .org-stats-bar__tile {
    padding: 16px 20px;
    min-width: 80px;
  }
  .org-stats-bar__value {
    font-size: 2rem;
  }
  .org-sidebar {
    order: 2; /* Sidebar moves under tournaments on mobile */
  }
  .org-content-area {
    order: 1;
    margin-bottom: 24px;
  }
  .org-tournament-card {
    flex-direction: column;
    align-items: flex-start;
    gap: 20px;
    padding: 20px;
  }
  .org-tournament-card__chevron {
    display: none;
  }
}

@media (max-width: 599px) {
  .org-hero__banner {
    height: 240px;
  }
  .org-hero__container {
    padding-top: 180px;
  }
  .org-hero__name {
    font-size: 2.25rem;
  }
  .org-hero__logo-wrap {
    width: 100px;
    height: 100px;
  }
  .org-section__heading {
    font-size: 1.5rem;
  }
}
</style>
