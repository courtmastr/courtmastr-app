# AGENTS.md — Agent Authority Contract

This document is **authoritative**. All agents MUST follow it. Violations constitute task failure.

---

## 1. Project Snapshot

**Stack**
- Frontend: Vue 3 + TypeScript + Vite
- UI: Vuetify 3 (Material Design only)
- State: Pinia (no Vuex)
- Backend: Firebase (Firestore, Auth, Cloud Functions, Hosting)
- PWA: Vite PWA Plugin
- Test: Vitest + @vue/test-utils + happy-dom
- Package Manager: npm

**Repository Layout**
- Source: `src/` — Vue components, stores, composables, services
- Types: `src/types/index.ts` — central type definitions
- Tests: `tests/**/*.test.ts`
- Firebase: `functions/` — Cloud Functions
- Debug KB: `docs/debug-kb/` — error documentation

---

## 2. Commands

```bash
# Development
npm run dev              # Start dev server (port 3002)
npm run emulators        # Start Firebase emulators
npm run seed:simple      # Seed emulator with test data

# Build & Deploy
npm run build            # Type-check + build for production
npm run preview          # Preview production build locally
npm run deploy           # Build + deploy to Firebase

# Testing
npm run test             # Run tests in watch mode
npm run test -- tests/unit/scoring.test.ts   # Run single test file
npm run test -- --run    # Run tests once (CI mode)
npm run test:coverage    # Run tests with coverage report

# E2E Testing (Playwright)
npx playwright test                    # Run all E2E tests
npx playwright test --ui               # Run with UI mode
npx playwright test --headed           # Run in headed mode (see browser)
npx playwright show-report             # View test report

# E2E Testing (Agent-Browser for OpenCode)
./scripts/agent-browser.sh setup       # Setup agent-browser
./scripts/agent-browser.sh open        # Open app in agent-browser
./scripts/agent-browser.sh snapshot    # Get page snapshot
./scripts/agent-browser.sh login       # Login as admin
./scripts/agent-browser.sh test full   # Run full test flow
./scripts/agent-browser.sh debug       # Interactive debug mode

# Linting & Types
npm run lint             # ESLint with auto-fix
npm run type-check       # TypeScript check only

# Logging variants (use these)
npm run dev:log
npm run build:log
npm run test:log
npm run lint:log
npm run emulators:log
npm run deploy:log
```

---

## 3. Code Style Guidelines

**Vue Components**
- Use `<script setup lang="ts">` (Composition API)
- Import order: Vue → Vue Router → Pinia stores → composables → services → types
- Use Vuetify components exclusively (`v-card`, `v-btn`, etc.)
- Scoped styles only when needed: `<style scoped>`

**TypeScript**
- Strict mode enabled — no `any`, no `@ts-ignore`
- Explicit return types on exported functions
- Use `interface` for object shapes, `type` for unions/aliases
- Prefer `const` arrow functions: `const fn = (): void => {}`

**Naming Conventions**
- Components: PascalCase (`TournamentCard.vue`)
- Composables: camelCase starting with `use` (`useMatchScheduler.ts`)
- Stores: camelCase ending with `Store` (`tournaments.ts` exports `useTournamentStore`)
- Types/Interfaces: PascalCase (`Tournament`, `MatchStatus`)
- Constants: UPPER_SNAKE_CASE (`BADMINTON_CONFIG`)

**Imports & Paths**
- Use `@/` alias for all imports from `src/`
- Example: `import { useTournamentStore } from '@/stores/tournaments'`

**Error Handling**
- Try/catch with explicit error messages
- Log errors with context: `console.error('Error fetching tournament:', err)`
- Re-throw after logging for upstream handling
- Never suppress errors silently

**Pinia Stores**
- Use Setup Store pattern (composable-style)
- State: `ref()` — Getters: `computed()` — Actions: functions
- Return all state/getters/actions explicitly at end

---

## 4. Non-Negotiables

**MUST:**
- Make smallest possible change
- Reuse existing patterns, components, stores
- Search codebase before creating files
- Run `:log` commands after changes
- Follow Debug KB Protocol on failures

**MUST NOT:**
- Add dependencies unless instructed
- Refactor unrelated code
- Change linting/formatting rules
- Switch package manager
- Change Firestore rules unless instructed
- Weaken security to "make it work"
- Use `any` or suppress TypeScript errors

---

## 5. Debug KB Protocol

When a `:log` command fails, output shows:
```
Fingerprint: <8-char-id>
Log saved: docs/debug-kb/_artifacts/<file>.log
```

**On Failure:**
1. Capture the fingerprint
2. Search KB: `docs/debug-kb/<fingerprint>.md`, `docs/debug-kb/index.yml`
3. If entry exists: try Fix(final) first
4. If not: create from TEMPLATE.md
5. Record ONE attempt per change

**On Success:**
- Write Root cause (ONE sentence)
- Write Fix (final) with exact steps
- Write Verification with runnable commands
- Set status to ✅ fixed or 🟡 workaround

---

## 6. Data Model Rules

**Collection Usage:**
- `/match` = Bracket structure (brackets-manager, READ ONLY)
- `/match_scores` = Operational data (scores, courts, status)
- `/matches` = REMOVED (never reference)

**ID & Status:**
- All IDs stored as strings
- `/match_scores.status` (string) authoritative for UI
- `/match.status` (numeric 0-4) brackets-manager internal only

**Participant ID Pattern (CRITICAL):**
```typescript
// ✅ ALWAYS use participant.name for registration ID:
const registrationId = participant.name;  // Firestore doc ID

// ❌ NEVER use participant.id for registration lookups:
const registrationId = participant.id;    // Numeric brackets-manager ID only
```

Full rules: `docs/migration/DATA_MODEL_MIGRATION_RULES.md`

---

## 7. Where to Look

| Task | Location | Notes |
|------|----------|-------|
| Add new feature | `src/features/<feature>/` | Create views/ and components/ |
| Add shared component | `src/components/` | For layout, common UI |
| Add store | `src/stores/<name>.ts` | Use Setup Store pattern |
| Add composable | `src/composables/use<Name>.ts` | Must start with `use` |
| Add types | `src/types/index.ts` | Central type definitions |
| Add service | `src/services/<name>.ts` | External integrations |
| Add test | `tests/unit/<name>.test.ts` | Follow existing patterns |
| Add Cloud Function | `functions/src/<name>.ts` | Export from index.ts |

---

## 8. Agent Output Requirements

After completing a task, report:
- Files changed (full paths)
- Commands executed (exact)
- Fingerprints handled
- KB files created or updated
- Coding patterns added/updated (CP-NNN), if bug fix
- Verification evidence

---

## 9. Uncertainty Rule

If unsure about data shape, auth flow, Firestore rules, deployment behavior, or existing conventions: **STOP and ask one clarifying question.** Do NOT guess or invent behavior.

---

## 10. Subdirectory Guides

| Directory | Guide |
|-----------|-------|
| `src/stores/` | Setup Store pattern, Firebase listeners |
| `src/features/` | Feature-based organization |
| `src/composables/` | Reusable logic with `use` prefix |

---

## 11. Testing with Agent-Browser (For OpenCode)

**Overview**
Agent-browser is a headless browser automation CLI optimized for AI agents. It provides accessibility tree snapshots with deterministic refs (@e1, @e2) that reduce token usage by 93% compared to standard DOM dumps.

**Quick Start**
```bash
# Setup (one-time)
./scripts/agent-browser.sh setup

# Open app and get snapshot
./scripts/agent-browser.sh open http://localhost:3000
./scripts/agent-browser.sh snapshot

# Login as admin
./scripts/agent-browser.sh login

# Interactive debug mode
./scripts/agent-browser.sh debug
```

**Agent-Browser Commands**
```bash
agent-browser open <url>              # Navigate to URL
agent-browser snapshot -i -c          # Get interactive snapshot (compact)
agent-browser click @e5               # Click element by ref
agent-browser fill @e3 "text"         # Fill input by ref
agent-browser screenshot [path]       # Take screenshot
agent-browser close                   # Close browser
```

**Using in Code**
```typescript
import { AgentBrowser } from './e2e/utils/agent-browser';

const browser = new AgentBrowser();
await browser.open('http://localhost:3000');
const snapshot = await browser.snapshot();
// snapshot.data.refs contains @e1, @e2, etc.
await browser.click('@e5');
await browser.fill('@e3', 'admin@courtmaster.local');
```

**Integration with Playwright**
```typescript
import { test, expect } from './e2e/fixtures/agent-browser-fixtures';

test('example', async ({ page, agentBrowser }) => {
  // Use Playwright for structured testing
  await page.goto('/tournaments');
  
  // Use agent-browser for debugging
  await debugWithAgentBrowser(page, agentBrowser, 'Check tournament list');
});
```

**When to Use What**
| Task | Tool | Reason |
|------|------|--------|
| CI/CD automated testing | Playwright | Structured, reports, parallelization |
| Interactive debugging | Agent-browser | Real-time, snapshots, AI-optimized |
| Mobile testing | Agent-browser | iOS Simulator support |
| Quick smoke tests | Agent-browser | Fast CLI commands |
| Complex user flows | Both | Playwright structure + agent-browser debugging |

---

## 12. Coding Pattern Guide

**Location:** `docs/coding-patterns/CODING_PATTERNS.md`

This is a **living document** of anti-patterns and correct patterns learned from bug fixes. All agents MUST:

1. **Read before coding** — Scan relevant categories for known anti-patterns.
2. **Update after fixing bugs** — Run `/capture-pattern` workflow (see `.agent/workflows/capture-pattern.md`).

### Post-Fix Protocol (Mandatory)

After fixing **any** bug, before closing the task:

1. Add or update a pattern in `docs/coding-patterns/CODING_PATTERNS.md`
2. Include: anti-pattern code, correct pattern code, and a detection command
3. Run the detection command and report violations found
4. If a fix guide is needed (like `docs/fix/replace-native-dialogs.md`), create one in `docs/fix/`

### Quick Reference — Active Patterns

| ID | Category | Rule |
|----|----------|------|
| CP-001 | UI | No native `confirm()`/`alert()`/`prompt()` — use `v-dialog` |
| CP-002 | Data | Cross-collection refs need reverse lookup fallbacks |
| CP-003 | Data | Update both sides of relationships atomically (`writeBatch`) |
| CP-004 | Quality | No duplicate function declarations in same scope |
| CP-005 | Quality | Always show user feedback via `notificationStore.showToast` |
| CP-006 | Firestore | Use `serverTimestamp()`, never `new Date()` |

Full details and detection commands: `docs/coding-patterns/CODING_PATTERNS.md`

---

**Enforcement**: Any violation constitutes task failure.
