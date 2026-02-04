# src/stores/ — Pinia Stores

**Pattern**: Setup Store (composable-style)

## Conventions

**File Structure:**
```typescript
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export const useStoreName = defineStore('storeId', () => {
  // State
  const state = ref<Type>();
  
  // Getters
  const getter = computed(() => state.value);
  
  // Actions
  async function action(): Promise<void> {}
  
  // Return everything explicitly
  return { state, getter, action };
});
```

**State Management:**
- State: `ref<T>()` — reactive state
- Getters: `computed()` — derived state
- Actions: regular functions — async operations
- ALWAYS return all state/getters/actions at end

**Firebase Integration:**
- Import from `@/services/firebase`
- Use Firestore methods: `collection`, `doc`, `getDocs`, `onSnapshot`
- Convert Timestamps to Dates with helper function
- Unsubscribe from listeners in cleanup functions

**Error Handling:**
- Set `loading` and `error` refs
- Try/catch with context: `console.error('Action failed:', err)`
- Re-throw after logging for upstream handling

## Stores

| Store | Purpose | Key Exports |
|-------|---------|-------------|
| `auth.ts` | Firebase auth state | `useAuthStore`, `isAdmin`, `currentUser` |
| `tournaments.ts` | Tournament CRUD | `useTournamentStore`, bracket/scheduling |
| `matches.ts` | Match operations | `useMatchStore`, scoring, court assignment |
| `registrations.ts` | Player registration | `useRegistrationStore`, approval workflow |
| `bracketMatchAdapter.ts` | Bracket→Firestore bridge | `useBracketMatchAdapter` |
| `activities.ts` | Activity feed | `useActivityStore` |
| `notifications.ts` | Toast/snackbar | `useNotificationStore` |

## Anti-Patterns

❌ Never use Options API style stores
❌ Never forget to return state from store
❌ Never leave Firestore listeners unsubscribed
❌ Never suppress errors silently

## See Also

- Root `AGENTS.md` for project-wide rules
- `src/services/firebase.ts` for Firebase exports
- `docs/migration/DATA_MODEL_MIGRATION_RULES.md` for data rules
