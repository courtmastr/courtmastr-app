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
  spring2025-local.ts        Spring Classic 2025 for local emulators
  spring2025-prod.ts         Spring Classic 2025 for production
  migrate-organizer-ids.ts   One-time migration: backfill organizerIds field
  README.md                  This file
```

`core.ts` and `tnf2025-core.ts` are the single source of truth for seed data. **Never edit entry point files to change test data** — edit the core files only. `helpers.ts` holds shared auth logic used by all entry points.

---

## Available Seeds

### 1. Default Seed (Seed Tournament - Levels Ready)

A tournament with 3 categories for testing pool-to-elimination flows.

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

---

## Requirements

### For TNF 2025 Seeds

There are no external file dependencies. The data is statically tracked in `tnf2025-data.ts`.

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

### TNF 2025 Seed
Edit `tnf2025-core.ts` — the category configs and player creation logic.

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
