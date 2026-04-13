<template>
  <v-navigation-drawer
    v-model="drawer"
    :rail="rail"
    aria-label="Main navigation"
  >
    <!-- Branding Section -->
    <v-list-item
      class="branding-section cursor-pointer"
      nav
      :ripple="false"
      @click="router.push('/dashboard')"
    >
      <template #prepend>
        <div class="brand-logo-container">
          <BrandLogo
            v-if="!rail"
            variant="lockup"
            :width="140"
            :height="28"
            alt="CourtMastr"
            class-name="app-logo-expanded"
          />
          <BrandLogo
            v-else
            variant="mark"
            :width="28"
            :height="28"
            alt="CourtMastr"
            class-name="app-logo-collapsed"
          />
        </div>
      </template>
      <template #append>
        <!-- Collapse button: only when expanded -->
        <v-btn
          v-if="!rail"
          icon="mdi-chevron-left"
          variant="text"
          aria-label="Collapse sidebar"
          @click.stop="collapseToRail"
        />
        <!-- Expand button: only when in rail (icon-only) mode -->
        <v-btn
          v-else
          icon="mdi-chevron-right"
          variant="text"
          size="small"
          aria-label="Expand sidebar"
          @click.stop="expandFromRail"
        />
      </template>
    </v-list-item>

    <!-- Super Admin Identity Badge -->
    <div
      v-if="isWebAdmin && !rail"
      class="super-admin-badge"
    >
      <v-icon
        size="13"
        color="#a855f7"
      >
        mdi-shield-crown
      </v-icon>
      <span class="super-admin-badge__label">Platform Admin</span>
    </div>
    <div
      v-else-if="isWebAdmin && rail"
      class="super-admin-badge super-admin-badge--rail"
      title="Platform Admin"
    >
      <v-icon
        size="16"
        color="#a855f7"
      >
        mdi-shield-crown
      </v-icon>
    </div>

    <v-divider />

    <v-list
      nav
      density="compact"
    >
      <!-- Always visible -->
      <v-list-item
        to="/dashboard"
        :prepend-icon="NAVIGATION_ICONS.orgDashboard"
        title="Overview"
        class="nav-item nav-item--org-dashboard"
        rounded="lg"
        :ripple="false"
      />
      <!-- Super Admin primary nav (no org context) -->
      <template v-if="isSuperAdminMode">
        <v-divider class="my-2" />
        <v-list-item
          to="/super/dashboard"
          prepend-icon="mdi-view-dashboard-outline"
          title="Platform Dashboard"
          class="nav-item nav-item--super-admin"
          rounded="lg"
          :ripple="false"
        />
        <v-list-item
          to="/super/orgs"
          prepend-icon="mdi-domain"
          title="All Organizations"
          class="nav-item nav-item--super-orgs"
          rounded="lg"
          :ripple="false"
        />
        <v-list-item
          to="/admin/reviews"
          :prepend-icon="NAVIGATION_ICONS.reviewModeration"
          title="Review Moderation"
          class="nav-item nav-item--reviews"
          rounded="lg"
          :ripple="false"
        />
      </template>

      <template v-if="showOrgNav">
        <v-list-item
          to="/tournaments"
          :prepend-icon="NAVIGATION_ICONS.tournaments"
          title="Tournaments"
          class="nav-item nav-item--tournaments"
          rounded="lg"
          :ripple="false"
        />
        <v-list-item
          v-if="isOrganizer"
          to="/tournaments/create"
          :prepend-icon="NAVIGATION_ICONS.createTournament"
          title="Create Tournament"
          class="nav-item nav-item--create"
          rounded="lg"
          :ripple="false"
        />
        <v-list-item
          v-if="isOrganizer"
          to="/org/profile"
          :prepend-icon="NAVIGATION_ICONS.organization"
          title="Organization"
          class="nav-item nav-item--organization"
          rounded="lg"
          :ripple="false"
        />
        <v-list-item
          v-if="isOrganizer"
          to="/players"
          :prepend-icon="NAVIGATION_ICONS.players"
          title="Players"
          class="nav-item nav-item--players"
          rounded="lg"
          :ripple="false"
        />
      </template>
      <!-- While impersonating an org: show review moderation + escape back to super dashboard -->
      <template v-if="isWebAdmin && superAdminStore.isImpersonating">
        <v-list-item
          to="/admin/reviews"
          :prepend-icon="NAVIGATION_ICONS.reviewModeration"
          title="Review Moderation"
          class="nav-item nav-item--reviews"
          rounded="lg"
          :ripple="false"
        />
        <v-divider class="my-2" />
        <v-list-item
          to="/super/dashboard"
          prepend-icon="mdi-shield-crown"
          title="Platform Admin"
          class="nav-item nav-item--super-admin"
          rounded="lg"
          :ripple="false"
        />
      </template>

      <!-- Tournament-specific sections -->
      <template v-if="currentTournamentId">
        <!-- Event Center (standalone anchor — always visible) -->
        <v-divider class="my-2" />
        <v-list-item
          :to="`/tournaments/${currentTournamentId}`"
          :prepend-icon="NAVIGATION_ICONS.dashboard"
          title="Event Center"
          class="nav-item nav-item--dashboard"
          rounded="lg"
          :ripple="false"
        />

        <!-- ── DAY OF ─────────────────────────────────── -->
        <v-divider class="my-2" />
        <div
          v-if="!rail"
          class="nav-section-header"
          role="button"
          tabindex="0"
          :aria-expanded="sections.dayOf"
          @click="toggleSection('dayOf')"
          @keydown.enter.prevent="toggleSection('dayOf')"
          @keydown.space.prevent="toggleSection('dayOf')"
        >
          <span class="nav-section-label">Day Of</span>
          <v-icon
            icon="mdi-chevron-down"
            size="14"
            class="nav-section-arrow"
            :class="{ 'nav-section-arrow--collapsed': !sections.dayOf }"
          />
        </div>
        <template v-if="rail || sections.dayOf">
          <v-list-item
            v-if="isOrganizer"
            :to="`/tournaments/${currentTournamentId}/match-control`"
            :prepend-icon="NAVIGATION_ICONS.matchControl"
            title="Match Control"
            class="nav-item nav-item--match-control"
            rounded="lg"
            :ripple="false"
          />
          <v-list-item
            v-if="isOrganizer"
            :to="`/tournaments/${currentTournamentId}/checkin`"
            :prepend-icon="NAVIGATION_ICONS.checkIn"
            title="Check-in"
            class="nav-item nav-item--check-in"
            rounded="lg"
            :ripple="false"
          />
          <v-list-item
            v-if="isOrganizer && isTournamentLive"
            :to="`/tournaments/${currentTournamentId}/live-view`"
            :prepend-icon="NAVIGATION_ICONS.liveView"
            title="Live View"
            class="nav-item nav-item--live-view"
            rounded="lg"
            :ripple="false"
          />
        </template>

        <!-- ── RESULTS ────────────────────────────────── -->
        <v-divider class="my-2" />
        <div
          v-if="!rail"
          class="nav-section-header"
          role="button"
          tabindex="0"
          :aria-expanded="sections.results"
          @click="toggleSection('results')"
          @keydown.enter.prevent="toggleSection('results')"
          @keydown.space.prevent="toggleSection('results')"
        >
          <span class="nav-section-label">Results</span>
          <v-icon
            icon="mdi-chevron-down"
            size="14"
            class="nav-section-arrow"
            :class="{ 'nav-section-arrow--collapsed': !sections.results }"
          />
        </div>
        <template v-if="rail || sections.results">
          <v-list-item
            :to="`/tournaments/${currentTournamentId}/brackets`"
            :prepend-icon="NAVIGATION_ICONS.brackets"
            title="Brackets"
            class="nav-item nav-item--brackets"
            rounded="lg"
            :ripple="false"
          />
          <v-list-item
            v-if="smartBracketPath"
            :to="smartBracketPath"
            :prepend-icon="NAVIGATION_ICONS.smartBracket"
            :title="smartBracketNavTitle"
            class="nav-item nav-item--smart-bracket"
            rounded="lg"
            :ripple="false"
          />
          <v-list-item
            :to="`/tournaments/${currentTournamentId}/leaderboard`"
            :prepend-icon="NAVIGATION_ICONS.leaderboard"
            title="Leaderboard"
            class="nav-item nav-item--leaderboard"
            rounded="lg"
            :ripple="false"
          />
        </template>

        <!-- ── PREPARE ────────────────────────────────── -->
        <v-divider class="my-2" />
        <div
          v-if="!rail"
          class="nav-section-header"
          role="button"
          tabindex="0"
          :aria-expanded="sections.prepare"
          @click="toggleSection('prepare')"
          @keydown.enter.prevent="toggleSection('prepare')"
          @keydown.space.prevent="toggleSection('prepare')"
        >
          <span class="nav-section-label">Prepare</span>
          <v-icon
            icon="mdi-chevron-down"
            size="14"
            class="nav-section-arrow"
            :class="{ 'nav-section-arrow--collapsed': !sections.prepare }"
          />
        </div>
        <template v-if="rail || sections.prepare">
          <v-list-item
            v-if="isOrganizer"
            :to="`/tournaments/${currentTournamentId}/categories`"
            :prepend-icon="NAVIGATION_ICONS.categories"
            title="Categories"
            class="nav-item nav-item--categories"
            rounded="lg"
            :ripple="false"
          />
          <v-list-item
            v-if="isOrganizer"
            :to="`/tournaments/${currentTournamentId}/courts`"
            :prepend-icon="NAVIGATION_ICONS.courts"
            title="Courts"
            class="nav-item nav-item--courts"
            rounded="lg"
            :ripple="false"
          />
          <v-list-item
            v-if="isOrganizer"
            :to="`/tournaments/${currentTournamentId}/registrations`"
            :prepend-icon="NAVIGATION_ICONS.registrations"
            title="Registrations"
            class="nav-item nav-item--registrations"
            rounded="lg"
            :ripple="false"
          />
        </template>

        <!-- ── SHARE & STREAM ──────────────────────────── -->
        <v-divider class="my-2" />
        <div
          v-if="!rail"
          class="nav-section-header"
          role="button"
          tabindex="0"
          :aria-expanded="sections.shareStream"
          @click="toggleSection('shareStream')"
          @keydown.enter.prevent="toggleSection('shareStream')"
          @keydown.space.prevent="toggleSection('shareStream')"
        >
          <span class="nav-section-label">Share & Stream</span>
          <v-icon
            icon="mdi-chevron-down"
            size="14"
            class="nav-section-arrow"
            :class="{ 'nav-section-arrow--collapsed': !sections.shareStream }"
          />
        </div>
        <template v-if="rail || sections.shareStream">
          <v-list-item
            :to="`/tournaments/${currentTournamentId}/bracket`"
            :prepend-icon="NAVIGATION_ICONS.publicBracket"
            title="Public Bracket"
            class="nav-item nav-item--public-bracket"
            rounded="lg"
            :ripple="false"
          />
          <v-list-item
            :to="`/tournaments/${currentTournamentId}/schedule`"
            :prepend-icon="NAVIGATION_ICONS.publicSchedule"
            title="Public Schedule"
            class="nav-item nav-item--public-schedule"
            rounded="lg"
            :ripple="false"
          />
          <v-list-item
            :to="`/tournaments/${currentTournamentId}/score`"
            :prepend-icon="NAVIGATION_ICONS.scoreEntry"
            title="Score Entry"
            class="nav-item nav-item--score-entry"
            rounded="lg"
            :ripple="false"
          />
          <v-list-item
            v-if="isOrganizer"
            :to="`/tournaments/${currentTournamentId}/overlays`"
            :prepend-icon="NAVIGATION_ICONS.overlayLinks"
            title="Overlay Links"
            class="nav-item nav-item--overlay-links"
            rounded="lg"
            :ripple="false"
          />
        </template>
      </template>
    </v-list>

    <!-- Bottom: Settings + Logout -->
    <template #append>
      <v-list
        nav
        density="compact"
      >
        <v-divider class="mb-2" />
        <v-list-item
          v-if="currentTournamentId && isOrganizer"
          :to="`/tournaments/${currentTournamentId}/settings`"
          :prepend-icon="NAVIGATION_ICONS.settings"
          title="Tournament Settings"
          class="nav-item nav-item--settings"
          rounded="lg"
          :ripple="false"
        />
        <v-list-item
          to="/help"
          :prepend-icon="NAVIGATION_ICONS.help"
          title="Help Center"
          class="nav-item nav-item--help"
          rounded="lg"
          :ripple="false"
        />
        <v-list-item
          href="/logout"
          :prepend-icon="NAVIGATION_ICONS.logout"
          title="Logout"
          class="nav-item nav-item--logout"
          rounded="lg"
          :ripple="false"
          @click.prevent="handleLogout"
        />
      </v-list>
    </template>
  </v-navigation-drawer>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useTournamentStore } from '@/stores/tournaments';
import { useSuperAdminStore } from '@/stores/superAdmin';
import { useNavigationState } from '@/composables/useNavigationState';
import BrandLogo from '@/components/common/BrandLogo.vue';
import { NAVIGATION_ICONS } from '@/constants/navigationIcons';

const drawer = defineModel<boolean>('drawer');

const { rail, sections, collapseToRail, expandFromRail, toggleSection } = useNavigationState();

const authStore = useAuthStore();
const tournamentStore = useTournamentStore();
const superAdminStore = useSuperAdminStore();
const route = useRoute();
const router = useRouter();

const isOrganizer = computed(() => authStore.isOrganizer);
const isWebAdmin = computed(() => authStore.isSuperAdmin);

// Pure super-admin mode: web admin who is NOT currently impersonating an org
const isSuperAdminMode = computed(() => isWebAdmin.value && !superAdminStore.isImpersonating);

// Hide org-level nav items when super admin hasn't entered an org context
const showOrgNav = computed(() =>
  !route.path.startsWith('/super') && (!isWebAdmin.value || superAdminStore.isImpersonating)
);
const categories = computed(() => tournamentStore.categories);
const currentTournamentId = computed(() => {
  const routeParams = route.params;
  return routeParams.tournamentId as string || tournamentStore.currentTournament?.id || '';
});

const isTournamentLive = computed(() =>
  tournamentStore.currentTournament?.state === 'LIVE'
);

const smartBracketPath = computed(() => {
  const tournamentId = currentTournamentId.value;
  if (!tournamentId) return '';

  const routeCategoryId = route.params.categoryId as string | undefined;
  const categoryId = routeCategoryId || categories.value[0]?.id;
  if (!categoryId) return '';

  return `/tournaments/${tournamentId}/categories/${categoryId}/smart-bracket`;
});

const smartBracketNavTitle = computed(() => {
  const routeCategoryId = route.params.categoryId as string | undefined;
  const categoryId = routeCategoryId || categories.value[0]?.id;
  if (!categoryId) return 'Bracket';

  const category = categories.value.find((c) => c.id === categoryId);
  if (!category) return 'Bracket';

  const isPoolPhase = category.format === 'pool_to_elimination' && category.poolPhase !== 'elimination';
  return isPoolPhase ? 'Pool Play' : 'Bracket';
});

async function handleLogout(): Promise<void> {
  await authStore.signOut();
  await router.push('/');
}
</script>

<style lang="scss" scoped>
@use '@/styles/variables.scss' as *;

.v-list-item--nav {
  margin-bottom: 4px;
}

.nav-item {
  --cm-icon-start: #4f8dfd;
  --cm-icon-end: #2d6fe0;
  --cm-accent: #2d6fe0;
  --cm-active-bg: rgba(45, 111, 224, 0.16);
  --cm-active-bg-soft: rgba(45, 111, 224, 0.08);
  --cm-shadow: rgba(45, 111, 224, 0.24);
  --cm-shadow-strong: rgba(45, 111, 224, 0.34);
}

:deep(.nav-item .v-list-item__prepend) {
  margin-inline-end: 10px;
}

:deep(.nav-item .v-list-item__prepend .v-icon) {
  width: 28px;
  height: 28px;
  border-radius: 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  color: #fff;
  background: linear-gradient(135deg, var(--cm-icon-start), var(--cm-icon-end));
  box-shadow: 0 8px 18px var(--cm-shadow);
  transition: transform 160ms ease-out, box-shadow 160ms ease-out, filter 160ms ease-out;
}

:deep(.nav-item:hover .v-list-item__prepend .v-icon) {
  transform: translateY(-1px);
  box-shadow: 0 12px 22px var(--cm-shadow-strong);
  filter: saturate(1.08);
}

:deep(.nav-item:hover .v-list-item-title) {
  color: var(--cm-accent);
}

// Branding Section
.branding-section {
  min-height: 64px;
  display: flex;
  align-items: center;
  margin-top: 8px;
  margin-bottom: 8px;
}

.brand-logo-container {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
}

.app-logo-expanded {
  height: 32px;
  width: auto;
}

.app-logo-collapsed {
  height: 28px;
  width: auto;
  margin-left: 2px;
}

:deep(.nav-item.v-list-item--active) {
  background: linear-gradient(90deg, var(--cm-active-bg), var(--cm-active-bg-soft));
  color: var(--cm-accent) !important;
}

:deep(.nav-item.v-list-item--active::before) {
  opacity: 0;
}

:deep(.nav-item.v-list-item--active .v-list-item__prepend .v-icon) {
  box-shadow: 0 12px 24px var(--cm-shadow-strong);
  filter: saturate(1.14);
}

:deep(.nav-item.v-list-item--active .v-list-item-title) {
  color: var(--cm-accent);
  font-weight: $font-weight-bold;
}

.nav-item--tournaments,
.nav-item--dashboard,
.nav-item--courts,
.nav-item--public-schedule {
  --cm-icon-start: #63a4ff;
  --cm-icon-end: #3478f6;
  --cm-accent: #2f68dd;
  --cm-active-bg: rgba(52, 120, 246, 0.16);
  --cm-active-bg-soft: rgba(52, 120, 246, 0.07);
  --cm-shadow: rgba(52, 120, 246, 0.25);
  --cm-shadow-strong: rgba(52, 120, 246, 0.34);
}

.nav-item--create,
.nav-item--match-control,
.nav-item--score-entry {
  --cm-icon-start: #ffb463;
  --cm-icon-end: #f0812c;
  --cm-accent: #d66a16;
  --cm-active-bg: rgba(240, 129, 44, 0.18);
  --cm-active-bg-soft: rgba(240, 129, 44, 0.07);
  --cm-shadow: rgba(240, 129, 44, 0.28);
  --cm-shadow-strong: rgba(240, 129, 44, 0.38);
}

.nav-item--check-in,
.nav-item--registrations {
  --cm-icon-start: #56cb9b;
  --cm-icon-end: #1fa66f;
  --cm-accent: #198f60;
  --cm-active-bg: rgba(31, 166, 111, 0.18);
  --cm-active-bg-soft: rgba(31, 166, 111, 0.07);
  --cm-shadow: rgba(31, 166, 111, 0.26);
  --cm-shadow-strong: rgba(31, 166, 111, 0.35);
}

.nav-item--live-view {
  --cm-icon-start: #5cd6e8;
  --cm-icon-end: #1da7c5;
  --cm-accent: #1488a3;
  --cm-active-bg: rgba(29, 167, 197, 0.18);
  --cm-active-bg-soft: rgba(29, 167, 197, 0.07);
  --cm-shadow: rgba(29, 167, 197, 0.27);
  --cm-shadow-strong: rgba(29, 167, 197, 0.36);
}

.nav-item--brackets,
.nav-item--public-bracket {
  --cm-icon-start: #8183ff;
  --cm-icon-end: #5e61d8;
  --cm-accent: #4f52c8;
  --cm-active-bg: rgba(94, 97, 216, 0.18);
  --cm-active-bg-soft: rgba(94, 97, 216, 0.08);
  --cm-shadow: rgba(94, 97, 216, 0.26);
  --cm-shadow-strong: rgba(94, 97, 216, 0.36);
}

.nav-item--smart-bracket,
.nav-item--overlay-links,
.nav-item--reviews {
  --cm-icon-start: #b57cff;
  --cm-icon-end: #8654d6;
  --cm-accent: #7447c6;
  --cm-active-bg: rgba(134, 84, 214, 0.18);
  --cm-active-bg-soft: rgba(134, 84, 214, 0.07);
  --cm-shadow: rgba(134, 84, 214, 0.26);
  --cm-shadow-strong: rgba(134, 84, 214, 0.35);
}

.nav-item--leaderboard {
  --cm-icon-start: #ffd56d;
  --cm-icon-end: #e2a73a;
  --cm-accent: #c78922;
  --cm-active-bg: rgba(226, 167, 58, 0.2);
  --cm-active-bg-soft: rgba(226, 167, 58, 0.08);
  --cm-shadow: rgba(226, 167, 58, 0.3);
  --cm-shadow-strong: rgba(226, 167, 58, 0.39);
}

.nav-item--categories {
  --cm-icon-start: #ff9bc7;
  --cm-icon-end: #e26ca2;
  --cm-accent: #ca4b87;
  --cm-active-bg: rgba(226, 108, 162, 0.2);
  --cm-active-bg-soft: rgba(226, 108, 162, 0.08);
  --cm-shadow: rgba(226, 108, 162, 0.29);
  --cm-shadow-strong: rgba(226, 108, 162, 0.38);
}

.nav-item--organization {
  --cm-icon-start: #60b4ff;
  --cm-icon-end: #1d7ed8;
  --cm-accent: #1566b8;
  --cm-active-bg: rgba(29, 126, 216, 0.18);
  --cm-active-bg-soft: rgba(29, 126, 216, 0.07);
  --cm-shadow: rgba(29, 126, 216, 0.26);
  --cm-shadow-strong: rgba(29, 126, 216, 0.35);
}

.nav-item--players {
  --cm-icon-start: #4ade80;
  --cm-icon-end: #16a34a;
  --cm-accent: #15803d;
  --cm-active-bg: rgba(22, 163, 74, 0.18);
  --cm-active-bg-soft: rgba(22, 163, 74, 0.07);
  --cm-shadow: rgba(22, 163, 74, 0.26);
  --cm-shadow-strong: rgba(22, 163, 74, 0.35);
}

.nav-item--settings {
  --cm-icon-start: #a2b0c8;
  --cm-icon-end: #708099;
  --cm-accent: #5c6f89;
  --cm-active-bg: rgba(112, 128, 153, 0.2);
  --cm-active-bg-soft: rgba(112, 128, 153, 0.08);
  --cm-shadow: rgba(112, 128, 153, 0.27);
  --cm-shadow-strong: rgba(112, 128, 153, 0.36);
}

.nav-item--logout {
  --cm-icon-start: #ff8a8a;
  --cm-icon-end: #de4f4f;
  --cm-accent: #c53939;
  --cm-active-bg: rgba(222, 79, 79, 0.2);
  --cm-active-bg-soft: rgba(222, 79, 79, 0.08);
  --cm-shadow: rgba(222, 79, 79, 0.3);
  --cm-shadow-strong: rgba(222, 79, 79, 0.39);
}

// Super Admin identity badge
.super-admin-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 16px 6px;
  background: rgba(168, 85, 247, 0.08);
  border-bottom: 1px solid rgba(168, 85, 247, 0.15);

  &__label {
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    color: #a855f7;
  }

  &--rail {
    justify-content: center;
    padding: 6px 0;
  }
}

.nav-item--super-admin {
  --cm-icon-start: #c084fc;
  --cm-icon-end: #9333ea;
  --cm-accent: #7e22ce;
  --cm-active-bg: rgba(147, 51, 234, 0.18);
  --cm-active-bg-soft: rgba(147, 51, 234, 0.07);
  --cm-shadow: rgba(147, 51, 234, 0.26);
  --cm-shadow-strong: rgba(147, 51, 234, 0.36);
}

.nav-item--super-orgs {
  --cm-icon-start: #d8b4fe;
  --cm-icon-end: #a855f7;
  --cm-accent: #9333ea;
  --cm-active-bg: rgba(168, 85, 247, 0.18);
  --cm-active-bg-soft: rgba(168, 85, 247, 0.07);
  --cm-shadow: rgba(168, 85, 247, 0.26);
  --cm-shadow-strong: rgba(168, 85, 247, 0.36);
}

// Collapsible section headers
.nav-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 12px 2px 16px;
  cursor: pointer;
  user-select: none;
  border-radius: 6px;
  transition: background 120ms ease;

  &:hover {
    background: rgba(0, 0, 0, 0.04);
  }
}

.nav-section-label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.6px;
  text-transform: uppercase;
  color: rgba(0, 0, 0, 0.45);
}

.nav-section-arrow {
  opacity: 0.4;
  transition: transform 160ms ease-out;

  &--collapsed {
    transform: rotate(-90deg);
  }
}
</style>
