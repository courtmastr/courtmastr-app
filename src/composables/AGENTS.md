# src/composables/ — Reusable Logic

**Pattern**: Vue 3 Composition API functions starting with `use`

## Conventions

**Naming:**
- MUST start with `use` (e.g., `useMatchScheduler`)
- camelCase
- Descriptive of functionality

**Structure:**
```typescript
import { ref } from 'vue';

export function useFeatureName() {
  // Reactive state
  const loading = ref(false);
  const error = ref<string | null>(null);
  
  // Methods
  async function doSomething(): Promise<void> {
    loading.value = true;
    try {
      // implementation
    } catch (err) {
      console.error('Error:', err);
      error.value = 'Failed';
      throw err;
    } finally {
      loading.value = false;
    }
  }
  
  // Return public API
  return { loading, error, doSomething };
}
```

## Composables

| Composable | Purpose | Key Exports |
|------------|---------|-------------|
| `useMatchScheduler.ts` | Auto-schedule matches to courts | `scheduleMatches`, `clearSchedule` |
| `useBracketGenerator.ts` | Generate tournament brackets | `generateBracket`, `deleteBracket` |
| `useTournamentSetup.ts` | Tournament creation wizard | Setup flow logic |

## When to Use

**Create a composable when:**
- Logic is used across multiple components
- Complex stateful logic (not just utilities)
- Needs reactive state (refs, computed)
- Async operations with loading/error states

**Don't create when:**
- Simple utility function (use `src/utils/`)
- Only used in one component (keep inline)
- No reactive state needed

## See Also

- Root `AGENTS.md` for project-wide rules
- Vue docs: https://vuejs.org/guide/reusability/composables.html
