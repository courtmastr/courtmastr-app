# Horizon 2 Landing & Reviews Redesign Design

**Date:** 2026-03-14  
**Status:** Approved  
**Owners:** RamC Venkatasamy (Marvy Technologies), Codex

## Goal
Deliver a professional, less-distracting premium sport-tech redesign for Landing + Horizon 2 public pages and add a webapp-admin-moderated reviews system that supports both public and authenticated submissions.

## Locked Decisions
- Visual direction: Premium sport-tech (restrained, pro, low-noise).
- Display surfaces: Homepage and tournament public pages.
- Review ask on tournament public pages: persistent floating CTA.
- Moderation surface: new admin route `/admin/reviews`.
- Moderation authority: webapp admins only (not tournament-level).
- Google Reviews integration: deferred to next version.
- Preferred implementation strategy: modular brand + reviews system.

## Experience Architecture
1. Public marketing shell across `/`, `/about`, `/pricing`, `/privacy`, `/terms` with consistent hierarchy and spacing.
2. Homepage:
   - concise hero and primary conversion CTA,
   - featured metrics strip,
   - approved review trust section,
   - clean capability blocks,
   - final conversion strip.
3. Tournament public pages:
   - persistent floating "Leave a Review" button,
   - compact approved review section near lower page area,
   - no interruption to live schedule/scoring interaction surfaces.
4. Footer remains trust-first and minimal.

## Review Data + Moderation Model
- New collection: `/reviews`.
- Core fields:
  - `status` (`pending|approved|rejected`)
  - `rating`, `quote`, `displayName`, `organization`
  - `source` (`public|authenticated`)
  - `submitterUserId`, `submitterEmail`
  - `tournamentId`, `tournamentName`
  - `isFeatured` (optional curation)
  - `createdAt`, `updatedAt`, `moderatedByUserId`, `moderatedAt`, `moderationNote`
- Submission modes:
  - public + authenticated users can submit,
  - all submissions default to `pending`.
- Visibility:
  - homepage and tournament pages only render `approved` reviews.
- Moderation:
  - admin queue at `/admin/reviews` with approve/reject/feature actions.

## Component + Module Design
- New module: `src/features/reviews/`
  - `ReviewSubmissionDialog.vue`
  - `ReviewCard.vue`
  - `ReviewList.vue`
  - `ReviewFloatingCta.vue`
  - `AdminReviewsView.vue`
  - composable(s) for submission and display integration
- New store: `src/stores/reviews.ts` using setup-store pattern.
- Router: add `/admin/reviews` route with admin guard meta.
- Integrations:
  - homepage trust/review section,
  - tournament public shell/views floating CTA + review section.

## Quality Gates (Requested Skills)
- `frontend-design`: premium sport-tech execution with restrained visual noise.
- `web-design-guidelines`: compliance pass against current guideline source before completion.
- `baseline-ui`: enforce interaction, typography, layout baseline constraints.
- `fixing-motion-performance`: transform/opacity-only motion, reduced-motion support.
- `fixing-accessibility`: labels, keyboard, focus, semantic structure, error announcements.
- `fixing-metadata`: title/description/canonical/og consistency and truthful structured data.

## Testing & Verification
- Unit tests for:
  - homepage review rendering/fallback,
  - review submission form validation + success/failure,
  - floating CTA visibility/behavior,
  - admin moderation actions,
  - review store filtering and state updates,
  - router guard for `/admin/reviews`.
- Integration flow:
  - submit (pending) -> admin approve -> public visibility.
- Required verification commands:
  - `npm run test -- --run <targeted files>`
  - `npm run test:log -- --run <targeted files>`
  - `npm run build`
  - `npm run build:log`
- Debug KB protocol applies to any `:log` failure fingerprints.

## Risk Notes
- Public submissions may require server-side endpoint handling depending on current Firestore rules.
- Moderation must be server-enforced, not UI-only authorization.
- Floating CTA must not obstruct public schedule/scoring controls on mobile.

## Deferred
- Google Reviews import/sync and aggregate rendering.
