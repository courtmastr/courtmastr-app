# Apple-Inspired UI Redesign Plan for CourtMaster

## Executive Summary

This document outlines a comprehensive plan to redesign the CourtMaster application with Apple-inspired design principles. The objective is to transform the current Material Design interface into a clean, minimalist, and intuitive experience that follows Apple's Human Interface Guidelines while preserving all existing functionality.

## Current State Analysis

### Technology Stack
- **Frontend**: Vue 3 + TypeScript + Vite
- **UI Framework**: Vuetify 3 (Material Design)
- **State Management**: Pinia stores
- **Backend**: Firebase (Firestore, Auth, Cloud Functions)
- **PWA**: Vite PWA Plugin

### Current Design Characteristics
- Material Design aesthetic with shadows and elevation
- Dense information architecture
- Functional but utilitarian interface
- Limited visual hierarchy in some areas
- Mobile-responsive but not optimized for touch-first experience

### Apple Design Philosophy Application

#### Core Principles to Implement

1. **Clarity**
   - Clean typography with appropriate weights and sizes
   - Ample whitespace to reduce cognitive load
   - Clear visual hierarchy through typography and spacing

2. **Deference**
   - Focus on content rather than chrome
   - Subtle, refined UI elements that don't compete with content
   - Meaningful transitions and animations

3. **Depth**
   - Subtle shadows and layers for depth perception
   - Meaningful transitions that provide context
   - Clear information architecture

#### Liquid Glass Design Language Implementation

Based on Apple's 2026 "Liquid Glass" design system, the implementation should include:

**Visual Elements:**
- Translucent backgrounds with backdrop filters
- Subtle refraction effects using SVG filters
- Organic, flowing transitions between states
- Vibrant, adaptive color palettes that interact with background content

**CSS Implementation:**
```css
.apple-glass-card {
  background: rgba(255, 255, 255, 0.4);
  backdrop-filter: blur(20px) saturate(180%);
  border: 1.5px solid rgba(255, 255, 255, 0.3);
  box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.37);
}
```

**Z-Index Layering Strategy:**
- Level 0: Background with dynamic content
- Level 1: Secondary UI with light blur (sidebars, background cards)
- Level 2: Primary UI with medium blur (modals, main content)
- Level 3: Floating elements with strong shadows (tooltips, notifications)

## Apple Design Philosophy Application

### Core Principles to Implement

1. **Clarity**
   - Clean typography with appropriate weights and sizes
   - Ample whitespace to reduce cognitive load
   - Clear visual hierarchy through typography and spacing

2. **Deference**
   - Focus on content rather than chrome
   - Subtle, refined UI elements that don't compete with content
   - Meaningful transitions and animations

3. **Depth**
   - Subtle shadows and layers for depth perception
   - Meaningful transitions that provide context
   - Clear information architecture

## Phase 1: Foundation & Typography

### 1.1 Typography System
**Current State**: Standard Material Design typography
**Target State**: Apple-inspired typography with refined hierarchy

```scss
// Apple-inspired typography system with Liquid Glass support
:root {
  --font-family-system: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  
  // Headings with optical sizing
  --heading-xl-size: 34px;
  --heading-xl-weight: 600;
  --heading-xl-tracking: -0.01em;
  --heading-l-size: 28px;
  --heading-l-weight: 600;
  --heading-l-tracking: -0.005em;
  --heading-m-size: 22px;
  --heading-m-weight: 600;
  --heading-s-size: 17px;
  --heading-s-weight: 600;
  
  // Body text with minimum legibility (11pt ~ 15px)
  --body-l-size: 17px;
  --body-l-weight: 400;
  --body-l-tracking: -0.003em;
  --body-m-size: 15px;  // Meets minimum 11pt requirement (~15px)
  --body-m-weight: 400;
  --body-s-size: 13px;
  --body-s-weight: 400;
  
  // Captions
  --caption-size: 12px;
  --caption-weight: 400;
  
  // SF Pro Optical Sizing
  --font-optical-sizing: auto;
  --font-variation-wght: 510;  // High contrast weight for accessibility
}

// Typography classes with Liquid Glass support
.display-title {
  font-family: var(--font-family-system);
  font-size: var(--heading-xl-size);
  font-weight: var(--heading-xl-weight);
  letter-spacing: var(--heading-xl-tracking);
  font-optical-sizing: var(--font-optical-sizing);
  font-variation-settings: 'wght' var(--font-variation-wght);
  -webkit-font-smoothing: antialiased;
}

.body-text {
  font-family: var(--font-family-system);
  font-size: var(--body-m-size);
  font-weight: var(--body-m-weight);
  font-optical-sizing: var(--font-optical-sizing);
  -webkit-font-smoothing: antialiased;
}
```

### 1.2 Color Palette Transformation
**Current State**: Material Design color system
**Target State**: Apple-inspired adaptive color system with Liquid Glass support

```scss
:root {
  // Primary Colors (adaptive for light/dark mode)
  --system-blue: #007AFF;
  --system-blue-dark: #0A84FF;  // Brighter for dark mode
  --system-green: #34C759;
  --system-indigo: #5856D6;
  --system-orange: #FF9500;
  --system-red: #FF3B30;
  --system-teal: #5AC8FA;
  
  // Background Colors (with Liquid Glass support)
  --system-background: #FFFFFF;
  --system-secondary-background: #F2F2F7;
  --system-tertiary-background: #EBEBF0;
  --system-transparent-bg: rgba(255, 255, 255, 0.7);  // For glassmorphism
  
  // Foreground Colors (semantic labels)
  --label-primary: #000000;
  --label-secondary: #3C3C4399;
  --label-tertiary: #3C3C434C;
  --label-quaternary: #3C3C432C;
  
  // Fill Colors (adaptive for vibrancy)
  --system-fill: #3C3C431F;
  --system-secondary-fill: #3C3C430F;
  --system-tertiary-fill: #3C3C4308;
  --system-quaternary-fill: #3C3C4305;
  
  // WebKit System Colors (for native consistency on Apple devices)
  --webkit-accent-color: -webkit-link;
  --webkit-label-color: -webkit-text;
  --webkit-secondary-label: -webkit-secondary-text;
  --webkit-tertiary-label: -webkit-tertiary-text;
  --webkit-quaternary-label: -webkit-quaternary-text;
  --webkit-system-background: -webkit-background;
  --webkit-secondary-system-background: -webkit-alternating-row-color;
  --webkit-tertiary-system-background: -webkit-control-background;
  --webkit-system-fill: -webkit-find-highlight;
  --webkit-secondary-system-fill: -webkit-attention-pane-background;
  --webkit-tertiary-system-fill: -webkit-sliderthumb;
  --webkit-quaternary-system-fill: -webkit-menu-item-text;
}

// Dark mode adaptations
@media (prefers-color-scheme: dark) {
  :root {
    --system-background: #000000;
    --system-secondary-background: #1C1C1E;
    --system-tertiary-background: #2C2C2E;
    --system-transparent-bg: rgba(28, 28, 30, 0.7);
    
    --label-primary: #FFFFFF;
    --label-secondary: #EBEBF0CC;
    --label-tertiary: #EBEBF066;
    --label-quaternary: #EBEBF02E;
    
    --system-blue: #0A84FF;
    --system-green: #30D158;
  }
}

// Semantic color classes
.primary-text { color: var(--label-primary); }
.secondary-text { color: var(--label-secondary); }
.tertiary-text { color: var(--label-tertiary); }
.quaternary-text { color: var(--label-quaternary); }

.background { background-color: var(--system-background); }
.secondary-background { background-color: var(--system-secondary-background); }
.tertiary-background { background-color: var(--system-tertiary-background); }

.system-fill { background-color: var(--system-fill); }
.secondary-system-fill { background-color: var(--system-secondary-fill); }
.tertiary-system-fill { background-color: var(--system-tertiary-fill); }
.quaternary-system-fill { background-color: var(--system-quaternary-fill); }
```

### 1.3 Spacing System
**Current State**: Material Design 4dp grid
**Target State**: Apple-inspired flexible spacing with rhythm and balance

```scss
:root {
  // Base spacing unit (Apple typically uses 4px as base)
  --base-unit: 4px;
  
  // Spacing scale with rhythmic relationships
  --spacing-xs: calc(var(--base-unit) * 1);      // 4px - Fine adjustments
  --spacing-sm: calc(var(--base-unit) * 2);      // 8px - Tight grouping
  --spacing-md: calc(var(--base-unit) * 3);      // 12px - Default spacing
  --spacing-lg: calc(var(--base-unit) * 4);      // 16px - Section separation
  --spacing-xl: calc(var(--base-unit) * 6);      // 24px - Major divisions
  --spacing-xxl: calc(var(--base-unit) * 8);     // 32px - Large sections
  --spacing-xxxl: calc(var(--base-unit) * 12);   // 48px - Major page sections
  
  // Container spacing
  --container-padding: var(--spacing-lg);
  --container-padding-mobile: var(--spacing-md);
  
  // Hit target spacing (minimum 44x44 points for touch)
  --hit-target-min: 44px;  // Minimum touch target size
  --hit-target-buffer: calc(var(--base-unit) * 3);  // Buffer around touch targets
}

// Spacing utility classes
.padding-xs { padding: var(--spacing-xs); }
.padding-sm { padding: var(--spacing-sm); }
.padding-md { padding: var(--spacing-md); }
.padding-lg { padding: var(--spacing-lg); }
.padding-xl { padding: var(--spacing-xl); }

.margin-xs { margin: var(--spacing-xs); }
.margin-sm { margin: var(--spacing-sm); }
.margin-md { margin: var(--spacing-md); }
.margin-lg { margin: var(--spacing-lg); }
.margin-xl { margin: var(--spacing-xl); }

// Responsive spacing
@media (max-width: 768px) {
  :root {
    --container-padding: var(--spacing-md);
  }
}

// Hit target compliance for touch interfaces
.touch-target {
  min-width: var(--hit-target-min);
  min-height: var(--hit-target-min);
}
```

## Phase 2: Navigation & Information Architecture

### 2.1 Navigation Redesign
**Current State**: Material Design drawer with icons and text
**Target State**: Apple-inspired navigation with refined aesthetics

#### App Navigation Component Enhancement
File: `src/components/navigation/AppNavigation.vue`

```vue
<template>
  <v-navigation-drawer 
    v-model="drawer" 
    :rail="rail"
    class="apple-navigation-drawer"
    :width="rail ? 60 : 280"
    :floating="true"
    :border="false"
  >
    <!-- User Profile Section -->
    <div class="user-profile-section px-4 pt-4 pb-2">
      <v-avatar 
        :size="rail ? 36 : 44" 
        class="user-avatar"
        :class="{ 'avatar-rail': rail }"
      >
        <span class="text-body-1 font-weight-medium">{{ currentUser?.displayName?.charAt(0) || 'U' }}</span>
      </v-avatar>
      
      <div v-if="!rail" class="user-info pl-3">
        <div class="username font-weight-medium text-body-2">{{ currentUser?.displayName || 'User' }}</div>
        <div class="user-email text-caption text--secondary">{{ currentUser?.email }}</div>
      </div>
    </div>

    <v-divider class="my-2" :thickness="0.5" />

    <!-- Navigation Groups -->
    <div v-for="group in navigationGroups" :key="group.title" class="nav-group px-2 py-1">
      <div 
        v-if="!rail" 
        class="group-title text-caption font-weight-medium text-uppercase px-4 py-2"
        :class="{ 'hidden': rail }"
      >
        {{ group.title }}
      </div>
      
      <v-list 
        nav 
        density="compact" 
        class="nav-items-list"
        :class="{ 'list-rail': rail }"
      >
        <v-list-item
          v-for="item in group.items"
          :key="item.title"
          :to="item.to"
          :prepend-icon="item.icon"
          :title="rail ? '' : item.title"
          class="nav-item"
          rounded="lg"
          :active="isActive(item.to)"
        >
          <template #prepend>
            <v-icon 
              :icon="item.icon" 
              :size="rail ? 24 : 22"
              :class="{ 'icon-active': isActive(item.to) }"
            />
          </template>
          
          <v-list-item-title 
            v-if="!rail"
            class="nav-item-title"
          >
            {{ item.title }}
          </v-list-item-title>
        </v-list-item>
      </v-list>
    </div>

    <template #append>
      <div class="app-controls px-2 pb-2">
        <v-list nav density="compact" class="control-list">
          <v-list-item
            prepend-icon="mdi-brightness-6"
            title="Appearance"
            class="nav-item"
            rounded="lg"
          />
          <v-list-item
            prepend-icon="mdi-cog"
            title="Settings"
            class="nav-item"
            rounded="lg"
          />
          <v-list-item
            prepend-icon="mdi-help-circle-outline"
            title="Help"
            class="nav-item"
            rounded="lg"
          />
        </v-list>
      </div>
    </template>
  </v-navigation-drawer>
</template>

<style scoped>
.apple-navigation-drawer {
  background-color: rgba(242, 242, 247, 0.7);
  backdrop-filter: blur(20px);
  border-right: 0.5px solid rgba(60, 60, 67, 0.18);
}

.user-profile-section {
  display: flex;
  align-items: center;
  min-height: 64px;
}

.user-info {
  flex: 1;
  overflow: hidden;
}

.username {
  color: var(--label-primary);
  line-height: 1.2;
}

.user-email {
  color: var(--label-secondary);
  font-size: 0.75rem;
  line-height: 1.2;
}

.nav-group {
  margin-bottom: var(--spacing-md);
}

.group-title {
  color: var(--label-tertiary);
  letter-spacing: 0.04em;
  margin-bottom: var(--spacing-sm);
}

.nav-item {
  margin: var(--spacing-xs) 0;
  border-radius: 10px;
  transition: all 0.2s ease;
}

.nav-item:hover {
  background-color: var(--system-secondary-fill);
}

.nav-item--active {
  background-color: var(--system-blue);
  color: white;
}

.nav-item-title {
  font-size: 0.875rem;
  font-weight: 450;
}

.icon-active {
  color: var(--system-blue);
}

.app-controls {
  border-top: 0.5px solid rgba(60, 60, 67, 0.18);
  padding-top: var(--spacing-md);
}
</style>
```

### 2.2 Breadcrumb Navigation Enhancement
File: `src/components/navigation/BreadcrumbNavigation.vue`

```vue
<template>
  <div class="apple-breadcrumbs-container px-6 py-4">
    <v-breadcrumbs 
      :items="breadcrumbItems" 
      divider="›"
      class="apple-breadcrumbs"
    >
      <template #item="{ item }">
        <v-breadcrumbs-item
          :to="item.to"
          :disabled="!item.to"
          exact
          class="breadcrumb-item"
        >
          {{ item.title }}
        </v-breadcrumbs-item>
      </template>
    </v-breadcrumbs>
  </div>
</template>

<style scoped>
.apple-breadcrumbs-container {
  background: var(--system-secondary-background);
  border-bottom: 0.5px solid var(--system-tertiary-fill);
}

.apple-breadcrumbs {
  padding: 0;
}

.breadcrumb-item {
  font-size: 0.875rem;
  color: var(--label-secondary);
}

.breadcrumb-item:hover {
  color: var(--system-blue);
}

.breadcrumb-item--disabled {
  color: var(--label-tertiary);
}
</style>
```

## Phase 3: Dashboard & Main Interface

### 3.1 Dashboard Redesign
**Current State**: Dense information display
**Target State**: Clean, card-based layout with Apple-inspired aesthetics

#### Dashboard Component Enhancement
File: `src/features/tournaments/views/TournamentDashboardView.vue`

```vue
<template>
  <div class="apple-dashboard">
    <!-- Welcome Banner -->
    <div class="welcome-banner mb-6">
      <div class="banner-content">
        <h1 class="display-title font-weight-bold">Welcome back</h1>
        <p class="subtitle-text text--secondary">Here's what's happening with your tournaments today.</p>
      </div>
    </div>

    <!-- Stats Overview -->
    <div class="stats-grid mb-6">
      <v-card 
        v-for="stat in stats" 
        :key="stat.title"
        class="stat-card"
        variant="flat"
        :border="true"
      >
        <div class="stat-content pa-4">
          <div class="stat-icon mb-2">
            <v-icon :icon="stat.icon" :color="stat.color" size="28" />
          </div>
          <div class="stat-info">
            <div class="stat-value text-h4 font-weight-bold">{{ stat.value }}</div>
            <div class="stat-title text-subtitle-2 text--secondary">{{ stat.title }}</div>
          </div>
        </div>
      </v-card>
    </div>

    <!-- Tournament List -->
    <div class="tournaments-section">
      <div class="section-header d-flex align-center justify-space-between mb-4">
        <h2 class="text-h6 font-weight-medium">Your Tournaments</h2>
        <v-btn 
          to="/tournaments/create" 
          variant="text" 
          color="primary"
          class="create-btn"
        >
          <v-icon start>mdi-plus</v-icon>
          New Tournament
        </v-btn>
      </div>

      <v-data-table
        :headers="tableHeaders"
        :items="tournaments"
        class="tournaments-table"
        :items-per-page="5"
        hide-default-footer
      >
        <template #[`item.name`]="{ item }">
          <div class="tournament-name">
            <div class="font-weight-medium">{{ item.name }}</div>
            <div class="text-caption text--secondary">{{ item.location }}</div>
          </div>
        </template>

        <template #[`item.status`]="{ item }">
          <v-chip 
            :color="getStatusColor(item.status)" 
            size="small"
            :variant="getStatusVariant(item.status)"
          >
            {{ item.status }}
          </v-chip>
        </template>

        <template #[`item.dates`]="{ item }">
          <div class="dates-cell">
            <div>{{ formatDate(item.startDate) }}</div>
            <div class="text-caption text--secondary">to {{ formatDate(item.endDate) }}</div>
          </div>
        </template>

        <template #[`item.actions`]="{ item }">
          <v-btn
            :to="`/tournaments/${item.id}/dashboard`"
            size="small"
            variant="text"
            color="primary"
          >
            View
          </v-btn>
        </template>
      </v-data-table>
    </div>
  </div>
</template>

<style scoped>
.apple-dashboard {
  padding: 0 var(--spacing-xl);
}

.welcome-banner {
  padding: var(--spacing-xxl) 0;
}

.banner-content .display-title {
  font-size: 2.5rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--label-primary);
  margin-bottom: var(--spacing-xs);
}

.subtitle-text {
  font-size: 1.125rem;
  color: var(--label-secondary);
  max-width: 500px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: var(--spacing-lg);
}

.stat-card {
  border-radius: 14px;
  border: 0.5px solid var(--system-secondary-fill);
  background: var(--system-background);
  transition: all 0.2s ease;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08);
}

.stat-content {
  display: flex;
  align-items: center;
}

.stat-icon {
  margin-right: var(--spacing-md);
}

.stat-info {
  flex: 1;
}

.stat-value {
  color: var(--label-primary);
}

.stat-title {
  color: var(--label-secondary);
}

.section-header {
  padding-top: var(--spacing-xl);
  padding-bottom: var(--spacing-md);
}

.tournaments-table {
  border-radius: 14px;
  border: 0.5px solid var(--system-secondary-fill);
}

.tournament-name {
  min-width: 200px;
}

.dates-cell {
  min-width: 140px;
}
</style>
```

## Phase 4: Match Control Interface

### 4.1 Match Control Redesign
**Current State**: Dense tabbed interface with multiple sections
**Target State**: Clean, focused interface with Apple-inspired design

#### Match Control Component Enhancement
File: `src/features/tournaments/views/MatchControlView.vue`

```vue
<template>
  <div class="apple-match-control">
    <!-- Tournament Header -->
    <div class="tournament-header mb-6">
      <h1 class="header-title font-weight-bold">{{ tournament.name }}</h1>
      <v-chip 
        :color="getStatusColor(tournament.status)" 
        size="default"
        :variant="getStatusVariant(tournament.status)"
      >
        {{ tournament.status }}
      </v-chip>
    </div>

    <!-- Quick Stats Bar -->
    <div class="quick-stats-bar mb-6">
      <div class="stat-item">
        <v-icon color="primary" size="20">mdi-account-group</v-icon>
        <span class="stat-value">{{ stats.participants }} participants</span>
      </div>
      <div class="stat-item">
        <v-icon color="success" size="20">mdi-timer-sand-complete</v-icon>
        <span class="stat-value">{{ stats.completed }} completed</span>
      </div>
      <div class="stat-item">
        <v-icon color="warning" size="20">mdi-play</v-icon>
        <span class="stat-value">{{ stats.inProgress }} in progress</span>
      </div>
      <div class="stat-item">
        <v-icon color="info" size="20">mdi-map-marker-plus</v-icon>
        <span class="stat-value">{{ stats.availableCourts }} courts</span>
      </div>
    </div>

    <!-- Main Content Tabs -->
    <v-tabs 
      v-model="tab" 
      bg-color="transparent" 
      class="match-control-tabs"
    >
      <v-tab value="queue">Queue</v-tab>
      <v-tab value="courts">Courts</v-tab>
      <v-tab value="schedule">Schedule</v-tab>
    </v-tabs>

    <v-window v-model="tab" class="tab-content">
      <!-- Queue Tab -->
      <v-window-item value="queue">
        <div class="queue-section">
          <div class="section-header mb-4">
            <h2 class="text-h6 font-weight-medium">Match Queue</h2>
            <v-btn 
              variant="outlined" 
              size="small"
              @click="openAutoScheduleDialog"
            >
              Auto Schedule
            </v-btn>
          </div>
          
          <!-- Priority Queue -->
          <div class="priority-section mb-6">
            <h3 class="priority-title text-subtitle-2 font-weight-medium mb-3">
              <v-icon start size="16" color="warning">mdi-alert-circle</v-icon>
              Urgent Matches
            </h3>
            <v-list class="priority-list">
              <v-list-item
                v-for="match in urgentMatches"
                :key="match.id"
                class="priority-item"
                border
                rounded="lg"
              >
                <div class="match-info">
                  <div class="match-participants font-weight-medium">
                    {{ match.participants }}
                  </div>
                  <div class="match-category text-caption text--secondary">
                    {{ match.category }} • {{ match.timeRemaining }}
                  </div>
                </div>
                <template #append>
                  <v-btn 
                    color="primary" 
                    size="small"
                    @click="assignCourt(match.id)"
                  >
                    Assign Court
                  </v-btn>
                </template>
              </v-list-item>
            </v-list>
          </div>

          <!-- Regular Queue -->
          <div class="regular-queue">
            <h3 class="queue-title text-subtitle-2 font-weight-medium mb-3">
              Regular Queue
            </h3>
            <v-list class="queue-list">
              <v-list-item
                v-for="match in regularQueue"
                :key="match.id"
                class="queue-item"
                border
                rounded="lg"
              >
                <div class="match-info">
                  <div class="match-participants">
                    {{ match.participants }}
                  </div>
                  <div class="match-category text-caption text--secondary">
                    {{ match.category }}
                  </div>
                </div>
                <template #append>
                  <v-btn 
                    variant="text"
                    size="small"
                    @click="scheduleMatch(match.id)"
                  >
                    Schedule
                  </v-btn>
                </template>
              </v-list-item>
            </v-list>
          </div>
        </div>
      </v-window-item>

      <!-- Courts Tab -->
      <v-window-item value="courts">
        <div class="courts-section">
          <div class="section-header mb-4">
            <h2 class="text-h6 font-weight-medium">Court Status</h2>
            <v-btn 
              variant="outlined" 
              size="small"
              @click="refreshCourts"
            >
              Refresh
            </v-btn>
          </div>
          
          <div class="courts-grid">
            <v-card
              v-for="court in courts"
              :key="court.id"
              class="court-card"
              :border="true"
              :variant="court.status === 'available' ? 'tonal' : 'flat'"
            >
              <v-card-title class="court-title d-flex align-center">
                <v-icon 
                  :color="getCourtStatusColor(court.status)"
                  size="20"
                  class="mr-2"
                >
                  {{ getCourtStatusIcon(court.status) }}
                </v-icon>
                <span class="font-weight-medium">{{ court.name }}</span>
              </v-card-title>
              
              <v-card-text v-if="court.currentMatch" class="court-match">
                <div class="match-participants font-weight-medium">
                  {{ court.currentMatch.participants }}
                </div>
                <div class="match-score text-h6 font-weight-bold">
                  {{ court.currentMatch.score }}
                </div>
                <div class="match-time text-caption text--secondary">
                  Started {{ court.currentMatch.duration }} ago
                </div>
              </v-card-text>
              
              <v-card-text v-else class="court-empty">
                <div class="empty-state text-center py-6">
                  <v-icon size="40" color="disabled">mdi-stadium</v-icon>
                  <div class="mt-2">No active match</div>
                </div>
              </v-card-text>
              
              <v-card-actions>
                <v-btn 
                  v-if="court.status === 'available'"
                  color="primary"
                  variant="tonal"
                  block
                  @click="assignMatchToCourt(court.id)"
                >
                  Assign Match
                </v-btn>
                <v-btn 
                  v-else-if="court.status === 'in_use'"
                  color="warning"
                  variant="outlined"
                  block
                  @click="endMatch(court.id)"
                >
                  End Match
                </v-btn>
                <v-btn 
                  v-else
                  color="info"
                  variant="outlined"
                  block
                  @click="setCourtAvailable(court.id)"
                >
                  Make Available
                </v-btn>
              </v-card-actions>
            </v-card>
          </div>
        </div>
      </v-window-item>

      <!-- Schedule Tab -->
      <v-window-item value="schedule">
        <div class="schedule-section">
          <div class="section-header mb-4">
            <h2 class="text-h6 font-weight-medium">Schedule</h2>
            <v-btn 
              variant="outlined" 
              size="small"
              @click="exportSchedule"
            >
              Export
            </v-btn>
          </div>
          
          <v-data-table
            :headers="scheduleHeaders"
            :items="schedule"
            class="schedule-table"
            :items-per-page="10"
          >
            <template #[`item.time`]="{ item }">
              <div class="time-cell">
                <div class="font-weight-medium">{{ item.time }}</div>
                <div class="text-caption text--secondary">{{ item.duration }}</div>
              </div>
            </template>

            <template #[`item.court`]="{ item }">
              <v-chip 
                size="small"
                variant="outlined"
              >
                {{ item.court }}
              </v-chip>
            </template>

            <template #[`item.match`]="{ item }">
              <div class="match-cell">
                <div class="font-weight-medium">{{ item.participants }}</div>
                <div class="text-caption text--secondary">{{ item.category }}</div>
              </div>
            </template>

            <template #[`item.actions`]="{ item }">
              <v-btn
                size="small"
                variant="text"
                color="primary"
                @click="editScheduleItem(item.id)"
              >
                Edit
              </v-btn>
            </template>
          </v-data-table>
        </div>
      </v-window-item>
    </v-window>
  </div>
</template>

<style scoped>
.apple-match-control {
  padding: 0 var(--spacing-xl);
}

.tournament-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-xl) 0;
}

.header-title {
  font-size: 1.875rem;
  font-weight: 700;
  color: var(--label-primary);
  margin-right: var(--spacing-md);
}

.quick-stats-bar {
  display: flex;
  gap: var(--spacing-xl);
  padding: var(--spacing-lg) var(--spacing-xl);
  background: var(--system-secondary-background);
  border-radius: 14px;
  border: 0.5px solid var(--system-secondary-fill);
}

.stat-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  color: var(--label-secondary);
}

.stat-value {
  font-weight: 500;
}

.match-control-tabs {
  border-bottom: 0.5px solid var(--system-secondary-fill);
}

.tab-content {
  margin-top: var(--spacing-lg);
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.priority-section, .regular-queue {
  margin-bottom: var(--spacing-xl);
}

.priority-title, .queue-title {
  color: var(--label-secondary);
  display: flex;
  align-items: center;
}

.priority-item, .queue-item {
  margin-bottom: var(--spacing-sm);
  background: var(--system-background);
  border: 0.5px solid var(--system-secondary-fill);
}

.match-info {
  flex: 1;
}

.match-participants {
  color: var(--label-primary);
}

.match-category {
  color: var(--label-secondary);
}

.courts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: var(--spacing-lg);
}

.court-card {
  border-radius: 14px;
  border: 0.5px solid var(--system-secondary-fill);
  transition: all 0.2s ease;
}

.court-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08);
}

.court-title {
  border-bottom: 0.5px solid var(--system-secondary-fill);
}

.court-match, .court-empty {
  padding: var(--spacing-lg);
}

.match-score {
  color: var(--label-primary);
}

.empty-state {
  color: var(--label-tertiary);
}

.schedule-table {
  border-radius: 14px;
  border: 0.5px solid var(--system-secondary-fill);
}

.time-cell, .match-cell {
  min-width: 150px;
}
</style>
```

## Phase 5: Form and Input Enhancements

### 5.1 Form Design
**Current State**: Standard Material Design inputs
**Target State**: Apple-inspired form elements with refined aesthetics

#### Form Components Enhancement
File: `src/components/forms/AppleFormFields.vue`

```vue
<template>
  <div class="apple-form-fields">
    <v-text-field
      v-model="model"
      class="apple-text-field"
      :label="label"
      :placeholder="placeholder"
      :variant="variant"
      :density="density"
      :hide-details="hideDetails"
      :messages="messages"
      :error-messages="errorMessages"
    >
      <template v-for="(_, slot) in $slots" #[slot]="slotProps">
        <slot :name="slot" v-bind="slotProps" />
      </template>
    </v-text-field>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

interface Props {
  modelValue?: string;
  label?: string;
  placeholder?: string;
  variant?: 'underlined' | 'outlined' | 'filled' | 'plain' | 'solo';
  density?: 'default' | 'comfortable' | 'compact';
  hideDetails?: boolean;
  messages?: string | string[];
  errorMessages?: string | string[];
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'underlined',
  density: 'comfortable',
});

const model = ref(props.modelValue);
</script>

<style scoped>
.apple-text-field :deep(.v-field) {
  border-radius: 10px;
  border: 0.5px solid var(--system-secondary-fill);
  background: var(--system-background);
  transition: all 0.2s ease;
}

.apple-text-field :deep(.v-field--focused) {
  border-color: var(--system-blue);
  box-shadow: 0 0 0 2px rgba(0, 122, 255, 0.2);
}

.apple-text-field :deep(.v-field__input) {
  padding: 12px 16px;
  font-size: 15px;
  color: var(--label-primary);
}

.apple-text-field :deep(.v-field__outline) {
  display: none;
}
</style>
```

## Phase 6: Mobile Optimization

### 6.1 Mobile-First Design
**Current State**: Desktop-first responsive design
**Target State**: Touch-optimized interface with Apple-inspired mobile patterns

#### Mobile Navigation Enhancement
File: `src/components/navigation/MobileNavigation.vue`

```vue
<template>
  <v-bottom-navigation
    v-if="isMobile"
    v-model="activeTab"
    class="apple-mobile-nav"
    grow
    :elevation="20"
  >
    <v-btn value="home">
      <v-icon>mdi-home</v-icon>
      Home
    </v-btn>
    
    <v-btn value="tournaments">
      <v-icon>mdi-trophy</v-icon>
      Tournaments
    </v-btn>
    
    <v-btn value="matches">
      <v-icon>mdi-tennis</v-icon>
      Matches
    </v-btn>
    
    <v-btn value="profile">
      <v-icon>mdi-account</v-icon>
      Profile
    </v-btn>
  </v-bottom-navigation>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const activeTab = defineModel('activeTab', { type: String, default: 'home' });

const isMobile = computed(() => {
  return window.innerWidth < 768;
});
</script>

<style scoped>
.apple-mobile-nav {
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(20px);
  border-top: 0.5px solid var(--system-secondary-fill);
}
</style>
```

## Phase 7: Animation and Interaction Enhancements

### 7.1 Micro-Interactions
**Current State**: Basic Material Design transitions
**Target State**: Refined Apple-inspired animations and interactions with spring physics

#### Enhanced Button Component with Spring Motion
File: `src/components/buttons/AppleButton.vue`

```vue
<template>
  <v-btn
    :variant="variant"
    :color="color"
    :size="size"
    :rounded="rounded"
    :elevation="elevation"
    :class="['apple-button', { 'button-hover': hover, 'button-active': active }]"
    :style="{ 
      '--spring-scale': hoverScale,
      '--active-scale': activeScale
    }"
    @mouseenter="hover = true"
    @mouseleave="hover = false"
    @mousedown="active = true"
    @mouseup="active = false"
    @touchstart="active = true"
    @touchend="active = false"
    @focus="focused = true"
    @blur="focused = false"
  >
    <slot />
  </v-btn>
</template>

<script setup lang="ts">
import { ref } from 'vue';

interface Props {
  variant?: 'text' | 'flat' | 'outlined' | 'elevated' | 'tonal' | 'contained';
  color?: string;
  size?: 'x-small' | 'small' | 'default' | 'large' | 'x-large';
  rounded?: boolean | string;
  elevation?: number;
}

withDefaults(defineProps<Props>(), {
  variant: 'elevated',
  color: 'primary',
  size: 'default',
  rounded: 'lg',
  elevation: 2,
});

const hover = ref(false);
const active = ref(false);
const focused = ref(false);
const hoverScale = 1.03;
const activeScale = 0.95;
</script>

<style scoped>
.apple-button {
  transition: all 0.45s cubic-bezier(0.175, 0.885, 0.32, 1.275); /* Apple spring curve */
  position: relative;
  overflow: hidden;
  border-radius: 10px;
  backdrop-filter: blur(20px);
  background: rgba(255, 255, 255, 0.4);
  border: 0.5px solid rgba(255, 255, 255, 0.3);
}

.button-hover {
  transform: scale(var(--spring-scale));
}

.button-active {
  transform: scale(var(--active-scale));
}

.apple-button::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: radial-gradient(circle, rgba(0, 122, 255, 0.1) 0%, transparent 70%);
  opacity: 0;
  transition: opacity 0.2s ease;
  pointer-events: none;
}

.apple-button:hover::before {
  opacity: 1;
}

/* Haptic feedback simulation for supported browsers */
.apple-button:active {
  /* Simulate haptic feedback with vibration API */
  /* This would be implemented in JavaScript */
}
</style>
```

#### Apple-Style Card Component with Depth and Transparency
File: `src/components/cards/AppleCard.vue`

```vue
<template>
  <v-card
    :class="['apple-card', { 'card-expanded': expanded }]"
    :style="{
      '--card-blur': blurAmount,
      '--card-opacity': cardOpacity,
      '--card-scale': cardScale
    }"
    :variant="variant"
    :elevation="0"
  >
    <v-card-title v-if="$slots.title || title" class="card-title">
      <slot name="title">{{ title }}</slot>
    </v-card-title>
    
    <v-card-text class="card-content">
      <slot />
    </v-card-text>
    
    <v-card-actions v-if="$slots.actions" class="card-actions">
      <slot name="actions" />
    </v-card-actions>
  </v-card>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';

interface Props {
  title?: string;
  variant?: 'flat' | 'elevated';
  blurAmount?: number;
  opacity?: number;
  expanded?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  blurAmount: 20,
  opacity: 0.4,
  expanded: false
});

const cardOpacity = computed(() => props.opacity);
const cardScale = computed(() => props.expanded ? 1.02 : 1);
</script>

<style scoped>
.apple-card {
  background: rgba(255, 255, 255, var(--card-opacity));
  backdrop-filter: blur(calc(var(--card-blur) * 1px)) saturate(180%);
  border: 0.5px solid rgba(255, 255, 255, 0.3);
  border-radius: 14px;
  box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.37);
  transition: all 0.45s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  transform: scale(var(--card-scale));
  overflow: hidden;
}

.card-title {
  border-bottom: 0.5px solid rgba(60, 60, 67, 0.18);
  padding-bottom: var(--spacing-md);
}

.card-content {
  padding: var(--spacing-lg);
}

.card-actions {
  padding: var(--spacing-md) var(--spacing-lg);
  border-top: 0.5px solid rgba(60, 60, 67, 0.18);
}

.card-expanded {
  box-shadow: 0 12px 48px 0 rgba(31, 38, 135, 0.45);
}
</style>
```

#### Apple-Style Modal/Dialog Component with Depth
File: `src/components/modals/AppleModal.vue`

```vue
<template>
  <v-dialog
    v-model="model"
    :width="width"
    :max-width="maxWidth"
    :persistent="persistent"
    :transition="dialogTransition"
    :fullscreen="isFullscreen"
    class="apple-modal"
  >
    <v-card 
      class="apple-modal-content"
      :class="{ 'modal-fullscreen': isFullscreen }"
    >
      <v-card-title class="modal-header">
        <slot name="title">
          <h2 class="modal-title">{{ title }}</h2>
        </slot>
        <v-btn
          v-if="closable"
          icon
          class="modal-close-btn"
          @click="closeModal"
        >
          <v-icon>mdi-close</v-icon>
        </v-btn>
      </v-card-title>
      
      <v-divider v-if="!isFullscreen" :thickness="0.5" />
      
      <v-card-text class="modal-body">
        <slot />
      </v-card-text>
      
      <v-divider v-if="!isFullscreen && $slots.actions" :thickness="0.5" />
      
      <v-card-actions v-if="$slots.actions" class="modal-actions">
        <slot name="actions" />
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  modelValue: boolean;
  title?: string;
  width?: string | number;
  maxWidth?: string | number;
  persistent?: boolean;
  closable?: boolean;
  fullscreen?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  width: 560,
  maxWidth: '90vw',
  persistent: false,
  closable: true,
  fullscreen: false
});

const emit = defineEmits(['update:modelValue']);

const model = defineModel<boolean>('modelValue');
const isFullscreen = computed(() => props.fullscreen);
const dialogTransition = computed(() => isFullscreen.value ? 'dialog-bottom-transition' : 'dialog-transition');

function closeModal() {
  model.value = false;
  emit('update:modelValue', false);
}
</script>

<style scoped>
.apple-modal {
  :deep(.v-overlay__content) {
    display: flex;
    align-items: center;
    justify-content: center;
  }
}

.apple-modal-content {
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(25px);
  border: 0.5px solid rgba(60, 60, 67, 0.18);
  border-radius: 18px;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.2);
  overflow: hidden;
  transform-origin: center center;
  transition: all 0.45s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-lg) var(--spacing-lg) var(--spacing-md);
}

.modal-title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--label-primary);
}

.modal-close-btn {
  color: var(--label-tertiary);
}

.modal-body {
  padding: var(--spacing-md) var(--spacing-lg);
  color: var(--label-secondary);
}

.modal-actions {
  padding: var(--spacing-md) var(--spacing-lg) var(--spacing-lg);
  justify-content: flex-end;
  gap: var(--spacing-sm);
}

.modal-fullscreen {
  border-radius: 0;
  height: 100%;
  max-height: 100vh;
  width: 100%;
  max-width: 100vw;
  margin: 0;
  border-radius: 0;
}
</style>
```

## Implementation Roadmap

### Phase 1: Foundation (Week 1-2)
- [ ] Typography system implementation
- [ ] Color palette transformation
- [ ] Spacing system implementation
- [ ] Base component styling

### Phase 2: Navigation (Week 3-4)
- [ ] Navigation drawer redesign
- [ ] Breadcrumb navigation enhancement
- [ ] Mobile navigation component

### Phase 3: Core Interfaces (Week 5-6)
- [ ] Dashboard redesign
- [ ] Match control interface
- [ ] Form components enhancement

### Phase 4: Mobile Optimization (Week 7)
- [ ] Mobile-first design patterns
- [ ] Touch-optimized interactions
- [ ] Responsive layouts

### Phase 5: Polish (Week 8)
- [ ] Animation and micro-interaction enhancements
- [ ] Accessibility improvements
- [ ] Performance optimization
- [ ] Testing and refinement

## Success Metrics

### Quantitative Measures
- **Page Load Time**: Maintain current performance or improve
- **User Task Completion**: 15% faster task completion times
- **Mobile Engagement**: 25% increase in mobile usage
- **User Satisfaction**: 20% improvement in satisfaction scores

### Qualitative Measures
- **Visual Appeal**: Subjective rating of visual aesthetics
- **Usability**: User feedback on ease of use
- **Consistency**: Consistent experience across all interfaces
- **Accessibility Compliance**: WCAG 2.1 AA compliance maintained

## Apple-Style Accessibility & Interaction Enhancements

### Haptic Feedback Implementation
Apple-inspired applications provide tactile feedback for important interactions. For the CourtMaster application:

```typescript
// HapticFeedbackService.ts
class HapticFeedbackService {
  /**
   * Provides haptic feedback based on Apple's Taptic Engine patterns
   * Falls back to vibration API for non-Apple devices
   */
  static notification(type: 'success' | 'warning' | 'error' | 'impact' | 'selection') {
    if ('vibrate' in navigator) {
      switch (type) {
        case 'success':
          // Light tap for success (10ms)
          navigator.vibrate(10);
          break;
        case 'warning':
          // Medium tap for warnings (20ms)
          navigator.vibrate(20);
          break;
        case 'error':
          // Strong tap for errors (30ms)
          navigator.vibrate(30);
          break;
        case 'impact':
          // Impact feedback (15ms)
          navigator.vibrate(15);
          break;
        case 'selection':
          // Selection feedback (5ms)
          navigator.vibrate(5);
          break;
      }
    }
  }

  static impact(style: 'light' | 'medium' | 'heavy') {
    const durations = { light: 10, medium: 15, heavy: 20 };
    if ('vibrate' in navigator) {
      navigator.vibrate(durations[style]);
    }
  }

  static selection() {
    if ('vibrate' in navigator) {
      navigator.vibrate(5);
    }
  }
}

// Usage in components
function handleMatchAssignment() {
  // Your assignment logic here
  HapticFeedbackService.notification('success');
}
```

### Voice Control & Siri Integration
Consider adding voice control capabilities for tournament management:

```typescript
// VoiceControlService.ts
class VoiceControlService {
  private recognition: SpeechRecognition | null = null;
  private isListening: boolean = false;

  constructor() {
    const SpeechRecognition = window.SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      this.recognition = new SpeechRecognition();
      this.setupRecognition();
    }
  }

  private setupRecognition() {
    if (this.recognition) {
      this.recognition.continuous = false;
      this.recognition.interimResults = false;
      this.recognition.lang = 'en-US';

      this.recognition.onresult = (event) => {
        const command = event.results[0][0].transcript.toLowerCase();
        this.processVoiceCommand(command);
      };
    }
  }

  private processVoiceCommand(command: string) {
    if (command.includes('start match')) {
      // Start match logic
    } else if (command.includes('end match')) {
      // End match logic
    } else if (command.includes('assign court')) {
      // Assign court logic
    }
  }

  startListening() {
    if (this.recognition) {
      this.recognition.start();
      this.isListening = true;
    }
  }

  stopListening() {
    if (this.recognition) {
      this.recognition.stop();
      this.isListening = false;
    }
  }
}
```

### Accessibility Enhancements
Apple's design philosophy emphasizes accessibility. Implement these enhancements:

```vue
<!-- Apple-Accessible Button Component -->
<template>
  <button
    :class="buttonClasses"
    :aria-label="ariaLabel"
    :aria-describedby="describedById"
    :aria-pressed="isToggle ? pressed : undefined"
    :role="isToggle ? 'switch' : undefined"
    :tabindex="disabled ? -1 : 0"
    @click="handleClick"
    @keydown="handleKeydown"
  >
    <slot />
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  ariaLabel: string;
  describedById?: string;
  isToggle?: boolean;
  pressed?: boolean;
  disabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  isToggle: false,
});

const buttonClasses = computed(() => ({
  'apple-accessible-button': true,
  'button-disabled': props.disabled,
  'button-focused': focused.value,
}));

function handleClick(event: Event) {
  if (!props.disabled) {
    // Handle click
  }
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    if (!props.disabled) {
      handleClick(event as unknown as Event);
    }
  }
}
</script>
```

## Risk Mitigation

### Technical Risks
- **Performance Impact**: Profile and optimize all new animations and effects
- **Browser Compatibility**: Ensure all enhancements work across target browsers
- **Third-party Library Conflicts**: Test Vuetify overrides thoroughly
- **Accessibility Compliance**: Maintain WCAG 2.1 AA compliance

### Design Risks
- **Over-engineering**: Focus on core experience improvements first
- **Feature Parity**: Maintain all existing functionality during redesign
- **User Adaptation**: Provide gradual transition with optional themes
- **Apple Guidelines**: Ensure compliance with Apple's Human Interface Guidelines

### Implementation Risks
- **Vuetify Overrides**: Carefully test all Vuetify component overrides
- **Custom Properties**: Ensure CSS custom properties are properly supported
- **Animation Performance**: Use CSS transforms and opacity for smooth animations

## Conclusion

This comprehensive plan transforms the CourtMaster application with Apple-inspired design principles while preserving all existing functionality. The phased approach ensures gradual implementation with proper testing and validation at each stage, resulting in a significantly improved user experience for tournament organizers.

The implementation focuses on Apple's core design principles:
- **Clarity**: Clean typography and visual hierarchy
- **Deference**: Content-focused interface that doesn't compete with user's content
- **Depth**: Meaningful transitions and layered interfaces with appropriate depth

With these enhancements, CourtMaster will provide a more intuitive, elegant, and efficient experience for tournament organizers while maintaining the robust functionality they rely on.