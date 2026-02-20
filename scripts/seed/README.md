# Seed Scripts

Populates a tournament with realistic test data — identical in both local and production environments so you can be confident that what you test locally is what runs in prod.

## Files

```
scripts/seed/
  core.ts         All test data and business logic (shared)
  local.ts        Entry point for local emulators
  production.ts   Entry point for real Firebase
  README.md       This file
```

`core.ts` is the single source of truth. **Never edit local.ts or production.ts to change test data** — edit `core.ts` only.

---

## What gets seeded

One tournament with 3 categories, brackets fully generated:

| Category | Format | Participants | Notes |
|---|---|---|---|
| Men's Singles | Single elimination | 15 players | |
| Men's Doubles | Pool → elimination | 23 teams | Pool matches pre-completed, ready for "Create Levels" |
| Mixed Doubles | Double elimination | 13 teams | |

**Cross-category players** (edge-case coverage):
- 4 Men's Singles players also appear in Men's Doubles
- 8 Men's Singles players also appear in Mixed Doubles

---

## Commands

### Local (emulators)

```bash
# Start emulators first
npm run emulators

# In another terminal
npm run seed:local
```

Emulators must be running on the default ports (Auth: 9099, Firestore: 8080).
The admin user is created automatically if it doesn't exist yet.

### Production

```bash
npm run seed:prod
```

**Prerequisites** — create the admin user manually before running:
1. Firebase Console → Authentication → Users → Add user
   - Email: `admin@courtmastr.com`
   - Password: `admin123`
2. Firestore → `users/<uid>` document:
   ```json
   { "email": "admin@courtmastr.com", "displayName": "Tournament Admin", "role": "admin" }
   ```

The script pauses 5 seconds on startup so you can abort with `Ctrl+C`.

---

## Login credentials

| Role | Email | Password |
|---|---|---|
| Admin | `admin@courtmastr.com` | `admin123` |

---

## Modifying test data

Edit `core.ts` — `CATEGORY_CONFIGS` for categories, the `buildRoster` calls in `createPlayersAndRegistrations` for player counts.
Both environments will pick up the change on the next run automatically.
