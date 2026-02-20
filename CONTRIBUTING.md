# Contributing to CourtMaster v2

Thank you for your interest in contributing to CourtMaster! This document provides guidelines and best practices for contributing to the project.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Code Standards](#code-standards)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)
- [Testing](#testing)
- [Documentation](#documentation)
- [Getting Help](#getting-help)

---

## 🤝 Code of Conduct

This project adheres to a code of conduct. By participating, you are expected to:

- Be respectful and inclusive
- Welcome newcomers
- Focus on constructive feedback
- Respect different viewpoints and experiences

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- Firebase CLI
- Git

### Setup

```bash
# Fork the repository on GitHub
git clone https://github.com/YOUR_USERNAME/courtmaster-v2.git
cd courtmaster-v2
npm install

# Copy environment template
cp .env.template .env.development
# Edit .env.development with your Firebase credentials

# Start development
npm run emulators  # Terminal 1
npm run dev        # Terminal 2
```

See [README.md](../README.md) for detailed setup instructions.

---

## 🔄 Development Workflow

### 1. Create a Branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/issue-description
```

**Branch naming conventions:**
- `feature/description` - New features
- `fix/description` - Bug fixes
- `docs/description` - Documentation updates
- `refactor/description` - Code refactoring
- `test/description` - Test additions/improvements

### 2. Make Changes

- Follow [code standards](#code-standards)
- Write tests for new functionality
- Update documentation as needed
- Keep commits focused and atomic

### 3. Test Your Changes

```bash
# Run tests
npm run test -- --run

# Run type checking
npm run type-check

# Run linting
npm run lint

# Build for production
npm run build
```

### 4. Commit

See [Commit Guidelines](#commit-guidelines) below.

### 5. Push and Create PR

```bash
git push origin feature/your-feature-name
```

Then create a Pull Request on GitHub.

---

## 📝 Code Standards

### TypeScript

- **Strict mode enabled** - No `any` types
- **Explicit return types** on exported functions
- **Use `interface`** for object shapes, `type` for unions/aliases

```typescript
// ✅ Good
interface Match {
  id: string;
  status: MatchStatus;
  scores: Score[];
}

async function createMatch(data: MatchInput): Promise<Match> {
  // implementation
}

// ❌ Bad
function createMatch(data: any): any {
  // implementation
}
```

### Vue 3

- Use **Composition API** with `<script setup lang="ts">`
- **Import order**: Vue → Router → Pinia → composables → services → types
- **Return all** state, getters, and actions from Pinia stores
- Use **Vuetify components** exclusively

```vue
<!-- ✅ Good -->
<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useTournamentStore } from '@/stores/tournaments';
import { useMatchScheduler } from '@/composables/useMatchScheduler';
import { db } from '@/services/firebase';
import type { Match } from '@/types';

const router = useRouter();
const tournamentStore = useTournamentStore();
const { scheduleMatches } = useMatchScheduler();

const activeMatches = computed(() => 
  tournamentStore.matches.filter(m => m.status === 'in_progress')
);
</script>
```

### Naming Conventions

| Type | Convention | Example |
|------|-----------|---------|
| Files | kebab-case | `use-match-scheduler.ts` |
| Components | PascalCase | `StatusBadge.vue` |
| Composables | camelCase with `use` | `useTournamentStore` |
| Functions | camelCase | `getParticipantName()` |
| Types | PascalCase | `Tournament`, `MatchStatus` |
| Constants | UPPER_SNAKE | `USE_CLOUD_FUNCTION` |

### Error Handling

- Use **try/catch** with explicit error messages
- **Log with context** using emoji prefixes (🎯, ❌, ✅)
- **Re-throw** after logging for upstream handling
- **Never suppress** errors silently

```typescript
// ✅ Good
try {
  console.log('🎯 [updateMatch] Starting update:', { matchId, scores });
  await updateMatchScores(matchId, scores);
  console.log('✅ [updateMatch] Success:', matchId);
} catch (error) {
  console.error('❌ [updateMatch] Failed:', error);
  throw new Error(`Failed to update match ${matchId}: ${error.message}`);
}

// ❌ Bad
try {
  await updateMatchScores(matchId, scores);
} catch (error) {
  // Silently suppressed - BAD!
}
```

### Firebase Best Practices

- Use **`serverTimestamp()`**, never `new Date()`
- Always **unsubscribe** from Firestore listeners in cleanup
- Use **writeBatch** for multi-document updates
- Follow **[DATA_MODEL_MIGRATION_RULES](docs/migration/DATA_MODEL_MIGRATION_RULES.md)**

```typescript
// ✅ Good
import { serverTimestamp, writeBatch } from 'firebase/firestore';

const batch = writeBatch(db);
batch.update(matchRef, { 
  status: 'completed',
  updatedAt: serverTimestamp() 
});
batch.update(courtRef, { 
  status: 'available',
  updatedAt: serverTimestamp() 
});
await batch.commit();

// Cleanup listeners
onUnmounted(() => {
  unsubscribeTournament?.();
});
```

See **[Coding Patterns](docs/coding-patterns/CODING_PATTERNS.md)** for complete guidelines.

---

## 💬 Commit Guidelines

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

| Type | Description |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `style` | Code style (formatting, no logic change) |
| `refactor` | Code refactoring |
| `perf` | Performance improvement |
| `test` | Adding/updating tests |
| `chore` | Build process, dependencies, etc. |

### Scope

Optional scope indicating the affected area:

- `tournament` - Tournament management
- `scoring` - Match scoring
- `bracket` - Bracket generation
- `registration` - Player registration
- `ui` - UI components
- `api` - Cloud Functions
- `db` - Database/Firestore

### Examples

```
feat(scoring): add score correction with audit trail

- Allow admins to correct scores post-match
- Log all corrections to audit collection
- Show correction history in match details
- Add permission check for scorekeeper role

Closes #123
```

```
fix(bracket): resolve bracket generation for >64 players

- Implement chunked processing in Cloud Function
- Process participants in batches of 64
- Add progress tracking for large tournaments

Fixes #456
```

```
docs(readme): update deployment instructions

- Add Firebase Blaze plan requirement
- Clarify environment variable setup
- Add troubleshooting section
```

---

## 🔍 Pull Request Process

### Before Submitting

- [ ] Branch is up-to-date with `main`
- [ ] All tests pass (`npm run test -- --run`)
- [ ] Type checking passes (`npm run type-check`)
- [ ] Linting passes (`npm run lint`)
- [ ] Build succeeds (`npm run build`)
- [ ] Documentation updated if needed
- [ ] Commit messages follow conventions

### PR Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests added/updated
- [ ] E2E tests added/updated
- [ ] Manual testing performed

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex logic
- [ ] Documentation updated
- [ ] No console.log statements left

## Related Issues
Fixes #(issue number)
```

### Review Process

1. **Automated checks** must pass (CI/CD)
2. **Code review** by at least one maintainer
3. **Approval** required before merge
4. **Squash merge** preferred for clean history

---

## 🧪 Testing

### Test Coverage Requirements

- **New features**: Must include unit tests
- **Bug fixes**: Must include regression test
- **Target coverage**: 80%

### Running Tests

```bash
# Unit tests (watch mode)
npm run test

# Unit tests (single run)
npm run test -- --run

# E2E tests
npx playwright test

# Specific test file
npm run test -- tests/unit/scoring.test.ts
```

### Writing Tests

```typescript
// Example unit test
import { describe, it, expect } from 'vitest';
import { useMatchScheduler } from '@/composables/useMatchScheduler';

describe('useMatchScheduler', () => {
  it('should schedule matches respecting rest time', async () => {
    const { scheduleMatches } = useMatchScheduler();
    
    const result = await scheduleMatches(tournamentId, {
      categoryId: 'cat-123',
      courtIds: ['court-1', 'court-2'],
      restTime: 30 // minutes
    });
    
    expect(result.scheduled).toBeGreaterThan(0);
    expect(result.unscheduled).toBe(0);
  });
});
```

---

## 📚 Documentation

### When to Update Documentation

Update documentation when you:
- Add new features
- Change APIs
- Fix bugs with workarounds
- Update dependencies
- Change development workflow

### Documentation Locations

- **README.md** - Project overview, setup
- **docs/PRD.md** - Product requirements
- **docs/TDD.md** - Technical design
- **docs/features/** - Feature specifications
- **.opencode/context/project-intelligence/** - AI/team context

### Code Documentation

```typescript
/**
 * Schedule matches to courts respecting rest time constraints
 * 
 * @param tournamentId - The tournament ID
 * @param options - Scheduling options
 * @returns Scheduling results with stats
 * 
 * @example
 * const result = await scheduleMatches('t-123', {
 *   categoryId: 'cat-456',
 *   courtIds: ['c-1', 'c-2'],
 *   restTime: 30
 * });
 */
export async function scheduleMatches(
  tournamentId: string,
  options: ScheduleOptions
): Promise<ScheduleResult> {
  // implementation
}
```

---

## 🆘 Getting Help

### Resources

1. **[Project Intelligence](../.opencode/context/project-intelligence/)** - Domain knowledge
2. **[Debug KB](docs/debug-kb/README.md)** - Troubleshooting
3. **[Coding Patterns](docs/coding-patterns/CODING_PATTERNS.md)** - Code standards
4. **[GitHub Issues](../../issues)** - Bug reports and discussions

### Questions?

- **Technical questions**: Open a [GitHub Discussion](../../discussions)
- **Bug reports**: Create an [issue](../../issues/new) with reproduction steps
- **Feature requests**: Create an issue with use case description

### Communication

- Be specific about your question or issue
- Include relevant code snippets
- Mention what you've already tried
- Tag relevant maintainers if urgent

---

## 🎉 Recognition

Contributors will be recognized in our README.md and release notes.

Thank you for contributing to CourtMaster! 🏸
