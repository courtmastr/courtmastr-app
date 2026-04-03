# Seed Scripts

Populates tournaments with realistic test data — identical in both local and production environments so you can be confident that what you test locally is what runs in prod.

## Files

```
scripts/seed/
  helpers.ts                 Shared auth utility (createOrSignIn)
  core.ts                    All test data and business logic (default seed)
  local.ts                   Entry point for local emulators (default seed)
  production.ts              Entry point for real Firebase (default seed)
  tnf2025-core.ts            TNF 2025 tournament logic (shared)
  tnf2025-data.ts            TNF 2025 raw registration data
  tnf2025-local.ts           TNF 2025 for local emulators
  tnf2025-prod.ts            TNF 2025 for production
  tnf2026-core.ts            TNF 2026 workbook-driven tournament logic (shared)
  tnf2026-local.ts           TNF 2026 for local emulators
  tnf2026-prod.ts            TNF 2026 for production
  spring2025-local.ts        Spring Classic 2025 for local emulators
  spring2025-prod.ts         Spring Classic 2025 for production
  player-identity-core.ts    Player identity v2 merge-test logic (shared local data model)
  player-identity-local.ts   Player identity v2 merge-test seed for local emulators
  mcia2026-core.ts           MCIA 2026 tournament logic (shared)
  mcia2026-local.ts          MCIA 2026 for local emulators
  migrate-organizer-ids.ts   One-time migration: backfill organizerIds field
  README.md                  This file
```

`core.ts` and `tnf2025-core.ts` are the single source of truth for seed data. **Never edit entry point files to change test data** — edit the core files only. `helpers.ts` holds shared auth logic used by all entry points.

---

## Available Seeds

### 1. Default Seed (Seed Tournament - Levels Ready)

A tournament with 3 categories for testing pool-to-elimination flows.
`seed:local` now also appends the MCIA 2026 Men's Doubles tournament dataset.

| Category | Format | Participants | Notes |
|---|---|---|---|
| Men's Singles | Single elimination | 15 players | |
| Men's Doubles | Pool → elimination | 23 teams | Pool matches pre-completed, ready for "Create Levels" |
| Mixed Doubles | Double elimination | 13 teams | |

**Cross-category players** (edge-case coverage):
- 4 Men's Singles players also appear in Men's Doubles
- 8 Men's Singles players also appear in Mixed Doubles

### 2. TNF 2025 Seed

Full tournament from static TS data with 5 categories.

| Category | Type | Source |
|---|---|---|
| Men's Singles | Singles | Static Data |
| Men's Doubles | Doubles | Static Data |
| Women's Doubles | Doubles | Static Data |
| Mixed Doubles | Mixed Doubles | Static Data |


### 3. Spring Classic 2025 Seed

A second tournament for testing multi-tournament scenarios.

| Category | Type | Status |
|---|---|---|
| Men's Singles | Singles | Draft (ready for registration) |
| Women's Singles | Singles | Draft (ready for registration) |
| Men's Doubles | Doubles | Draft (ready for registration) |
| Women's Doubles | Doubles | Draft (ready for registration) |
| Mixed Doubles | Mixed Doubles | Draft (ready for registration) |

### 4. Player Identity Merge Lab

Targeted local-only dataset for player identity v2 manual testing.

What it creates:
- One tournament: `Player Identity Merge Lab`
- A primary-registration merge success case
- A partner-registration merge success case
- A same-team merge rejection case
- An inactive-target rejection case

The script prints the exact source/target player IDs and merge-route URLs after seeding.

---

## Commands

### Default Seed (Local - emulators)

```bash
# Start emulators first
npm run emulators

# In another terminal
npm run seed:local
```

### Default Seed (Production)

```bash
npm run seed:prod
```

### TNF 2025 Seed (Local - emulators)

```bash
# Start emulators first
npm run emulators

# In another terminal
npm run seed:tnf2025:local
```

### TNF 2025 Seed (Production)

```bash
npm run seed:tnf2025:prod
```

### Spring Classic 2025 Seed (Local - emulators)

```bash
# Start emulators first
npm run emulators

# In another terminal
npm run seed:spring2025:local
```

### Spring Classic 2025 Seed (Production)

```bash
npm run seed:spring2025:prod
```

### MCIA 2026 Seed (Local - emulators)

```bash
# Start emulators first
npm run emulators

# In another terminal
npm run seed:mcia2026:local
```

### TNF 2026 Seed (Local - emulators)

```bash
# Start emulators first
npm run emulators

# In another terminal
npm run seed:tnf2026:local
```

### TNF 2026 Seed (Production)

```bash
npm run seed:tnf2026:prod
```

### Player Identity Merge Lab (Local - emulators)

```bash
# Start emulators first
npm run emulators

# In another terminal
npm run seed:player-identity:local
```

### MCIA 2026 Pool Results Updater (Local - emulators)

```bash
# Easiest: auto-find latest "MCIA Badminton 2026" + "Men's Doubles"
npm run results:mcia2026:local

# Apply all provided Group A-G results to an existing generated pool bracket
npm run results:mcia2026:local -- --tournament <tournamentId> --category <categoryId>

# Validate mapping without writing
npm run results:mcia2026:local -- --dry-run
npm run results:mcia2026:local -- --tournament <tournamentId> --category <categoryId> --dry-run
```

---

## Requirements

### For TNF 2025 Seeds

There are no external file dependencies. The data is statically tracked in `tnf2025-data.ts`.

### For TNF 2026 Seeds

The workbook `TNF USA - Central Illinois Chapter Badminton Tournament 2026.xlsx` must exist in the project root.

### For All Seeds

Emulators (for local seeds) must be running on default ports:
- Auth: 9099
- Firestore: 8080

Production seeds have no prerequisites — admin user is created automatically on first run if it doesn't already exist. The script pauses 5 seconds on startup so you can abort with `Ctrl+C`.

---

## Login credentials

| Role | Email | Password | Created by |
|---|---|---|---|
| Admin | `admin@courtmastr.com` | `admin123` | All seeds |
| Scorekeeper | `scorekeeper@courtmastr.com` | `score123` | `local.ts` / `production.ts` only |

---

## Modifying test data

### Default Seed
Edit `core.ts` — `CATEGORY_CONFIGS` for categories, the `buildRoster` calls in `createPlayersAndRegistrations` for player counts.

### Player Identity Merge Lab
Edit `player-identity-core.ts` — named merge cases, tournament scaffold, and guard scenarios.

### TNF 2025 Seed
Edit `tnf2025-core.ts` — the category configs and player creation logic.

### TNF 2026 Seed
Edit `tnf2026-core.ts` — the workbook parsing, category configs, and player import logic.

### Spring Classic 2025 Seed
Edit `spring2025-local.ts` or `spring2025-prod.ts` directly (keep both in sync — they don't share a core file as they're simpler tournament scaffolds).

All environments pick up changes on the next run automatically.

---

## Production Deployment Checklist

When seeding production with 2 tournaments:

1. **Seed TNF 2025:**
   ```bash
   npm run seed:tnf2025:prod
   ```

2. **Seed Spring Classic 2025:**
   ```bash
   npm run seed:spring2025:prod
   ```

This ensures production has:
- 2025_Tnf tournament (from static TS data, 5 categories, LIVE status)
- Spring Classic 2025 tournament (5 categories, draft status for registration testing)
