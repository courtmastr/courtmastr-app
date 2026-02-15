# Reporting & Analytics Dashboard - Implementation Specification

## Overview

Comprehensive reporting and analytics system for tournament administrators to monitor tournament performance, track participant statistics, analyze match data, and export reports. This feature provides data-driven insights to help organizers make informed decisions and improve tournament operations.

**Status:** Not Implemented  
**Priority:** High  
**Effort Estimate:** 5 days  
**Related Files:**
- `/src/services/leaderboardExport.ts` - Existing CSV/JSON export
- `/src/stores/activities.ts` - Activity logging system
- `/src/stores/matches.ts` - Match data
- `/src/stores/registrations.ts` - Registration data
- `/src/stores/tournaments.ts` - Tournament data
- `/src/composables/useLeaderboard.ts` - Leaderboard calculations

---

## Current State Analysis

### What's Implemented

1. **Basic Export** (`/src/services/leaderboardExport.ts`)
   - CSV export of leaderboard data
   - JSON export of leaderboard data
   - 16 columns of statistics

2. **Activity Feed** (`/src/stores/activities.ts`)
   - Tournament activity logging
   - 11 activity types tracked
   - Real-time activity subscription
   - Public activity feed

3. **Match Statistics** (in various stores)
   - Match status tracking (scheduled, ready, in_progress, completed)
   - Score tracking per game
   - Court utilization data
   - Registration counts

### What's Missing

1. ❌ **No Reports Dashboard** - No centralized reporting interface
2. ❌ **No Data Visualization** - No charts, graphs, or visual analytics
3. ❌ **No Tournament Summary Reports** - Overview of tournament performance
4. ❌ **No Participant Analytics** - Individual player statistics
5. ❌ **No Court Utilization Reports** - Court efficiency analysis
6. ❌ **No Financial Reports** - Payment/revenue tracking
7. ❌ **No PDF Report Generation** - Printable formatted reports
8. ❌ **No Scheduled Reports** - Automated report delivery
9. ❌ **No Custom Report Builder** - User-defined reports
10. ❌ **No Export Scheduling** - Automated exports

---

## Required Features

### Phase 1: Core Reports Dashboard (2 days)

#### 1.1 Tournament Summary Report
**Priority:** Critical  
**Effort:** 0.5 days

**Metrics to Display:**
```typescript
interface TournamentSummary {
  // Participation
  totalRegistrations: number;
  approvedRegistrations: number;
  checkedInCount: number;
  noShowCount: number;
  participationRate: number; // checkedIn / approved
  
  // Categories
  categoryBreakdown: {
    categoryId: string;
    categoryName: string;
    registrationCount: number;
    checkedInCount: number;
    matchCount: number;
    completedMatches: number;
  }[];
  
  // Matches
  totalMatches: number;
  completedMatches: number;
  inProgressMatches: number;
  scheduledMatches: number;
  walkovers: number;
  completionRate: number;
  
  // Courts
  totalCourts: number;
  courtUtilizationRate: number; // hours used / hours available
  averageMatchDuration: number; // minutes
  
  // Timeline
  registrationStartDate: Date;
  tournamentStartDate: Date;
  estimatedCompletionDate: Date;
  daysRemaining: number;
  
  // Financial (if payment tracking enabled)
  totalRevenue?: number;
  pendingPayments?: number;
  collectionRate?: number;
}
```

**UI Component:**
- Route: `/tournaments/:tournamentId/reports/summary`
- Component: `/src/features/reports/views/TournamentSummaryView.vue`
- Cards layout with key metrics
- Progress bars for rates
- Color-coded status indicators

#### 1.2 Participant Analytics
**Priority:** Critical  
**Effort:** 0.5 days

**Metrics per Participant:**
```typescript
interface ParticipantAnalytics {
  registrationId: string;
  participantName: string;
  categoryName: string;
  
  // Participation
  registrationDate: Date;
  checkInDate?: Date;
  checkInTime?: number; // minutes before first match
  
  // Performance
  matchesPlayed: number;
  matchesWon: number;
  matchesLost: number;
  winRate: number;
  
  // Match Details
  gamesWon: number;
  gamesLost: number;
  totalPointsScored: number;
  totalPointsConceded: number;
  averageGameScore: number;
  
  // Progress
  finalPosition?: number;
  eliminationRound?: number;
  bracketReached?: string;
  
  // Activity
  firstMatchDate?: Date;
  lastMatchDate?: Date;
  totalTimeOnCourt: number; // minutes
  averageMatchDuration: number; // minutes
}
```

**Features:**
- Sortable data table
- Filter by category, status, performance
- Export to CSV/Excel
- Top performers highlight

#### 1.3 Court Utilization Report
**Priority:** High  
**Effort:** 0.5 days

**Metrics per Court:**
```typescript
interface CourtUtilization {
  courtId: string;
  courtName: string;
  
  // Usage
  totalMatches: number;
  matchesCompleted: number;
  totalUsageTime: number; // minutes
  averageMatchDuration: number; // minutes
  
  // Efficiency
  utilizationRate: number; // percentage
  downtimeMinutes: number;
  longestIdlePeriod: number; // minutes
  
  // Schedule
  firstMatchStart?: Date;
  lastMatchEnd?: Date;
  peakUsageHours: { hour: number; matchCount: number }[];
  
  // Maintenance
  maintenanceEvents: number;
  totalMaintenanceTime: number; // minutes
}
```

**Visualizations:**
- Timeline showing court occupancy
- Bar chart of matches per court
- Heat map of usage by hour

#### 1.4 Match Statistics Report
**Priority:** High  
**Effort:** 0.5 days

**Metrics:**
```typescript
interface MatchStatistics {
  // Overview
  totalMatches: number;
  byStatus: Record<MatchStatus, number>;
  byRound: Record<number, number>;
  
  // Duration
  averageMatchDuration: number;
  shortestMatch: number;
  longestMatch: number;
  durationDistribution: { range: string; count: number }[];
  
  // Scores
  averageGamesPerMatch: number;
  threeGameMatches: number;
  twoGameMatches: number;
  oneGameMatches: number;
  
  // Competitive Balance
  closeMatches: number; // Decided by 2 points in final game
  blowoutMatches: number; // Won by 10+ points
  averagePointDifferential: number;
  
  // Special Cases
  walkovers: number;
  delays: number;
  totalDelayMinutes: number;
}
```

### Phase 2: Data Visualization (2 days)

#### 2.1 Charts & Graphs
**Priority:** High  
**Effort:** 1 day

**Chart Library:** Chart.js or ApexCharts (lightweight, Vue-compatible)

**Required Charts:**

1. **Registration Timeline**
   - Line chart showing registrations over time
   - Cumulative vs daily registrations
   - Category breakdown (stacked area)

2. **Match Completion Timeline**
   - Bar chart of matches completed per hour/day
   - Category color-coding
   - Projected completion based on current rate

3. **Court Utilization Heat Map**
   - Grid showing court usage by hour
   - Color intensity based on number of matches
   - Helps identify peak times

4. **Participant Performance Distribution**
   - Histogram of win rates
   - Bell curve of player rankings
   - Category comparisons

5. **Tournament Progress Gauge**
   - Circular progress indicator
   - Shows % of tournament complete
   - ETA to completion

6. **Category Comparison Chart**
   - Side-by-side bar chart
   - Registrations, matches, completion rates
   - Identifies popular/underperforming categories

#### 2.2 Real-Time Dashboard
**Priority:** High  
**Effort:** 1 day

**Live Metrics:**
```typescript
interface LiveTournamentMetrics {
  // Current State
  matchesInProgress: number;
  courtsInUse: number;
  courtsAvailable: number;
  playersOnCourt: number;
  playersWaiting: number;
  estimatedWaitTime: number; // minutes
  
  // Today's Progress
  matchesCompletedToday: number;
  matchesScheduledToday: number;
  completionPercentage: number;
  
  // Hourly Rate
  matchesPerHour: number;
  projectedCompletionTime: Date;
  onTrackStatus: 'ahead' | 'on_track' | 'behind';
  
  // Alerts
  delayedMatches: number;
  longWaitTimes: boolean;
  courtBottlenecks: string[];
}
```

**UI Design:**
- Auto-refresh every 30 seconds
- Large metric cards for at-a-glance reading
- Traffic light indicators (green/yellow/red)
- Alert banner for issues

### Phase 3: Advanced Reporting (1 day)

#### 3.1 PDF Report Generation
**Priority:** Medium  
**Effort:** 0.5 days

**Library:** html2pdf.js or jsPDF

**Report Templates:**
1. **Tournament Summary Report**
   - Executive summary with key metrics
   - Charts and visualizations
   - Category breakdown tables
   - Professional formatting with header/footer

2. **Participant Certificates**
   - Winner certificates
   - Participation certificates
   - Customizable templates

3. **Results Booklet**
   - Complete bracket results
   - Match scores
   - Final standings

#### 3.2 Scheduled Reports
**Priority:** Medium  
**Effort:** 0.5 days

**Features:**
- Schedule daily summary emails
- Auto-export CSV at intervals
- Configurable recipients
- Report templates

**Cloud Function:**
```typescript
// functions/src/reports.ts
export const generateScheduledReports = onSchedule('0 8 * * *', async (event) => {
  // Generate daily reports for active tournaments
  // Email to tournament organizers
});
```

---

## Technical Implementation

### New Files Required

```
src/
├── features/
│   └── reports/
│       ├── views/
│       │   ├── ReportsDashboardView.vue    # Main reports hub
│       │   ├── TournamentSummaryView.vue   # Summary metrics
│       │   ├── ParticipantAnalyticsView.vue # Player stats
│       │   ├── CourtUtilizationView.vue    # Court analytics
│       │   └── MatchStatisticsView.vue     # Match data
│       ├── components/
│       │   ├── MetricCard.vue              # Reusable metric display
│       │   ├── ChartContainer.vue          # Chart wrapper
│       │   ├── ReportFilterBar.vue         # Filter controls
│       │   ├── ExportButton.vue            # Export actions
│       │   ├── RegistrationTimeline.vue    # Registration chart
│       │   ├── CourtHeatMap.vue            # Court visualization
│       │   └── ProgressGauge.vue           # Circular progress
│       ├── composables/
│       │   ├── useTournamentReports.ts     # Report data fetching
│       │   ├── useChartData.ts             # Chart data preparation
│       │   └── useExportReports.ts         # Export functionality
│       └── services/
│           ├── pdfExport.ts                # PDF generation
│           └── chartConfig.ts              # Chart configurations
├── stores/
│   └── reports.ts                          # Reports store
└── types/
    └── reports.ts                          # Report type definitions
```

### Store Implementation

```typescript
// /src/stores/reports.ts
export const useReportsStore = defineStore('reports', () => {
  // State
  const summary = ref<TournamentSummary | null>(null);
  const participantAnalytics = ref<ParticipantAnalytics[]>([]);
  const courtUtilization = ref<CourtUtilization[]>([]);
  const matchStats = ref<MatchStatistics | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);
  
  // Actions
  async function fetchTournamentSummary(tournamentId: string);
  async function fetchParticipantAnalytics(
    tournamentId: string, 
    filters?: ParticipantFilters
  );
  async function fetchCourtUtilization(tournamentId: string);
  async function fetchMatchStatistics(tournamentId: string);
  async function exportReport(
    tournamentId: string, 
    type: ReportType, 
    format: 'csv' | 'pdf' | 'excel'
  );
  
  // Computed
  const chartData = computed(() => prepareChartData(participantAnalytics.value));
  
  return {
    summary,
    participantAnalytics,
    courtUtilization,
    matchStats,
    loading,
    error,
    fetchTournamentSummary,
    fetchParticipantAnalytics,
    fetchCourtUtilization,
    fetchMatchStatistics,
    exportReport,
  };
});
```

### Route Configuration

```typescript
// Add to /src/router/index.ts
{
  path: '/tournaments/:tournamentId/reports',
  name: 'reports-dashboard',
  component: () => import('@/features/reports/views/ReportsDashboardView.vue'),
  meta: { requiresAuth: true, requiresAdmin: true },
  children: [
    {
      path: '',
      redirect: { name: 'tournament-summary' }
    },
    {
      path: 'summary',
      name: 'tournament-summary',
      component: () => import('@/features/reports/views/TournamentSummaryView.vue'),
    },
    {
      path: 'participants',
      name: 'participant-analytics',
      component: () => import('@/features/reports/views/ParticipantAnalyticsView.vue'),
    },
    {
      path: 'courts',
      name: 'court-utilization',
      component: () => import('@/features/reports/views/CourtUtilizationView.vue'),
    },
    {
      path: 'matches',
      name: 'match-statistics',
      component: () => import('@/features/reports/views/MatchStatisticsView.vue'),
    },
  ],
},
```

### Type Definitions

```typescript
// /src/types/reports.ts
export type ReportType = 
  | 'tournament_summary'
  | 'participant_analytics'
  | 'court_utilization'
  | 'match_statistics';

export interface ReportFilters {
  dateRange?: { start: Date; end: Date };
  categories?: string[];
  status?: string[];
  format?: 'csv' | 'pdf' | 'excel';
}

export interface ChartDataset {
  label: string;
  data: number[];
  backgroundColor?: string;
  borderColor?: string;
}

export interface ChartConfig {
  type: 'line' | 'bar' | 'pie' | 'doughnut' | 'radar';
  labels: string[];
  datasets: ChartDataset[];
  options?: Record<string, unknown>;
}
```

---

## UI/UX Design

### Reports Dashboard Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│ Tournament Reports                                  [Export ▼]       │
├─────────────────────────────────────────────────────────────────────┤
│ [Summary] [Participants] [Courts] [Matches] [Live]                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│ ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐     │
│ │ 156              │ │ 89%              │ │ 42 min           │     │
│ │ Registrations    │ │ Completion Rate  │ │ Avg Match Time   │     │
│ │ ↑ 23 this week   │ │ On Track ✓       │ │ ↓ 3 min faster   │     │
│ └──────────────────┘ └──────────────────┘ └──────────────────┘     │
│                                                                     │
│ ┌──────────────────────────────────────────────────────────────┐   │
│ │ Registration Timeline                                        │   │
│ │                                                             │   │
│ │    ▲                                                        │   │
│ │ 50 ┤    ╭─╮                                                 │   │
│ │ 40 ┤   ╭╯ ╰╮  ╭─╮                                           │   │
│ │ 30 ┤  ╭╯   ╰──╯ ╰╮                                          │   │
│ │ 20 ┤ ╭╯          ╰────╮                                     │   │
│ │ 10 ┤╭╯                 ╰─────────╮                          │   │
│ │  0 ┴───────────────────────────────                          │   │
│ │     Mon  Tue  Wed  Thu  Fri  Sat  Sun                       │   │
│ └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
│ ┌──────────────────────────┐ ┌────────────────────────────────┐    │
│ │ Category Breakdown       │ │ Court Utilization              │    │
│ │                          │ │                                │    │
│ │ Men's Singles    ████████│ │ Court 1  ████████████  85%    │    │
│ │ Women's Singles  ██████  │ │ Court 2  ██████████    72%    │    │
│ │ Men's Doubles    █████   │ │ Court 3  █████████████ 91%    │    │
│ │ Women's Doubles  ████    │ │ Court 4  ████████      58%    │    │
│ │ Mixed Doubles    ██████  │ │                                │    │
│ └──────────────────────────┘ └────────────────────────────────┘    │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Chart Specifications

1. **Registration Timeline**
   - Type: Line chart with area fill
   - X-axis: Dates
   - Y-axis: Registration count
   - Series: Total, By Category

2. **Court Utilization Heat Map**
   - Type: Custom grid component
   - X-axis: Hours (8am - 8pm)
   - Y-axis: Court names
   - Color: Blue intensity based on match count

3. **Category Comparison**
   - Type: Horizontal bar chart
   - Metrics: Registrations, Matches, Completion Rate

4. **Performance Distribution**
   - Type: Histogram
   - X-axis: Win rate buckets (0-10%, 10-20%, etc.)
   - Y-axis: Number of players

---

## Data Aggregation Strategy

### Efficient Querying

**Problem:** Calculating statistics across large datasets can be slow

**Solution:** Use Cloud Functions for aggregation

```typescript
// functions/src/reports.ts
export const calculateTournamentStats = onDocumentWrite(
  'tournaments/{tournamentId}/match_scores/{matchId}',
  async (event) => {
    // Incrementally update statistics when matches change
    const { tournamentId } = event.params;
    const statsRef = db.collection('tournament_stats').doc(tournamentId);
    
    await db.runTransaction(async (transaction) => {
      const statsDoc = await transaction.get(statsRef);
      const currentStats = statsDoc.data() || {};
      
      // Update aggregated statistics
      transaction.update(statsRef, {
        totalMatches: increment(1),
        completedMatches: increment(event.data.after?.status === 'completed' ? 1 : 0),
        lastUpdated: serverTimestamp(),
      });
    });
  }
);
```

### Caching Strategy

- Cache report data for 5 minutes
- Invalidate cache on match/registration updates
- Use Pinia store for client-side caching

---

## Export Formats

### CSV Export
- Compatible with Excel, Google Sheets
- UTF-8 encoding for international characters
- Comma-separated with quoted strings

### Excel Export
- Use xlsx.js library
- Multiple sheets per workbook
- Formatted headers and styling
- Formulas for calculations

### PDF Export
- A4/Letter page sizes
- Headers and footers
- Page numbers
- Professional styling

---

## Testing Requirements

### Unit Tests
- Chart data preparation functions
- Export formatting functions
- Statistics calculations

### E2E Tests
- Report generation flow
- Export functionality
- Filter interactions

### Performance Tests
- Large dataset handling (1000+ registrations)
- Chart rendering performance
- Export generation time

---

## Acceptance Criteria

- [ ] Tournament summary displays all key metrics
- [ ] Participant analytics table is sortable and filterable
- [ ] Court utilization shows accurate usage percentages
- [ ] Match statistics include duration and competitive balance
- [ ] All charts render correctly with real data
- [ ] CSV export includes all selected data
- [ ] PDF export generates formatted reports
- [ ] Reports update in real-time or on refresh
- [ ] Mobile-responsive chart layouts
- [ ] Loading states for all async operations

---

## Related Documentation

- [Leaderboard Export Service](../src/services/leaderboardExport.ts) - Existing export functionality
- [Activity Store](../src/stores/activities.ts) - Activity logging
- [Match Store](../src/stores/matches.ts) - Match data
- [User Management Dashboard](./USER_MANAGEMENT_DASHBOARD.md) - User analytics

---

**Document Version:** 1.0  
**Last Updated:** 2026-02-14  
**Author:** Sisyphus AI  
**Status:** Draft - Ready for Implementation
