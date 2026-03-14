# Sponsor And Tournament Logo Design

**Date:** 2026-03-11
**Source:** Product brainstorming for sponsor logos and tournament branding
**Status:** Approved

---

## Problem Summary

CourtMastr currently supports tournament sponsors only as a plain `string[]` on the tournament document. That is enough for the existing text-only overlay ticker, but it does not support sponsor logos, sponsor links, tournament logos, or consistent branding across organizer, public, and overlay surfaces.

The goal for v1 is to add tournament-scoped branding that lets admins manage:

1. one primary tournament logo,
2. up to 20 tournament-specific sponsors,
3. sponsor names, logos, optional websites, and manual display order,
4. consistent display of that branding across tournament and public-facing screens.

This feature must keep the implementation small, work with the existing tournament document fetch flow, and avoid breaking old tournaments that still store sponsors as plain strings.

---

## Product Decisions Confirmed

1. Sponsor management is in scope now, with monetization possible later.
2. Sponsors are tournament-specific in v1, not globally reusable across tournaments.
3. Each sponsor stores `name`, `logo`, optional `website`, and `displayOrder`.
4. Each tournament has one primary logo image in v1.
5. Branding should appear both in admin-managed screens and public-facing tournament screens.
6. A tournament may have at most 20 sponsors in v1.

---

## Scope

### In Scope

1. Tournament logo upload, replace, preview, and display
2. Tournament sponsor CRUD inside tournament settings
3. Sponsor logo upload, replace, preview, remove, and manual ordering
4. Tournament list and tournament dashboard logo display
5. Branding on public tournament pages
6. Branding on overlay views
7. Backward-compatible handling of legacy `string[]` sponsors
8. Firebase Storage support for tournament branding assets

### Out Of Scope

1. Cross-tournament global sponsor reuse
2. Paid sponsor plan or billing workflows
3. Multiple tournament logo variants by aspect ratio
4. Sponsor analytics, click tracking, or impression reporting
5. Per-sponsor approval workflows
6. Dedicated sponsor admin section outside tournament settings

---

## Approaches Considered

### Option A: Keep Branding On The Tournament Document (Recommended)

Store one `tournamentLogo` object and a structured `sponsors` array directly on `tournaments/{id}`.

Pros:

1. Smallest change to the existing architecture
2. Fits the current `fetchTournament()` and subscription patterns
3. No extra Firestore reads for public pages or overlays
4. Easiest migration path from legacy string sponsors

Cons:

1. Less scalable if sponsor data becomes much larger later
2. Requires care to keep the tournament document compact

### Option B: Sponsor Subcollection Per Tournament

Keep the tournament logo on the tournament document but move sponsors into `tournaments/{id}/sponsors`.

Pros:

1. Better scaling if sponsor lists grow later
2. Independent sponsor updates possible

Cons:

1. More Firestore queries and subscriptions
2. Higher implementation cost for limited v1 benefit

### Option C: Separate Branding Asset Layer

Create a reusable media/branding model for tournament and sponsor assets from the start.

Pros:

1. Most future-ready for monetization and asset reuse

Cons:

1. Highest complexity
2. Not justified for the current v1 scope

---

## Selected Strategy

Adopt **Option A: keep branding on the tournament document**.

This is the smallest approach that fits the current store and view architecture while still leaving a clean migration path if sponsors later outgrow the tournament document.

---

## Data Model

The tournament document remains the source of truth for branding.

Suggested TypeScript shapes:

```ts
interface TournamentLogo {
  url: string;
  storagePath: string;
  uploadedAt?: Date;
}

interface TournamentSponsor {
  id: string;
  name: string;
  logoUrl: string;
  logoPath: string;
  website?: string;
  displayOrder: number;
}
```

Tournament document additions:

```ts
interface Tournament {
  tournamentLogo?: TournamentLogo | null;
  sponsors?: Array<TournamentSponsor | string>;
}
```

Key rules:

1. `tournamentLogo` is optional.
2. `sponsors` is optional and capped at 20 entries.
3. `displayOrder` is authoritative for rendering order.
4. Legacy sponsor strings must continue to render safely until the tournament is saved in the new format.

---

## Storage Model

Branding assets should use tournament-scoped Firebase Storage paths:

1. `tournaments/{tournamentId}/branding/logo/<filename>`
2. `tournaments/{tournamentId}/branding/sponsors/{sponsorId}/<filename>`

Why this pathing:

1. easy cleanup when a logo is replaced or a sponsor is deleted,
2. easy reasoning about ownership,
3. no need for a separate asset index in v1.

Storage access rules for v1:

1. Public read for branding assets so public pages and overlays can render without auth
2. Authenticated admin-only create/update/delete for tournament branding uploads
3. File type restricted to images
4. File size capped to keep assets lightweight

---

## Admin Flow

Branding management lives inside `TournamentSettingsView.vue`.

The new branding area should support:

1. upload or replace tournament logo,
2. preview the current tournament logo,
3. add sponsor rows with name, logo, optional website, and display order,
4. reorder sponsors,
5. remove sponsors,
6. preview sponsor logos before save,
7. enforce the 20-sponsor cap with explicit user feedback.

Behavior rules:

1. Tournament logo changes do not count toward the sponsor limit.
2. Sponsor name is required.
3. Sponsor logo is required.
4. Sponsor website is optional, but if provided must be a valid URL.
5. Save should normalize `displayOrder` to a clean contiguous sequence.
6. Replacing an image should upload the new file first, then delete the old stored object when safe.

---

## Display Surfaces

### Organizer-Facing Surfaces

1. Tournament settings preview
2. Tournament list cards
3. Tournament dashboard header

### Public-Facing Surfaces

1. Public schedule header
2. Public player header
3. Public bracket header
4. Public scoring header

### Overlay Surfaces

1. Overlay board
2. Overlay ticker
3. Overlay court

Display behavior:

1. If a tournament logo exists, show it in the header or card treatment.
2. If no tournament logo exists, fall back to the current icon/title treatment.
3. Sponsors render in `displayOrder`.
4. Sponsor website is used only when the surface supports clickable links; overlays can remain non-clickable visual branding.
5. If a sponsor logo fails to load, fall back to sponsor name text instead of showing a broken image.

---

## UI Notes By Surface

### Tournament List

Use the tournament logo in place of the current trophy avatar where present. Keep the existing icon fallback.

### Tournament Dashboard

Add the tournament logo to the dashboard header so the main organizer-facing surface matches the public tournament identity.

### Public Pages

Reuse each page's current branded hero/header area and add the tournament logo there, keeping existing typography and page purpose labels intact.

### Overlay Views

The board overlay should move from text-only sponsor output to logo-first sponsor display. Compact tournament logo placement is acceptable in the ticker and court overlays so long as the scoring content remains dominant and readable.

---

## Backward Compatibility And Migration

Existing tournaments may still contain `sponsors: string[]`.

V1 should not require a one-time database migration. Instead:

1. Add a normalization helper that converts legacy strings into display-safe sponsor objects at read time.
2. Allow existing overlays and public pages to continue rendering old tournaments.
3. Convert legacy string sponsors into structured sponsor objects only when the tournament is next saved through the updated settings UI.

This avoids breaking current tournaments and keeps rollout low risk.

---

## Validation

Recommended v1 validation:

1. Tournament logo optional
2. Sponsor name required
3. Sponsor logo required
4. Sponsor website optional but URL-valid if present
5. Maximum 20 sponsors
6. Images only
7. Reasonable max upload size, such as 2 MB per file
8. Allowed formats: `png`, `jpg`, `jpeg`, `webp`; `svg` only if security review is accepted during implementation

---

## Testing Strategy

### Unit Tests

1. Branding normalization logic
2. Sponsor ordering logic
3. Settings form validation for sponsor count, required fields, and website URLs
4. Overlay structured sponsor rendering and fallback behavior

### UI And Smoke Coverage

1. Tournament list displays logo fallback correctly
2. Public pages render tournament logo without auth
3. Overlay views render sponsor logos in order
4. Existing tournaments with legacy string sponsors still render safely

### Verification

Implementation must follow repository policy:

1. run targeted tests with `npm run test:log -- --run ...`,
2. run `npm run lint:log`,
3. run `npm run build:log`,
4. if any `:log` command fails, follow the Debug KB Protocol in `AGENTS.md`.

---

## Files Likely To Change

1. `src/types/index.ts`
2. `src/stores/tournaments.ts`
3. `src/features/tournaments/views/TournamentSettingsView.vue`
4. `src/features/tournaments/views/TournamentDashboardView.vue`
5. `src/features/tournaments/views/TournamentListView.vue`
6. `src/features/public/views/PublicScheduleView.vue`
7. `src/features/public/views/PublicPlayerView.vue`
8. `src/features/public/views/PublicBracketView.vue`
9. `src/features/public/views/PublicScoringView.vue`
10. `src/features/overlay/views/OverlayBoardView.vue`
11. `src/features/overlay/views/OverlayTickerView.vue`
12. `src/features/overlay/views/OverlayCourtView.vue`
13. `storage.rules`
14. `tests/unit/...` files for branding and overlay coverage

---

## Success Criteria

The feature is successful when:

1. admins can manage one tournament logo and up to 20 sponsors inside tournament settings,
2. sponsor entries support name, logo, optional website, and manual ordering,
3. branding appears consistently across organizer, public, and overlay surfaces,
4. public and overlay branding works without auth friction,
5. legacy tournaments with string sponsors do not break,
6. build and required `:log` verification commands pass.
