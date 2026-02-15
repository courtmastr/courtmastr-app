# CourtMaster v2 - Technical Design Document

## Overview

This document describes the technical architecture and implementation details of CourtMaster v2, a badminton tournament management system built with Vue 3, TypeScript, and Firebase.

## Technology Stack

### Frontend
| Technology | Version | Purpose |
|------------|---------|---------|
| Vue 3 | 3.5.x | Reactive UI framework |
| TypeScript | 5.9.x | Type-safe JavaScript |
| Vite | 7.2.x | Build tool and dev server |
| Vuetify 3 | 3.11.x | Material Design component library |
| Pinia | 3.0.x | State management |
| Vue Router | 4.6.x | Client-side routing |
| VueFire | 3.2.x | Vue-Firebase integration |

### Backend
| Technology | Version | Purpose |
|------------|---------|---------|
| Firebase | 12.8.x | Backend platform |
| Firestore | - | NoSQL database with real-time sync |
| Firebase Auth | - | Email/password authentication |
| Cloud Functions | Node 20 | Server-side logic |
| Firebase Hosting | - | Static hosting and CDN |

### Key Libraries
| Library | Purpose |
|---------|---------|
| brackets-manager | Tournament bracket generation and management |
| brackets-model | Data models for tournament structures |
| brackets-viewer | Bracket visualization component |

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client (Browser)                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │   Vue 3     │  │   Vuetify   │  │   brackets-viewer       │  │
│  │   Router    │  │   UI        │  │   (Bracket Display)     │  │
│  └──────┬──────┘  └──────┬──────┘  └───────────┬─────────────┘  │
│         │                │                     │                 │
│  ┌──────┴────────────────┴─────────────────────┴──────────────┐ │
│  │                      Pinia Stores                          │ │
│  │  auth | tournaments | categories | matches | registrations │ │
│  └────────────────────────────┬───────────────────────────────┘ │
└───────────────────────────────┼─────────────────────────────────┘
                                │
                    ┌───────────┴───────────┐
                    │    Firebase SDK       │
                    │  (VueFire bindings)   │
                    └───────────┬───────────┘
                                │
┌───────────────────────────────┼─────────────────────────────────┐
│                         Firebase                                 │
│  ┌─────────────┐  ┌───────────┴───────────┐  ┌───────────────┐  │
│  │   Auth      │  │      Firestore        │  │   Functions   │  │
│  │             │  │  (Real-time DB)       │  │               │  │
│  │  - Users    │  │  - tournaments        │  │ - generateBr. │  │
│  │  - Roles    │  │  - categories         │  │ - updateMatch │  │
│  │             │  │  - registrations      │  │ - scheduling  │  │
│  │             │  │  - match (brackets)   │  │               │  │
│  │             │  │  - participant        │  │               │  │
│  │             │  │  - stage/group/round  │  │               │  │
│  └─────────────┘  └───────────────────────┘  └───────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Project Structure

```
courtmaster-v2/
├── src/
│   ├── components/           # Shared UI components
│   │   ├── common/           # Generic components (buttons, cards)
│   │   └── layout/           # App shell, navigation
│   ├── features/             # Feature modules (domain-organized)
│   │   ├── auth/             # Login, registration views
│   │   ├── tournaments/      # Tournament CRUD, dashboard
│   │   ├── scoring/          # Real-time scoring interface
│   │   ├── brackets/         # Bracket visualization
│   │   ├── registration/     # Player registration UI
│   │   └── public/           # Public-facing views
│   ├── stores/               # Pinia state stores
│   ├── services/             # Firebase service layer
│   ├── types/                # TypeScript type definitions
│   ├── router/               # Vue Router configuration
│   ├── plugins/              # Vue plugins (Vuetify)
│   └── utils/                # Utility functions
├── functions/                # Cloud Functions
│   └── src/
│       ├── bracket.ts        # Bracket generation
│       ├── updateMatch.ts    # Match updates and advancement
│       ├── scheduling.ts     # Schedule optimization
│       ├── manager.ts        # brackets-manager wrapper
│       └── storage/          # Firestore adapter for brackets-manager
└── tests/                    # Test files
```

## Data Models

### Core Types

```typescript
// User Roles
type UserRole = 'admin' | 'organizer' | 'scorekeeper' | 'player' | 'viewer';

// Tournament Status Flow
type TournamentStatus = 'draft' | 'registration' | 'active' | 'completed' | 'cancelled';

// Tournament Formats
type TournamentFormat = 'single_elimination' | 'double_elimination' | 'round_robin';

// Match Status Flow
type MatchStatus = 'scheduled' | 'ready' | 'in_progress' | 'completed' | 'walkover' | 'cancelled';

// Registration Status Flow
type RegistrationStatus = 'pending' | 'approved' | 'rejected' | 'withdrawn' | 'checked_in';

// Payment Tracking
type PaymentStatus = 'unpaid' | 'paid' | 'partial' | 'refunded';
```

### Firestore Schema

#### Root Collections

```
/users/{userId}
  - id: string
  - email: string
  - displayName: string
  - role: UserRole
  - createdAt: Timestamp
  - updatedAt: Timestamp

/tournaments/{tournamentId}
  - id: string
  - name: string
  - description: string
  - sport: 'badminton'
  - format: TournamentFormat
  - status: TournamentStatus
  - startDate: Timestamp
  - endDate: Timestamp
  - registrationDeadline: Timestamp
  - location: string
  - settings: TournamentSettings
  - createdBy: string (userId)
  - createdAt: Timestamp
  - updatedAt: Timestamp

/notifications/{notificationId}
  - id: string
  - userId: string
  - type: NotificationType
  - title: string
  - message: string
  - read: boolean
  - createdAt: Timestamp
```

#### Tournament Subcollections

```
/tournaments/{tournamentId}/categories/{categoryId}
  - id: string
  - tournamentId: string
  - name: string
  - type: 'singles' | 'doubles' | 'mixed_doubles'
  - gender: 'men' | 'women' | 'mixed' | 'open'
  - ageGroup: AgeGroup
  - format: TournamentFormat
  - maxParticipants: number
  - seedingEnabled: boolean
  - status: 'setup' | 'registration' | 'active' | 'completed'

/tournaments/{tournamentId}/courts/{courtId}
  - id: string
  - name: string
  - number: number
  - status: 'available' | 'in_use' | 'maintenance'
  - currentMatchId: string (optional)

/tournaments/{tournamentId}/registrations/{registrationId}
  - id: string
  - tournamentId: string
  - categoryId: string
  - participantType: 'player' | 'team'
  - playerId: string (optional)
  - partnerPlayerId: string (for doubles)
  - teamName: string (for doubles display)
  - status: RegistrationStatus
  - paymentStatus: PaymentStatus
  - seed: number (optional)
  - registeredBy: string (userId)
  - registeredAt: Timestamp
  - approvedAt: Timestamp (optional)
  - approvedBy: string (optional)

/tournaments/{tournamentId}/players/{playerId}
  - id: string
  - firstName: string
  - lastName: string
  - email: string
  - phone: string
  - skillLevel: number (1-10)
  - userId: string (optional, links to auth user)

/tournaments/{tournamentId}/activities/{activityId}
  - id: string
  - type: string
  - message: string
  - data: object
  - createdAt: Timestamp
```

#### Brackets-Manager Collections

The system uses the `brackets-manager` library which stores bracket data in its own schema:

```
/tournaments/{tournamentId}/stage/{stageId}
  - id: string
  - tournament_id: string (categoryId in our system)
  - name: string
  - type: 'single_elimination' | 'double_elimination' | 'round_robin'

/tournaments/{tournamentId}/group/{groupId}
  - id: string
  - stage_id: string
  - number: number (1=winners, 2=losers, 3=finals)

/tournaments/{tournamentId}/round/{roundId}
  - id: string
  - stage_id: string
  - group_id: string
  - number: number

/tournaments/{tournamentId}/match/{matchId}
  - id: string
  - stage_id: string
  - group_id: string
  - round_id: string
  - number: number
  - opponent1: { id: string, position: number, result: string }
  - opponent2: { id: string, position: number, result: string }
  - status: number (0=locked, 1=waiting, 2=ready, 3=running, 4=completed)

/tournaments/{tournamentId}/participant/{participantId}
  - id: string
  - tournament_id: string (categoryId)
  - name: string (stores registrationId)
```

#### Match Scores Collection

Detailed scoring data is stored separately from brackets-manager:

```
/tournaments/{tournamentId}/match_scores/{matchId}
  - scores: GameScore[]
  - courtId: string
  - scheduledTime: Timestamp
  - startedAt: Timestamp
  - completedAt: Timestamp
  - winnerId: string
  - updatedAt: Timestamp

GameScore:
  - gameNumber: number
  - score1: number
  - score2: number
  - winnerId: string
  - isComplete: boolean
```

## State Management (Pinia Stores)

### Store Architecture

Each store follows a consistent pattern:
- Reactive state with `ref()`
- Computed getters
- Async actions for Firebase operations
- Real-time subscription management

### Auth Store (`stores/auth.ts`)

```typescript
// State
- user: User | null
- loading: boolean
- error: string | null

// Actions
- login(email, password)
- register(email, password, displayName)
- logout()
- fetchUserProfile()
```

### Tournaments Store (`stores/tournaments.ts`)

```typescript
// State
- tournaments: Tournament[]
- currentTournament: Tournament | null
- loading: boolean

// Actions
- fetchTournaments()
- fetchTournament(id)
- createTournament(data)
- updateTournament(id, data)
- subscribeTournament(id)  // Real-time
```

### Matches Store (`stores/matches.ts`)

The matches store is complex because it bridges the brackets-manager data with the application's UI needs.

```typescript
// State
- matches: Match[]
- currentMatch: Match | null
- loading: boolean

// Key Actions
- fetchMatches(tournamentId, categoryId?)
  // Fetches from brackets-manager collections and adapts to Match interface

- subscribeMatches(tournamentId, categoryId?)
  // Sets up real-time listeners on match and participant collections

- startMatch(tournamentId, matchId)
  // Initializes scores, calls Cloud Function to update status

- updateScore(tournamentId, matchId, participant)
  // Increments score, checks game/match completion rules

- completeMatch(tournamentId, matchId, scores, winnerId)
  // Saves final scores, calls Cloud Function to advance bracket
```

### Bracket Match Adapter (`stores/bracketMatchAdapter.ts`)

Converts brackets-manager data format to the application's Match interface:

```typescript
function adaptBracketsMatchToLegacyMatch(
  bracketsMatch: BracketsMatch,
  rounds: BracketsRound[],
  groups: BracketsGroup[],
  participants: BracketsParticipant[],
  categoryId: string,
  tournamentId: string
): Match | null

// Status mapping
// brackets-manager status -> our MatchStatus
// 0 (locked)     -> 'scheduled'
// 1 (waiting)    -> 'scheduled'
// 2 (ready)      -> 'ready'
// 3 (running)    -> 'in_progress'
// 4 (completed)  -> 'completed'
```

## Cloud Functions

### Bracket Generation (`functions/src/bracket.ts`)

Generates tournament brackets using brackets-manager library.

```typescript
async function generateBracket(tournamentId: string, categoryId: string): Promise<void>

// Process:
// 1. Fetch category configuration
// 2. Get approved/checked-in registrations
// 3. Sort by seed (seeded first, then random)
// 4. Calculate bracket size (power of 2, with byes)
// 5. Create stage via brackets-manager
// 6. Update category status to 'active'
```

**Seeding Algorithm:**
- Seeded players sorted by seed number
- Unseeded players randomized
- Bracket padded to power-of-2 with nulls (byes)
- Uses `inner_outer` seed ordering for proper bye distribution

### Match Updates (`functions/src/updateMatch.ts`)

Handles match status updates and bracket advancement.

```typescript
// Callable function
exports.updateMatch = functions.https.onCall(async (data, context) => {
  const { tournamentId, matchId, status, winnerId, scores } = data;

  // 1. Validate user permissions
  // 2. Update match status in brackets-manager
  // 3. If completed with winner, advance bracket
  // 4. Return success/failure
});
```

### Scheduling (`functions/src/scheduling.ts`)

Optimizes match scheduling with rest time constraints.

```typescript
interface ScheduleGenerationRequest {
  tournamentId: string;
  categoryIds: string[];
  courtIds: string[];
  startTime: Date;
  endTime: Date;
  minRestTimeMinutes: number;
  matchDurationMinutes: number;
}
```

## Real-Time Architecture

### Firestore Listeners

The application uses `onSnapshot` for real-time updates:

```typescript
// In Pinia stores
function subscribeMatches(tournamentId: string): void {
  const unsubscribers: (() => void)[] = [];

  // Listen to match collection
  const unsubMatch = onSnapshot(
    collection(db, `tournaments/${tournamentId}/match`),
    () => refresh()
  );
  unsubscribers.push(unsubMatch);

  // Listen to participants
  const unsubPart = onSnapshot(
    collection(db, `tournaments/${tournamentId}/participant`),
    () => refresh()
  );
  unsubscribers.push(unsubPart);

  // Store cleanup function
  matchesUnsubscribe = () => unsubscribers.forEach(u => u());
}
```

### Data Flow for Scoring

```
1. User taps score button
   ↓
2. matches store.updateScore()
   ↓
3. Check game completion (badminton rules)
   ↓
4. If game complete, check match completion
   ↓
5. Write to match_scores collection
   ↓
6. If match complete:
   ↓
7. Call updateMatch Cloud Function
   ↓
8. Cloud Function advances bracket via brackets-manager
   ↓
9. Firestore listeners trigger refresh
   ↓
10. UI updates automatically
```

## Scoring Logic

### Badminton Rules Implementation

```typescript
const BADMINTON_CONFIG = {
  gamesPerMatch: 3,    // Best of 3
  pointsToWin: 21,     // Points to win a game
  mustWinBy: 2,        // Win by 2 points
  maxPoints: 30,       // Cap at 30 (at 29-29, first to 30 wins)
};

function checkGameComplete(game: GameScore): { isComplete: boolean; winnerId?: number } {
  const { score1, score2 } = game;

  // Max points reached
  if (score1 === 30) return { isComplete: true, winnerId: 1 };
  if (score2 === 30) return { isComplete: true, winnerId: 2 };

  // Win by 2 after reaching 21
  if (score1 >= 21 && score1 - score2 >= 2) return { isComplete: true, winnerId: 1 };
  if (score2 >= 21 && score2 - score1 >= 2) return { isComplete: true, winnerId: 2 };

  return { isComplete: false };
}

function checkMatchComplete(scores: GameScore[]): { isComplete: boolean; winnerId?: string } {
  const gamesNeeded = 2; // Best of 3
  let p1Wins = 0, p2Wins = 0;

  for (const game of scores) {
    if (game.isComplete) {
      if (game.winnerId === participant1Id) p1Wins++;
      else p2Wins++;
    }
  }

  if (p1Wins >= gamesNeeded) return { isComplete: true, winnerId: participant1Id };
  if (p2Wins >= gamesNeeded) return { isComplete: true, winnerId: participant2Id };

  return { isComplete: false };
}
```

## Security Rules

### Firestore Security Model

```javascript
// Role-based access control
function isAdmin() {
  return isAuthenticated() &&
    get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
}

function isScorekeeper() {
  return isAuthenticated() &&
    get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['admin', 'scorekeeper'];
}

// Collection rules summary:
// /users - Read: authenticated, Write: own profile only (except role)
// /tournaments - Read: public, Write: authenticated
// /tournaments/*/match - Read: public, Write: scorekeepers/admins
// /tournaments/*/stage - Read: public, Write: admins only
// /notifications - Read/Write: own notifications only
```

### Route Guards

```typescript
// Router meta fields
meta: {
  requiresAuth: boolean;
  roles?: UserRole[];  // Required roles
}

// Navigation guard
router.beforeEach(async (to) => {
  const authStore = useAuthStore();

  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    return '/login';
  }

  if (to.meta.roles && !to.meta.roles.includes(authStore.user?.role)) {
    return '/unauthorized';
  }
});
```

## API Reference

### Cloud Functions

| Function | Type | Description |
|----------|------|-------------|
| `generateBracket` | Callable | Generate bracket for a category |
| `updateMatch` | Callable | Update match status/scores, advance bracket |
| `generateSchedule` | Callable | Optimize match scheduling |

### Callable Function Pattern

```typescript
// Client-side call
import { httpsCallable, functions } from '@/services/firebase';

const updateMatchFn = httpsCallable(functions, 'updateMatch');
const result = await updateMatchFn({
  tournamentId: 'abc123',
  matchId: 'match456',
  status: 'completed',
  winnerId: 'reg789',
  scores: [...]
});
```

## Deployment

### Firebase Configuration

```json
// firebase.json
{
  "hosting": {
    "public": "dist",
    "rewrites": [{ "source": "**", "destination": "/index.html" }],
    "headers": [
      {
        "source": "**/*.@(js|css|woff2)",
        "headers": [{ "key": "Cache-Control", "value": "max-age=31536000" }]
      }
    ]
  },
  "functions": {
    "source": "functions",
    "runtime": "nodejs20"
  }
}
```

### Emulator Configuration

```json
// firebase.json (emulators section)
{
  "emulators": {
    "auth": { "port": 9099 },
    "firestore": { "port": 8080 },
    "functions": { "port": 5001 },
    "hosting": { "port": 5002 },
    "ui": { "enabled": true, "port": 4000 }
  }
}
```

### Build and Deploy Commands

```bash
# Development
npm run dev              # Vite dev server
npm run emulators        # Firebase emulators

# Production build
npm run build            # TypeScript check + Vite build

# Deployment
npm run deploy           # Full deployment (hosting + functions + rules)
npm run deploy:hosting   # Hosting only
npm run deploy:functions # Cloud Functions only
npm run deploy:rules     # Firestore security rules only
```

### Bundle Optimization

Vite configuration splits vendors for optimal caching:

```typescript
// vite.config.ts
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        'vendor-vue': ['vue', 'vue-router', 'pinia'],
        'vendor-vuetify': ['vuetify'],
        'vendor-firebase': ['firebase/app', 'firebase/firestore', 'firebase/auth'],
      }
    }
  }
}
```

## Testing

### Test Setup

- **Framework:** Vitest
- **Component Testing:** @vue/test-utils
- **DOM:** Happy DOM

### Running Tests

```bash
npm run test             # Run all tests
npm run test:coverage    # With coverage report
```

### Test Location

```
tests/
├── unit/                # Unit tests for utilities, stores
└── components/          # Vue component tests
```

## Key Architectural Decisions

### 1. brackets-manager Integration

**Decision:** Use brackets-manager library for bracket generation and management.

**Rationale:**
- Professional-grade tournament bracket algorithms
- Handles complex formats (double elimination, round robin)
- Proper seeding and bye distribution
- Automatic winner advancement

**Trade-off:** Requires adapter layer to convert data format for UI.

### 2. Dual Data Storage for Matches

**Decision:** Store bracket state in brackets-manager collections, detailed scores in separate `match_scores` collection.

**Rationale:**
- brackets-manager manages bracket progression (who advances)
- Application manages detailed scoring (game-by-game points)
- Separation allows independent updates without conflicts

### 3. Cloud Functions for Bracket Advancement

**Decision:** Use Cloud Functions for match completion and bracket advancement.

**Rationale:**
- Ensures atomic bracket updates
- brackets-manager requires server-side storage adapter
- Prevents race conditions in bracket progression
- Centralizes business logic

### 4. Real-Time via Firestore Listeners

**Decision:** Use onSnapshot listeners instead of polling.

**Rationale:**
- Instant updates for live scoring
- Efficient (only transfers changes)
- Built into Firebase SDK
- Works well with Vue reactivity

### 5. Feature-Based Code Organization

**Decision:** Organize code by feature domain rather than technical layer.

**Rationale:**
- Related code stays together
- Easier to understand feature boundaries
- Supports future extraction/modularization
- Aligns with Vue 3 Composition API patterns
