# Horizon 2 Landing & Reviews Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign Landing + Horizon 2 public pages to a professional premium sport-tech experience and ship a public/authenticated review submission flow with webapp-admin moderation at `/admin/reviews`.

**Architecture:** Implement a modular public marketing surface (shared visual language and metadata handling) plus a dedicated reviews feature module. Reviews are submitted through a callable Cloud Function (public-safe write path), stored in `/reviews` as `pending`, and surfaced publicly only after admin moderation. Quality gates are enforced with @frontend-design, @web-design-guidelines, @baseline-ui, @fixing-motion-performance, @fixing-accessibility, and @fixing-metadata.

**Tech Stack:** Vue 3 (`<script setup lang="ts">`), Pinia, Vuetify 3, Firebase Firestore, Firebase Functions (v1 callable), Vitest + @vue/test-utils, Firestore Rules.

---

### Task 1: Add Review Domain Types and Store Skeleton

**Files:**
- Modify: `src/types/index.ts`
- Create: `src/stores/reviews.ts`
- Test: `tests/unit/reviews.store.test.ts`

**Step 1: Write failing store test scaffold**

```ts
import { describe, expect, it } from 'vitest';
import { useReviewStore } from '@/stores/reviews';

describe('useReviewStore', () => {
  it('initializes empty review queues', () => {
    const store = useReviewStore();
    expect(store.pendingReviews).toEqual([]);
    expect(store.approvedReviews).toEqual([]);
    expect(store.rejectedReviews).toEqual([]);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- --run tests/unit/reviews.store.test.ts`  
Expected: FAIL (module/type missing)

**Step 3: Add minimal review types and store skeleton**

```ts
export type ReviewStatus = 'pending' | 'approved' | 'rejected';
export interface ReviewRecord { id: string; status: ReviewStatus; quote: string; rating: number; }
```

```ts
export const useReviewStore = defineStore('reviews', () => {
  const pendingReviews = ref<ReviewRecord[]>([]);
  const approvedReviews = ref<ReviewRecord[]>([]);
  const rejectedReviews = ref<ReviewRecord[]>([]);
  return { pendingReviews, approvedReviews, rejectedReviews };
});
```

**Step 4: Run test to verify it passes**

Run: `npm run test -- --run tests/unit/reviews.store.test.ts`  
Expected: PASS

**Step 5: Commit**

```bash
git add src/types/index.ts src/stores/reviews.ts tests/unit/reviews.store.test.ts
git commit -m "feat: add review domain types and store skeleton"
```

---

### Task 2: Implement Public Metadata Composable for Marketing Pages

**Files:**
- Create: `src/composables/usePublicPageMetadata.ts`
- Modify: `src/features/public/views/HomeView.vue`
- Modify: `src/features/public/views/AboutView.vue`
- Modify: `src/features/public/views/PricingView.vue`
- Modify: `src/features/public/views/PrivacyView.vue`
- Modify: `src/features/public/views/TermsView.vue`
- Test: `tests/unit/usePublicPageMetadata.test.ts`

**Step 1: Write failing metadata composable test**

```ts
it('sets document title and description for public pages', () => {
  usePublicPageMetadata({ title: 'Pricing', description: 'Free Beta pricing for CourtMastr' });
  expect(document.title).toContain('Pricing');
  expect(document.head.querySelector('meta[name="description"]')?.getAttribute('content'))
    .toContain('Free Beta');
});
```

**Step 2: Run test to verify failure**

Run: `npm run test -- --run tests/unit/usePublicPageMetadata.test.ts`  
Expected: FAIL (composable missing)

**Step 3: Implement composable and wire pages**

```ts
usePublicPageMetadata({
  title: 'CourtMastr Pricing',
  description: 'Free Beta access for clubs and organizers.',
  canonicalPath: '/pricing',
});
```

Include canonical + OG URL alignment and safe defaults.

**Step 4: Run metadata test**

Run: `npm run test -- --run tests/unit/usePublicPageMetadata.test.ts`  
Expected: PASS

**Step 5: Commit**

```bash
git add src/composables/usePublicPageMetadata.ts src/features/public/views/HomeView.vue src/features/public/views/AboutView.vue src/features/public/views/PricingView.vue src/features/public/views/PrivacyView.vue src/features/public/views/TermsView.vue tests/unit/usePublicPageMetadata.test.ts
git commit -m "feat: add public page metadata composable and wire horizon pages"
```

---

### Task 3: Add Callable Function for Public/Authenticated Review Submission

**Files:**
- Create: `functions/src/reviews.ts`
- Modify: `functions/src/index.ts`
- Create: `src/services/reviewsService.ts`
- Modify: `src/stores/reviews.ts`
- Test: `tests/unit/reviews.service.test.ts`

**Step 1: Write failing service test for callable invocation**

```ts
it('submits review payload through submitReview callable', async () => {
  await submitReview({ quote: 'Great event flow', rating: 5, source: 'public' });
  expect(mockCallable).toHaveBeenCalledWith(expect.objectContaining({ rating: 5 }));
});
```

**Step 2: Run failing service test**

Run: `npm run test -- --run tests/unit/reviews.service.test.ts`  
Expected: FAIL (service/function missing)

**Step 3: Implement callable + service wrapper**

Callable behavior:
- Accept public or authenticated payload.
- Validate rating range, required fields, length caps.
- Set `status='pending'`, `createdAt`, `updatedAt`.
- Persist to `/reviews`.

Service wrapper:

```ts
const submitReviewFn = httpsCallable(functions, 'submitReview');
```

**Step 4: Run service test and functions build**

Run: `npm run test -- --run tests/unit/reviews.service.test.ts`  
Expected: PASS

Run: `npm --prefix functions run build`  
Expected: PASS

**Step 5: Commit**

```bash
git add functions/src/reviews.ts functions/src/index.ts src/services/reviewsService.ts src/stores/reviews.ts tests/unit/reviews.service.test.ts
git commit -m "feat: add callable review submission endpoint and client service"
```

---

### Task 4: Add Firestore Rules for Reviews Collection

**Files:**
- Modify: `firestore.rules`

**Step 1: Add failing security expectation notes (doc-level quick test checklist)**

Create explicit checks in plan execution notes:
- public read only approved reviews
- admin read all statuses
- public cannot create/update/delete `/reviews` directly

**Step 2: Implement rules block**

```rules
match /reviews/{reviewId} {
  allow read: if resource.data.status == 'approved' || isAdmin();
  allow create: if false;
  allow update, delete: if isAdmin();
}
```

**Step 3: Validate rules syntax**

Run: `firebase emulators:start --only firestore --project demo-courtmastr` (or existing repo emulator flow)  
Expected: rules compile without syntax errors

**Step 4: Record manual security checks**

Run through quick manual verification in emulator UI or scripted requests.

**Step 5: Commit**

```bash
git add firestore.rules
git commit -m "feat: add moderated review firestore security rules"
```

---

### Task 5: Build Reusable Review UI Components

**Files:**
- Create: `src/features/reviews/components/ReviewCard.vue`
- Create: `src/features/reviews/components/ReviewList.vue`
- Create: `src/features/reviews/components/ReviewSubmissionDialog.vue`
- Create: `src/features/reviews/components/ReviewFloatingCta.vue`
- Test: `tests/unit/ReviewSubmissionDialog.test.ts`
- Test: `tests/unit/ReviewFloatingCta.test.ts`

**Step 1: Write failing component tests**

```ts
it('validates required fields before submit', async () => {
  // open dialog, click submit without quote
  expect(wrapper.text()).toContain('Quote is required');
});

it('renders floating CTA with accessible label', () => {
  expect(wrapper.get('button[aria-label="Leave a review"]')).toBeTruthy();
});
```

**Step 2: Run tests to fail**

Run: `npm run test -- --run tests/unit/ReviewSubmissionDialog.test.ts tests/unit/ReviewFloatingCta.test.ts`  
Expected: FAIL

**Step 3: Implement components with accessibility + motion constraints**

- Label all inputs and icon-only buttons.
- Use semantic buttons/links.
- Add reduced-motion-friendly transitions.
- Keep motion to transform/opacity.

**Step 4: Re-run tests**

Run: `npm run test -- --run tests/unit/ReviewSubmissionDialog.test.ts tests/unit/ReviewFloatingCta.test.ts`  
Expected: PASS

**Step 5: Commit**

```bash
git add src/features/reviews/components/ReviewCard.vue src/features/reviews/components/ReviewList.vue src/features/reviews/components/ReviewSubmissionDialog.vue src/features/reviews/components/ReviewFloatingCta.vue tests/unit/ReviewSubmissionDialog.test.ts tests/unit/ReviewFloatingCta.test.ts
git commit -m "feat: add reusable review UI components"
```

---

### Task 6: Add Admin Moderation Page and Route Guarding

**Files:**
- Create: `src/features/reviews/views/AdminReviewsView.vue`
- Modify: `src/router/index.ts`
- Modify: `src/components/navigation/AppNavigation.vue`
- Modify: `src/stores/reviews.ts`
- Test: `tests/unit/AdminReviewsView.test.ts`
- Test: `tests/unit/router-guards-auth.test.ts`

**Step 1: Add failing route/admin access test**

```ts
it('blocks non-admin access to /admin/reviews', async () => {
  // expect redirect/deny for organizer/viewer
});
```

**Step 2: Run route test to fail**

Run: `npm run test -- --run tests/unit/router-guards-auth.test.ts`  
Expected: FAIL for new route cases

**Step 3: Implement admin route + moderation UI/actions**

- Route: `/admin/reviews` with `requiresAuth` + `requiresAdmin`.
- Admin table/filter by status.
- Actions: approve/reject/feature.
- Store writes moderated metadata fields.

**Step 4: Run admin + route tests**

Run: `npm run test -- --run tests/unit/AdminReviewsView.test.ts tests/unit/router-guards-auth.test.ts`  
Expected: PASS

**Step 5: Commit**

```bash
git add src/features/reviews/views/AdminReviewsView.vue src/router/index.ts src/components/navigation/AppNavigation.vue src/stores/reviews.ts tests/unit/AdminReviewsView.test.ts tests/unit/router-guards-auth.test.ts
git commit -m "feat: add admin review moderation page and route guards"
```

---

### Task 7: Redesign Landing Page with Modular Premium Sport-Tech Sections

**Files:**
- Modify: `src/features/public/views/HomeView.vue`
- Create: `src/features/public/components/PublicHeroSection.vue`
- Create: `src/features/public/components/PublicMetricsStrip.vue`
- Create: `src/features/public/components/PublicTrustReviewsSection.vue`
- Create: `src/features/public/components/PublicFeatureGrid.vue`
- Test: `tests/unit/HomeView.test.ts`

**Step 1: Write failing landing integration tests**

```ts
it('renders approved reviews section on home', async () => {
  expect(wrapper.text()).toContain('Community Voices');
});
```

**Step 2: Run test to fail**

Run: `npm run test -- --run tests/unit/HomeView.test.ts`  
Expected: FAIL for new component/section expectations

**Step 3: Implement modular sections and integrate review list + submission dialog**

- Reduce visual clutter.
- Keep single primary CTA emphasis.
- Ensure numbers use tabular rhythm and headings balance text.

**Step 4: Re-run HomeView tests**

Run: `npm run test -- --run tests/unit/HomeView.test.ts`  
Expected: PASS

**Step 5: Commit**

```bash
git add src/features/public/views/HomeView.vue src/features/public/components/PublicHeroSection.vue src/features/public/components/PublicMetricsStrip.vue src/features/public/components/PublicTrustReviewsSection.vue src/features/public/components/PublicFeatureGrid.vue tests/unit/HomeView.test.ts
git commit -m "feat: redesign landing page with modular premium sport-tech sections"
```

---

### Task 8: Integrate Floating Review CTA + Compact Reviews in Tournament Public Pages

**Files:**
- Modify: `src/components/common/TournamentPublicShell.vue`
- Modify: `src/features/public/views/PublicScheduleView.vue`
- Modify: `src/features/public/views/PublicScoringView.vue`
- Modify: `src/features/public/views/PublicBracketView.vue`
- Modify: `src/features/public/views/PublicPlayerView.vue`
- Test: `tests/unit/TournamentPublicShell.test.ts`
- Test: `tests/unit/PublicScheduleView.test.ts`
- Test: `tests/unit/PublicScoringView.test.ts`

**Step 1: Add failing tests for floating CTA/review block visibility**

```ts
it('shows floating review CTA on public tournament pages', () => {
  expect(wrapper.find('[aria-label="Leave a review"]').exists()).toBe(true);
});
```

**Step 2: Run tests to fail**

Run: `npm run test -- --run tests/unit/TournamentPublicShell.test.ts tests/unit/PublicScheduleView.test.ts tests/unit/PublicScoringView.test.ts`  
Expected: FAIL

**Step 3: Implement CTA + compact reviews with non-obstructive placement**

- Fixed CTA with safe-area support.
- Keep CTA away from primary action clusters.
- Dialog trigger from CTA.

**Step 4: Re-run targeted tests**

Run: `npm run test -- --run tests/unit/TournamentPublicShell.test.ts tests/unit/PublicScheduleView.test.ts tests/unit/PublicScoringView.test.ts`  
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/common/TournamentPublicShell.vue src/features/public/views/PublicScheduleView.vue src/features/public/views/PublicScoringView.vue src/features/public/views/PublicBracketView.vue src/features/public/views/PublicPlayerView.vue tests/unit/TournamentPublicShell.test.ts tests/unit/PublicScheduleView.test.ts tests/unit/PublicScoringView.test.ts
git commit -m "feat: add tournament public page floating review cta and compact reviews"
```

---

### Task 9: Redesign About/Pricing/Privacy/Terms for Professional Consistency

**Files:**
- Modify: `src/features/public/views/AboutView.vue`
- Modify: `src/features/public/views/PricingView.vue`
- Modify: `src/features/public/views/PrivacyView.vue`
- Modify: `src/features/public/views/TermsView.vue`
- Modify: `src/components/common/PublicWebsiteFooter.vue`
- Test: `tests/integration/public-views.integration.test.ts`

**Step 1: Add/adjust integration expectations**

```ts
it('renders consistent public layout + footer across horizon pages', async () => {
  // assert footer links and primary section headings
});
```

**Step 2: Run integration test to fail**

Run: `npm run test -- --run tests/integration/public-views.integration.test.ts`  
Expected: FAIL for updated structure/copy assertions

**Step 3: Implement visual + content consistency pass**

- Match spacing, heading rhythm, and card hierarchy.
- Keep legal pages readable with section anchors and concise blocks.
- Maintain low-distraction design.

**Step 4: Re-run integration test**

Run: `npm run test -- --run tests/integration/public-views.integration.test.ts`  
Expected: PASS

**Step 5: Commit**

```bash
git add src/features/public/views/AboutView.vue src/features/public/views/PricingView.vue src/features/public/views/PrivacyView.vue src/features/public/views/TermsView.vue src/components/common/PublicWebsiteFooter.vue tests/integration/public-views.integration.test.ts
git commit -m "feat: align horizon 2 public pages with professional brand system"
```

---

### Task 10: Accessibility, Motion, Metadata, and Web-Guidelines Compliance Pass

**Files:**
- Modify: affected public/reviews components from Tasks 5–9
- Update docs: `docs/ops/horizon-2-social-checklist.md` (if final content checklist changed)

**Step 1: Run targeted guideline review checklist**

- Apply @web-design-guidelines review pass against updated public/review files.
- Apply @baseline-ui constraints.
- Apply @fixing-motion-performance checks.
- Apply @fixing-accessibility checks.
- Apply @fixing-metadata checks.

**Step 2: Implement minimal fixes from findings**

Examples:
- missing aria-labels
- focus-visible styles
- reduced-motion branch
- title/description canonical mismatches

**Step 3: Run full targeted verification**

Run:
```bash
npm run test -- --run tests/unit/reviews.store.test.ts tests/unit/reviews.service.test.ts tests/unit/ReviewSubmissionDialog.test.ts tests/unit/ReviewFloatingCta.test.ts tests/unit/AdminReviewsView.test.ts tests/unit/HomeView.test.ts tests/unit/TournamentPublicShell.test.ts tests/unit/PublicScheduleView.test.ts tests/unit/PublicScoringView.test.ts tests/unit/router-guards-auth.test.ts tests/integration/public-views.integration.test.ts
npm run test:log -- --run tests/unit/reviews.store.test.ts tests/unit/reviews.service.test.ts tests/unit/ReviewSubmissionDialog.test.ts tests/unit/ReviewFloatingCta.test.ts tests/unit/AdminReviewsView.test.ts tests/unit/HomeView.test.ts tests/unit/TournamentPublicShell.test.ts tests/unit/PublicScheduleView.test.ts tests/unit/PublicScoringView.test.ts tests/unit/router-guards-auth.test.ts tests/integration/public-views.integration.test.ts
npm --prefix functions run build
npm run build
npm run build:log
```
Expected: tests pass; build/log may hit known baseline fingerprint (handle with Debug KB protocol)

**Step 4: Update Debug KB if fingerprint appears**

- Capture fingerprint
- Update existing KB entry + `docs/debug-kb/index.yml`

**Step 5: Commit**

```bash
git add src/features/reviews src/features/public src/components/common src/stores/reviews.ts src/services/reviewsService.ts src/router/index.ts firestore.rules functions/src/reviews.ts functions/src/index.ts tests/unit tests/integration/public-views.integration.test.ts docs/ops/horizon-2-social-checklist.md docs/debug-kb
git commit -m "feat: redesign public experience and add admin-moderated reviews"
```

---

## Implementation Notes
- Keep diffs scoped: no unrelated refactors.
- Reuse existing Vuetify and store patterns.
- Maintain no-regression behavior in public schedule/scoring flows.
- Preserve existing Horizon 1 and prior Horizon 2 branding decisions.
