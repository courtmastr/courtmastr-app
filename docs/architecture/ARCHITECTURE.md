# CourtMastr v2 - Architecture Overview

This document provides a comprehensive overview of CourtMastr's architecture, designed for developers, architects, and technical stakeholders.

## 📋 Table of Contents

- [System Overview](#system-overview)
- [Architecture Principles](#architecture-principles)
- [Technology Stack](#technology-stack)
- [System Architecture](#system-architecture)
- [Data Architecture](#data-architecture)
- [Frontend Architecture](#frontend-architecture)
- [Backend Architecture](#backend-architecture)
- [Security Architecture](#security-architecture)
- [Deployment Architecture](#deployment-architecture)
- [Scalability Considerations](#scalability-considerations)
- [Key Architectural Decisions](#key-architectural-decisions)

---

## 🎯 System Overview

CourtMastr is a **serverless, cloud-native Progressive Web App** for managing badminton tournaments. It provides real-time tournament management with offline support, designed to operate efficiently in venues with limited connectivity.

### Core Capabilities

- **Tournament Lifecycle Management**: Creation → Registration → Bracket Generation → Scoring → Completion
- **Real-time Scoring**: Mobile-optimized interface with instant updates
- **Public Brackets**: Shareable, live-updating tournament brackets
- **Multi-User Collaboration**: Concurrent scoring by multiple scorekeepers
- **Offline Resilience**: Continue operations during connectivity outages

---

## 🏛️ Architecture Principles

### 1. Serverless First
- No server management or provisioning
- Automatic scaling based on demand
- Pay-per-use pricing model

### 2. Real-Time by Default
- All data changes propagate instantly
- Firestore listeners for live updates
- Optimistic UI updates for responsiveness

### 3. Offline Resilience
- PWA with Service Workers
- Firestore offline persistence
- Queue-and-sync pattern for mutations

### 4. Mobile-First Design
- Scorekeepers use phones/tablets on court
- Touch-optimized interfaces
- Responsive design for all screen sizes

### 5. Progressive Enhancement
- Core functionality works without JavaScript
- Enhanced experience with modern browsers
- Graceful degradation for older devices

---

## 🛠️ Technology Stack

### Frontend

| Technology | Purpose | Version |
|------------|---------|---------|
| **Vue 3** | Progressive JavaScript framework | Latest |
| **TypeScript** | Type-safe JavaScript | 5.x |
| **Vite** | Build tool and dev server | Latest |
| **Vuetify 3** | Material Design component library | 3.x |
| **Pinia** | State management | Latest |
| **Vue Router** | Client-side routing | 4.x |

### Backend & Infrastructure

| Technology | Purpose | Notes |
|------------|---------|-------|
| **Firebase** | Backend-as-a-Service platform | Full platform |
| **Firestore** | NoSQL document database | Real-time sync |
| **Firebase Auth** | User authentication | Email/password, Google |
| **Cloud Functions** | Serverless business logic | Node.js runtime |
| **Firebase Hosting** | Global CDN and hosting | SSL, PWA support |
| **brackets-manager** | Tournament bracket algorithms | npm library |

### Development & Testing

| Technology | Purpose |
|------------|---------|
| **Vitest** | Unit testing framework |
| **Playwright** | E2E browser automation |
| **ESLint** | Code linting |
| **TypeScript Compiler** | Type checking |

---

## 🏗️ System Architecture

### High-Level Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                        Clients                                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Desktop   │  │   Tablet    │  │       Mobile        │  │
│  │   (Admin)   │  │(Scorekeeper)│  │      (Player)       │  │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │
└─────────┼────────────────┼────────────────────┼─────────────┘
          │                │                    │
          └────────────────┴────────────────────┘
                             │ HTTPS/WSS
                             ▼
┌──────────────────────────────────────────────────────────────┐
│                    Firebase Platform                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │   Hosting    │  │     Auth     │  │    Firestore     │   │
│  │     CDN      │  │   (Roles)    │  │  (Real-time DB)  │   │
│  └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘   │
│         │                 │                    │            │
│         └─────────────────┴────────────────────┘            │
│                           │                                  │
│                           ▼                                  │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              Cloud Functions (Node.js)                  │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐   │ │
│  │  │   Bracket   │  │  Schedule   │  │    Other     │   │ │
│  │  │  Generator  │  │   Engine    │  │   Logic      │   │ │
│  │  └─────────────┘  └─────────────┘  └──────────────┘   │ │
│  └────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

### Request Flow

```
1. User Action (Score Point)
   │
   ▼
2. Vue Component
   - Optimistic UI update
   - Firestore write
   │
   ▼
3. Firestore Document Update
   - serverTimestamp()
   - Transaction (if needed)
   │
   ▼
4. Real-time Sync
   - Listeners notify all clients
   - UI updates automatically
   │
   ▼
5. Cloud Function Trigger (if needed)
   - Bracket advancement
   - Audit logging
   - Notifications
```

---

## 🗄️ Data Architecture

### Dual Collection Model

CourtMastr uses a **dual collection approach** to balance library compatibility with operational flexibility:

```
tournaments/{tournamentId}/
├── categories/{categoryId}/
│   ├── match/              # Read-only (brackets-manager)
│   │   ├── {matchId}      # Bracket structure, opponents
│   │   └── ...
│   ├── match_scores/       # Operational (app-managed)
│   │   ├── {matchId}      # Scores, courts, status
│   │   └── ...
│   └── registrations/      # Player registrations
├── courts/                 # Court management
└── registrations/          # Tournament-level registrations
```

**Rationale**:
- `/match`: Managed by brackets-manager library (read-only to app)
- `/match_scores`: App-managed operational data (scores, assignments)
- Separation allows flexibility without breaking library integration

### Key Data Rules

| Rule | Rationale |
|------|-----------|
| `participant.name` = registration ID | brackets-manager uses name field for IDs |
| `participant.id` = numeric internal | Library's internal identifier only |
| Use `serverTimestamp()` | Avoid client clock drift issues |
| Tournament-scoped collections | Enable clean security rules |

### Data Flow Example: Match Scoring

```
1. Scorekeeper taps "+1 Point"
   │
   ▼
2. Update match_scores/{matchId}
   {
     scores: [...],
     status: 'in_progress',
     updatedAt: serverTimestamp()
   }
   │
   ▼
3. Cloud Function triggered (optional)
   - Check if match is complete
   - If complete:
     a. Update brackets-manager match status
     b. Advance winner to next round
     c. Log audit entry
   │
   ▼
4. All clients receive update
   - Bracket view updates
   - Public view updates
   - Scorekeeper sees confirmation
```

---

## 🎨 Frontend Architecture

### Component Architecture

```
src/
├── components/
│   ├── common/           # Reusable UI components
│   │   ├── StatusBadge.vue
│   │   ├── LoadingSpinner.vue
│   │   └── ErrorMessage.vue
│   ├── navigation/       # Navigation components
│   ├── tournament/       # Tournament-specific
│   └── scoring/          # Scoring interface
├── views/                # Page-level components
├── composables/          # Reusable logic
│   ├── useMatchScheduler.ts
│   ├── useParticipantResolver.ts
│   └── useTournamentSetup.ts
├── stores/               # Pinia stores
│   ├── tournaments.ts
│   ├── matches.ts
│   └── auth.ts
└── services/             # External integrations
    └── firebase.ts
```

### State Management (Pinia)

**Setup Store Pattern**:

```typescript
export const useTournamentStore = defineStore('tournaments', () => {
  // State
  const tournaments = ref<Tournament[]>([]);
  const loading = ref(false);
  
  // Getters
  const activeTournaments = computed(() => 
    tournaments.value.filter(t => t.status === 'active')
  );
  
  // Actions
  async function createTournament(data: TournamentInput) {
    loading.value = true;
    try {
      const docRef = await addDoc(collection(db, 'tournaments'), {
        ...data,
        createdAt: serverTimestamp()
      });
      return docRef.id;
    } finally {
      loading.value = false;
    }
  }
  
  // Must return everything
  return { 
    tournaments, 
    loading, 
    activeTournaments, 
    createTournament 
  };
});
```

### Composables Pattern

**Reusable logic with state**:

```typescript
export function useMatchScheduler() {
  const loading = ref(false);
  const error = ref<string | null>(null);
  
  async function scheduleMatches(
    tournamentId: string, 
    options: ScheduleOptions
  ) {
    loading.value = true;
    error.value = null;
    
    try {
      // Implementation
      return result;
    } catch (err) {
      error.value = err.message;
      throw err;
    } finally {
      loading.value = false;
    }
  }
  
  return { 
    loading, 
    error, 
    scheduleMatches 
  };
}
```

---

## ⚙️ Backend Architecture

### Cloud Functions

**Organization**:

```
functions/src/
├── index.ts              # Function exports
├── bracket.ts            # Bracket generation
├── scheduling.ts         # Match scheduling
├── updateMatch.ts        # Match updates with advancement
└── storage/
    └── firestore-adapter.ts  # brackets-manager adapter
```

**Function Types**:

1. **HTTPS Callable**: Client-invoked operations
   - `updateMatch`: Update scores with bracket advancement
   - `generateBracket`: Create tournament brackets

2. **Firestore Triggers**: Event-driven operations
   - Audit logging on match updates
   - Notifications on bracket completion

### Bracket Generation Flow

```
1. Admin clicks "Generate Bracket"
   │
   ▼
2. Cloud Function invoked
   - Get approved registrations
   - Sort by seed
   - Calculate bracket size (power of 2)
   │
   ▼
3. brackets-manager library
   - Create stage
   - Generate matches
   - Assign opponents
   │
   ▼
4. Store in Firestore
   - /match collection (structure)
   - /match_scores docs (operational)
   │
   ▼
5. Return success
   - Update category status
   - Notify clients via listeners
```

---

## 🔒 Security Architecture

### Authentication

- **Firebase Auth** with email/password and Google OAuth
- **Role-based access control** (RBAC):
  - `admin`: Full system access
  - `organizer`: Tournament management
  - `scorekeeper`: Match scoring
  - `player`: Self-service registration
  - `viewer`: Public bracket viewing

### Authorization

**Firestore Security Rules**:

```
// Tournament data - scoped access
match /tournaments/{tournamentId} {
  allow read: if isAuthenticated();
  allow write: if isAdmin() || isOrganizer(tournamentId);
}

// Match scores - role-based
match /tournaments/{tournamentId}/categories/{categoryId}/match_scores/{matchId} {
  allow read: if isAuthenticated();
  allow write: if isScorekeeper(tournamentId) || isAdmin();
}

// Public brackets - unauthenticated read
match /tournaments/{tournamentId}/categories/{categoryId}/match/{matchId} {
  allow read: if true;  // Public access
  allow write: if false; // Read-only (managed by Cloud Functions)
}
```

### Data Protection

- **HTTPS everywhere** (Firebase Hosting enforces)
- **No sensitive data in logs** (log IDs, not names/emails)
- **Parameterized queries** (prevent injection)
- **Input validation** on Cloud Functions

---

## 🚀 Deployment Architecture

### Environments

| Environment | Purpose | Data |
|-------------|---------|------|
| **Development** | Local development | Emulator data (ephemeral) |
| **Staging** | Pre-production testing | Production-like (anonymized) |
| **Production** | Live tournaments | Real user data |

### Deployment Pipeline

```
Developer
   │
   ▼ (push to branch)
GitHub
   │
   ▼ (PR created)
CI/CD
   ├─▶ Lint check
   ├─▶ Type check
   ├─▶ Unit tests
   └─▶ Build verification
   │
   ▼ (all pass)
Code Review
   │
   ▼ (approved)
Merge to main
   │
   ▼ (auto-deploy)
Firebase
   ├─▶ Hosting (frontend)
   └─▶ Functions (backend)
```

### Rollback Strategy

1. **Firebase Hosting**: Instant rollback to previous version
2. **Cloud Functions**: Deploy previous version
3. **Firestore**: No rollback (forward-only migrations)

See [Rollback Plan](docs/architecture/ROLLBACK_PLAN.md) for details.

---

## 📈 Scalability Considerations

### Current Limits

| Resource | Current | Scalable To | Strategy |
|----------|---------|-------------|----------|
| Concurrent users | 100 | 10,000 | Firebase auto-scaling |
| Tournament size | 64 players | 256+ | Chunked processing |
| Real-time listeners | 100/client | Firebase limits | Pagination, lazy loading |
| Firestore writes | 1/second/doc | Unlimited | Distributed writes |

### Performance Optimizations

1. **Pagination**: Tournament lists, match lists
2. **Lazy loading**: Load data as needed
3. **Composite indexes**: Optimize common queries
4. **Denormalization**: Reduce query complexity
5. **Caching**: Pinia stores, Firestore cache

### Future Scalability

- **Firestore sharding** if tournament count grows
- **CDN optimization** for static assets
- **Function regionalization** for global tournaments

---

## 🎯 Key Architectural Decisions

### 1. Firebase (BaaS) vs Self-Hosted

**Decision**: Use Firebase Platform

**Why**: 80% faster development; integrated real-time sync; zero devops overhead

**Trade-off**: Vendor lock-in; ongoing operational costs

### 2. Firestore (NoSQL) vs PostgreSQL

**Decision**: Use Firestore document database

**Why**: Real-time sync essential to UX; offline persistence required; pay-per-use fits sporadic usage

**Trade-off**: Limited querying; denormalization required

### 3. PWA vs Native Mobile Apps

**Decision**: Build as PWA

**Why**: 3x faster development; single codebase; offline support sufficient

**Trade-off**: Limited device access; no app store discoverability

### 4. Vue 3 vs React

**Decision**: Use Vue 3 with Composition API

**Why**: Cleaner state management; excellent TypeScript support; faster development for this use case

**Trade-off**: Smaller ecosystem; smaller hiring pool

### 5. Dual Collection Data Model

**Decision**: Separate `/match` (library) and `/match_scores` (app)

**Why**: brackets-manager compatibility + operational flexibility

**Trade-off**: Data duplication; query complexity

See [Decisions Log](../.opencode/context/project-intelligence/decisions-log.md) for complete rationale.

---

## 📚 Additional Resources

- **[Technical Domain](../.opencode/context/project-intelligence/technical-domain.md)** - Implementation details
- **[Data Model Rules](migration/DATA_MODEL_MIGRATION_RULES.md)** - Critical data guidelines
- **[TDD](TDD.md)** - Technical design document
- **[Decisions Log](../.opencode/context/project-intelligence/decisions-log.md)** - Architectural decisions

---

*Last Updated: 2026-02-17*
