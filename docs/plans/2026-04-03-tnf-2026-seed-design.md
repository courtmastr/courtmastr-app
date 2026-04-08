# TNF 2026 Seed Refresh Design

**Date:** 2026-04-03
**Status:** Approved for implementation

## Goal

Refresh the TNF 2026 seed flow so both local and production load the same TNF workbook, create the TNF organization and organizer account, and seed a single tournament named `TNF Badminton - 2026`.

## Requirements

- Use workbook `TNF_Final_List_2026.xlsx` from the project root.
- Organization name: `Tamilnadu Foundation (TNF)`.
- Tournament name: `TNF Badminton - 2026`.
- Local seed must create:
  - TNF org
  - TNF organizer user `tnf-organizer@courtmastr.com / tnf123`
  - TNF tournament imported from the workbook
- Production seed must create the same TNF org and organizer account.
- Production should load TNF only for this workflow.
- `npm run seed:prod` should point to the TNF-only production seed path for now.
- Local should be the rehearsal path for production so data shape does not drift.

## Existing Context

- Shared workbook parsing already exists in [scripts/seed/tnf2026-core.ts](/Users/ramc/Documents/Code/courtmaster-v2/scripts/seed/tnf2026-core.ts).
- Local TNF 2026 seed already creates the TNF org and organizer user in [scripts/seed/tnf2026-local.ts](/Users/ramc/Documents/Code/courtmaster-v2/scripts/seed/tnf2026-local.ts).
- Production TNF 2026 seed currently creates only the admin user and seeds the tournament with the admin as organizer in [scripts/seed/tnf2026-prod.ts](/Users/ramc/Documents/Code/courtmaster-v2/scripts/seed/tnf2026-prod.ts).
- The existing organization admin page already exists at [src/features/org/views/OrgProfileView.vue](/Users/ramc/Documents/Code/courtmaster-v2/src/features/org/views/OrgProfileView.vue).

## Recommended Approach

Use one shared TNF 2026 seed path for workbook parsing and tournament creation, and make both local and production entry points perform the same org bootstrap steps before calling the shared seed core.

This avoids local/prod drift and keeps workbook-specific parsing changes isolated to the shared TNF 2026 seed code.

## Scope

### In scope

- Update workbook default path from the old TNF workbook to `TNF_Final_List_2026.xlsx`.
- Update TNF 2026 default tournament name to `TNF Badminton - 2026`.
- Mirror the local TNF org bootstrap flow in production:
  - create or reuse TNF organizer user
  - create or reuse TNF org
  - add organizer membership to the TNF org
  - set organizer `activeOrgId`
  - seed the TNF tournament attached to the TNF org
- Update the top-level production seed command so `npm run seed:prod` runs the TNF 2026 production seed.
- Update seed documentation to reflect the new workbook and behavior.
- Validate the import locally before any production seed run.

### Out of scope

- New organization UI work
- New tournament management UI
- Production deployment in this design phase
- Changes to non-TNF seed flows

## Data Flow

1. Entry point authenticates required seed users.
2. Entry point ensures TNF org exists.
3. Entry point ensures `tnf-organizer@courtmastr.com` is a TNF org member and has `activeOrgId`.
4. Entry point calls shared TNF 2026 seed core with:
   - `orgId`
   - `organizerIds`
   - `tournamentName`
   - workbook path
5. Shared core parses the workbook and creates:
   - tournament
   - categories
   - courts
   - players
   - registrations

## Risks

### Workbook schema drift

The new workbook may have column shifts or renamed headers. The parser in `tnf2026-core.ts` currently relies on fixed column positions. Local validation must confirm category selection columns and participant field offsets still match.

### Production/local divergence

If local and production bootstrap different org/user relationships, organizer access will differ. This design removes that divergence by mirroring the org setup in both entry points.

### Seed idempotency

The helper functions already reuse existing users and org slugs. Tournament creation is still additive, so production runs should be intentional and not repeated casually.

## Verification Strategy

### Local

- Start Firebase emulators.
- Run `npm run seed:tnf2026:local`.
- Verify:
  - TNF org exists with slug `tnf`
  - TNF organizer account exists and has `activeOrgId`
  - tournament name is `TNF Badminton - 2026`
  - workbook rows import into expected categories and registrations

### Build verification

Because the change touches `scripts/**` and workbook-dependent seed paths, run:

- `npm run build`
- `npm run build:log`

## Decision

Implement the TNF seed refresh as a seed-only change centered on the shared TNF 2026 import core and mirrored local/prod org bootstrap behavior.
