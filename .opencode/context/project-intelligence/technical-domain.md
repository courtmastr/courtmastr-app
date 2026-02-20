<!-- Context: project-intelligence/technical | Priority: critical | Version: 1.1 | Updated: 2026-02-17 -->

# Technical Domain

> CourtMaster v2: Vue 3 + Firebase tournament management system

## Quick Reference

- **Stack**: Vue 3 + TypeScript + Firebase + Vuetify 3
- **Pattern**: Serverless PWA with real-time Firestore sync
- **State**: Pinia Setup Stores with Firestore listeners
- **Update**: New features, refactoring, tech changes

## Primary Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Frontend | Vue 3 + Vite | Composition API, fast HMR, TypeScript-native |
| UI | Vuetify 3 | Material Design, responsive for mobile scorekeepers |
| State | Pinia | Official Vue 3 store, devtools support |
| Database | Firestore | Real-time sync, offline support, auto-scaling |
| Auth | Firebase Auth | Secure, multiple providers, easy integration |
| Backend | Cloud Functions | Serverless, auto-scaling, Firebase-native |
| Hosting | Firebase Hosting | Global CDN, SSL, PWA support |

## Architecture

**Type**: Serverless Cloud-Native PWA

**Why**: Firestore enables real-time scoring without WebSocket management; PWA works offline at venues with poor connectivity; pay-per-use pricing aligns with sporadic tournament events.

## Project Structure

```
src/
├── components/     # PascalCase .vue files (common/, navigation/, leaderboard/)
├── composables/    # use*.ts - reusable logic (useMatchScheduler, etc.)
├── stores/         # Pinia Setup Stores (useTournamentStore, etc.)
├── services/       # Firebase init & external integrations
├── features/       # Feature-based views
└── types/          # Central TypeScript definitions
functions/src/      # Cloud Functions (updateMatch, bracket, scheduling)
tests/             # Vitest unit tests + Playwright E2E
docs/              # Documentation
```

## Code Patterns

### Cloud Function
```typescript
export const updateMatch = functions.https.onCall(async (request) => {
  if (!request.auth) throw new functions.https.HttpsError('unauthenticated', ...);
  const { tournamentId, matchId } = request.data;
  console.log('🎯 [updateMatch]', { tournamentId, matchId });
  await db.collection('tournaments').doc(tournamentId)
    .collection('match_scores').doc(matchId).set({ ... }, { merge: true });
  return { success: true };
});
```

### Pinia Store (Setup Pattern)
```typescript
export const useTournamentStore = defineStore('tournaments', () => {
  const tournaments = ref<Tournament[]>([]);           // State
  const activeTournaments = computed(() => ...);       // Getters
  async function createTournament(data) { ... }        // Actions
  return { tournaments, activeTournaments, createTournament }; // Explicit return
});
```

### Composable
```typescript
export function useParticipantResolver() {
  const registrations = computed(() => useRegistrationStore().registrations);
  function getParticipantName(id: string) {
    const reg = registrations.value.find(r => r.id === id);
    return reg?.teamName || players.value.find(p => p.id === reg?.playerId)?.name || 'TBD';
  }
  return { getParticipantName };
}
```

### Vue Component
```vue
<script setup lang="ts">
interface Props { status: string; type?: 'match' | 'registration' }
const props = withDefaults(defineProps<Props>(), { type: 'general' });
const statusConfig = computed(() => /* mapping logic */);
</script>
<template>
  <v-chip :color="statusConfig.color" variant="tonal" label>
    {{ statusConfig.label }}
  </v-chip>
</template>
```

## Naming Conventions

| Type | Pattern | Example |
|------|---------|---------|
| Files | kebab-case | `use-match-scheduler.ts` |
| Components | PascalCase | `StatusBadge.vue` |
| Functions | camelCase | `getParticipantName()` |
| Composables | `use` + camelCase | `useTournamentStore` |
| Types | PascalCase | `Tournament`, `MatchStatus` |
| Constants | UPPER_SNAKE | `USE_CLOUD_FUNCTION` |
| DB Collections | snake_case | `match_scores` |

## Standards

1. **Vue 3**: `<script setup lang="ts">` + Composition API
2. **TypeScript**: Strict mode, no `any`, explicit return types
3. **Imports**: Vue → Router → Pinia → composables → services → types
4. **UI**: Vuetify 3 components only (`v-card`, `v-btn`, etc.)
5. **Errors**: Try/catch with context, log with emoji prefixes, re-throw
6. **Firebase**: Use `serverTimestamp()`, never `new Date()`
7. **Listeners**: Always unsubscribe in cleanup functions
8. **Audit**: Log all important actions via `useAuditStore`
9. **Data Model**:
   - `/match` = bracket structure (read-only, brackets-manager)
   - `/match_scores` = operational data (scores, courts, status)
   - `participant.name` = registration ID (not `participant.id`)

## Security

- **Auth**: All Cloud Functions verify `request.auth`
- **Validation**: Explicit input checks with `HttpsError`
- **Queries**: Firestore builders only, never string concatenation
- **Isolation**: Tournament-scoped collections
- **Logging**: Log IDs, not PII
- **HTTPS**: Enforced by Firebase

## 📂 Codebase References

### Core Components
| Component | Location | Purpose | Docs |
|-----------|----------|---------|------|
| **BaseDialog** | `src/components/common/BaseDialog.vue` | Standardized dialog wrapper | [UI-001](../../docs/ui-patterns/base-dialog.md) |
| **EmptyState** | `src/components/common/EmptyState.vue` | Empty state for lists | [UI-002](../../docs/ui-patterns/empty-state.md) |
| **StatusBadge** | `src/components/common/StatusBadge.vue` | Status display chip | - |

### Composables
| Composable | Location | Purpose | Docs |
|------------|----------|---------|------|
| **useAsyncOperation** | `src/composables/useAsyncOperation.ts` | Async operation state management | [COMP-001](../../docs/ui-patterns/use-async-operation.md) |
| **useDialogManager** | `src/composables/useDialogManager.ts` | Dialog state management | - |
| **useParticipantResolver** | `src/composables/useParticipantResolver.ts` | Participant name resolution | - |
| **useMatchScheduler** | `src/composables/useMatchScheduler.ts` | Match scheduling logic | - |
| **useBracketGenerator** | `src/composables/useBracketGenerator.ts` | Bracket generation | - |

### Other References
**Functions**: `functions/src/updateMatch.ts`, `bracket.ts`, `scheduling.ts`
**Stores**: `src/stores/tournaments.ts`, `auth.ts`, `matches.ts`
**Services**: `src/services/firebase.ts`
**Config**: `package.json`, `vite.config.ts`, `firebase.json`

## Dev & Deploy

```bash
# Setup
npm install

# Dev
npm run dev          # Vite on :3002
npm run emulators    # Firebase emulators

# Test
npm run test         # Vitest
npx playwright test  # E2E

# Deploy
npm run deploy       # Build + Firebase deploy
```

## Related

- `business-domain.md` - Why this exists
- `business-tech-bridge.md` - Business→technical mapping
- `decisions-log.md` - Decision history
