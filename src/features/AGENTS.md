# src/features/ — Feature Modules

**Architecture**: Feature-based organization with views and components

## Structure

Each feature follows this pattern:
```
features/<feature>/
├── views/           # Page-level components (routed)
└── components/      # Feature-specific components
```

## Features

| Feature | Purpose | Views |
|---------|---------|-------|
| `auth/` | Authentication | LoginView, RegisterView |
| `tournaments/` | Tournament management | List, Create, Dashboard, Settings, MatchControl |
| `registration/` | Player registration | Management, SelfRegistration |
| `scoring/` | Match scoring | ScoringInterface, MatchList |
| `brackets/` | Bracket visualization | BracketView, SmartBracketView, Standings |
| `public/` | Public-facing pages | Home, PublicBracket, LiveScores |

## Conventions

**Views:**
- Suffix with `View` (e.g., `TournamentListView.vue`)
- Routed components (defined in `src/router/index.ts`)
- Use `<script setup lang="ts">`
- Import stores at top, use composables for logic

**Components:**
- No `View` suffix (e.g., `CategoryManagement.vue`)
- Feature-specific, not shared across features
- Props/emit for parent communication

**Imports:**
```typescript
// Standard order
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useTournamentStore } from '@/stores/tournaments';
import { useAuthStore } from '@/stores/auth';
import type { Tournament } from '@/types';
```

## When to Add Here vs src/components/

**Add to `features/<feature>/components/` when:**
- Only used within one feature
- Tightly coupled to feature logic

**Add to `src/components/` when:**
- Used across multiple features
- Generic UI (layout, dialogs, activity feed)

## See Also

- Root `AGENTS.md` for project-wide rules
- `src/router/index.ts` for route definitions
- `src/types/index.ts` for domain types
