# Sponsor And Tournament Logo Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add tournament-scoped branding with one primary tournament logo and up to 20 structured sponsors, managed from tournament settings and rendered across organizer, public, and overlay surfaces without breaking legacy `string[]` sponsor data.

**Architecture:** Keep branding data on the existing `tournaments/{id}` document. Add typed sponsor/logo models plus a normalization composable to shield views from legacy data. Use Firebase Storage for tournament branding uploads, admin-only writes with public reads, and patch the existing settings/public/overlay views to render normalized branding with safe fallbacks.

**Tech Stack:** Vue 3 `<script setup lang="ts">`, Vuetify 3, Pinia, Vue Router, Firebase Firestore, Firebase Storage, Vitest.

---

## Guardrails

1. Read `docs/coding-patterns/CODING_PATTERNS.md` before each code task.
2. Apply `@test-driven-development` on every implementation task.
3. Do not add dependencies.
4. Keep sponsors tournament-local in v1. Do not add global sponsor collections.
5. Use simple reorder controls, not drag-and-drop dependencies.
6. Run `npm run build:log` after every code task.
7. If any `:log` command fails, follow the Debug KB Protocol in `AGENTS.md`.
8. Because the current workspace is dirty, implement this in a fresh worktree or stage only the files listed in each commit step.

---

## Critical Files To Read Before Starting

1. `docs/plans/2026-03-11-sponsor-tournament-logo-design.md`
2. `docs/coding-patterns/CODING_PATTERNS.md`
3. `src/types/index.ts`
4. `src/stores/tournaments.ts`
5. `src/features/tournaments/views/TournamentSettingsView.vue`
6. `src/features/tournaments/views/TournamentListView.vue`
7. `src/features/tournaments/views/TournamentDashboardView.vue`
8. `src/features/public/views/PublicScheduleView.vue`
9. `src/features/public/views/PublicPlayerView.vue`
10. `src/features/public/views/PublicBracketView.vue`
11. `src/features/public/views/PublicScoringView.vue`
12. `src/features/overlay/views/OverlayBoardView.vue`
13. `src/features/overlay/views/OverlayTickerView.vue`
14. `src/features/overlay/views/OverlayCourtView.vue`
15. `storage.rules`
16. `tests/unit/OverlayBoardView.test.ts`

---

## Task 1: Add Branding Types And Normalization Composable

**Files:**
- Modify: `src/types/index.ts`
- Create: `src/composables/useTournamentBranding.ts`
- Create: `tests/unit/useTournamentBranding.test.ts`

**Step 1: Write the failing unit test**

```typescript
import { computed, ref } from 'vue';
import { describe, expect, it } from 'vitest';
import { useTournamentBranding } from '@/composables/useTournamentBranding';

describe('useTournamentBranding', () => {
  it('normalizes legacy string sponsors and sorts structured sponsors by display order', () => {
    const tournament = ref({
      id: 't1',
      name: 'Spring Open',
      sponsors: [
        'Legacy Sponsor',
        {
          id: 's2',
          name: 'B Sponsor',
          logoUrl: 'https://example.com/b.png',
          logoPath: 'tournaments/t1/branding/sponsors/s2/b.png',
          displayOrder: 2,
        },
        {
          id: 's1',
          name: 'A Sponsor',
          logoUrl: 'https://example.com/a.png',
          logoPath: 'tournaments/t1/branding/sponsors/s1/a.png',
          displayOrder: 1,
        },
      ],
      tournamentLogo: {
        url: 'https://example.com/logo.png',
        storagePath: 'tournaments/t1/branding/logo/logo.png',
      },
    });

    const { normalizedSponsors, sponsorNames, tournamentLogoUrl } = useTournamentBranding(
      computed(() => tournament.value as never)
    );

    expect(normalizedSponsors.value.map((item) => item.name)).toEqual([
      'Legacy Sponsor',
      'A Sponsor',
      'B Sponsor',
    ]);
    expect(sponsorNames.value).toEqual(['Legacy Sponsor', 'A Sponsor', 'B Sponsor']);
    expect(tournamentLogoUrl.value).toBe('https://example.com/logo.png');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:log -- --run tests/unit/useTournamentBranding.test.ts`  
Expected: FAIL because the composable and branding types do not exist yet.

**Step 3: Write minimal implementation**

In `src/types/index.ts`, add:

```typescript
export interface TournamentLogo {
  url: string;
  storagePath: string;
  uploadedAt?: Date;
}

export interface TournamentSponsor {
  id: string;
  name: string;
  logoUrl: string;
  logoPath: string;
  website?: string;
  displayOrder: number;
}

export type TournamentSponsorRecord = TournamentSponsor | string;
```

Update `Tournament`:

```typescript
tournamentLogo?: TournamentLogo | null;
sponsors?: TournamentSponsorRecord[];
```

In `src/composables/useTournamentBranding.ts`, add a reusable normalization composable that:

1. returns a normalized sponsor array,
2. accepts legacy string sponsors,
3. sorts structured sponsors by `displayOrder`,
4. exposes `sponsorNames` for text fallbacks,
5. exposes `tournamentLogoUrl`, `tournamentLogo`, and `hasTournamentLogo`.

Use a stable synthetic `id` for legacy string sponsors, for example:

```typescript
{
  id: `legacy-${index}`,
  name: sponsor,
  logoUrl: '',
  logoPath: '',
  displayOrder: index,
}
```

**Step 4: Run verification**

Run: `npm run test:log -- --run tests/unit/useTournamentBranding.test.ts`  
Expected: PASS.

Run: `npm run lint:log`  
Expected: PASS.

Run: `npm run build:log`  
Expected: PASS.

**Step 5: Commit**

```bash
git add src/types/index.ts src/composables/useTournamentBranding.ts tests/unit/useTournamentBranding.test.ts
git commit -m "feat(branding): add tournament branding types and normalization"
```

---

## Task 2: Add Branding Upload Helpers And Storage Rules

**Files:**
- Create: `src/services/tournamentBrandingStorage.ts`
- Modify: `storage.rules`
- Create: `tests/unit/tournamentBrandingStorage.test.ts`

**Step 1: Write the failing unit tests for the pure helpers**

```typescript
import { describe, expect, it } from 'vitest';
import {
  BRANDING_MAX_FILE_SIZE_BYTES,
  buildSponsorLogoPath,
  buildTournamentLogoPath,
  validateBrandingFile,
} from '@/services/tournamentBrandingStorage';

describe('tournamentBrandingStorage helpers', () => {
  it('builds deterministic storage paths', () => {
    expect(buildTournamentLogoPath('t1', 'logo.png')).toBe('tournaments/t1/branding/logo/logo.png');
    expect(buildSponsorLogoPath('t1', 's1', 'sponsor.png')).toBe(
      'tournaments/t1/branding/sponsors/s1/sponsor.png'
    );
  });

  it('rejects oversize files', () => {
    const file = new File(['x'], 'logo.png', { type: 'image/png' });
    Object.defineProperty(file, 'size', { value: BRANDING_MAX_FILE_SIZE_BYTES + 1 });

    expect(validateBrandingFile(file)).toMatch(/2 MB/i);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:log -- --run tests/unit/tournamentBrandingStorage.test.ts`  
Expected: FAIL because the storage helper module does not exist yet.

**Step 3: Implement minimal helper and storage wrapper**

In `src/services/tournamentBrandingStorage.ts`, export:

```typescript
export const BRANDING_MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024;

export function buildTournamentLogoPath(tournamentId: string, filename: string): string {
  return `tournaments/${tournamentId}/branding/logo/${filename}`;
}

export function buildSponsorLogoPath(
  tournamentId: string,
  sponsorId: string,
  filename: string
): string {
  return `tournaments/${tournamentId}/branding/sponsors/${sponsorId}/${filename}`;
}

export function validateBrandingFile(file: File): string | null {
  if (!file.type.startsWith('image/')) return 'Branding assets must be image files.';
  if (file.size > BRANDING_MAX_FILE_SIZE_BYTES) return 'Branding assets must be 2 MB or smaller.';
  return null;
}
```

Also add Firebase-backed wrappers:

1. `uploadTournamentLogo`
2. `uploadSponsorLogo`
3. `deleteBrandingAsset`

These should reuse `uploadBytes`, `getDownloadURL`, and `deleteObject` from `@/services/firebase`.

**Step 4: Update `storage.rules`**

Add a branding block:

```txt
match /tournaments/{tournamentId}/branding/{allPaths=**} {
  allow read: if true;
  allow create, update: if isAdmin()
    && request.resource.size < 2 * 1024 * 1024
    && request.resource.contentType.matches('image/.*');
  allow delete: if isAdmin();
}
```

Keep the existing bug-report rules intact.

**Step 5: Run verification**

Run: `npm run test:log -- --run tests/unit/tournamentBrandingStorage.test.ts`  
Expected: PASS.

Run: `npm run lint:log`  
Expected: PASS.

Run: `npm run build:log`  
Expected: PASS.

**Step 6: Commit**

```bash
git add src/services/tournamentBrandingStorage.ts storage.rules tests/unit/tournamentBrandingStorage.test.ts
git commit -m "feat(branding): add storage helpers and rules"
```

---

## Task 3: Build Tournament Branding Management In Settings

**Files:**
- Create: `src/features/tournaments/components/TournamentBrandingCard.vue`
- Modify: `src/features/tournaments/views/TournamentSettingsView.vue`
- Create: `tests/unit/TournamentBrandingCard.test.ts`

**Step 1: Write the failing unit test**

```typescript
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import TournamentBrandingCard from '@/features/tournaments/components/TournamentBrandingCard.vue';

describe('TournamentBrandingCard', () => {
  it('blocks adding a twenty-first sponsor', async () => {
    const sponsors = Array.from({ length: 20 }, (_, index) => ({
      id: `s${index}`,
      name: `Sponsor ${index}`,
      logoUrl: `https://example.com/${index}.png`,
      logoPath: `tournaments/t1/branding/sponsors/s${index}/${index}.png`,
      displayOrder: index,
    }));

    const wrapper = mount(TournamentBrandingCard, {
      props: {
        tournamentId: 't1',
        sponsors,
        tournamentLogo: null,
      },
    });

    await wrapper.get('[data-testid="add-sponsor"]').trigger('click');

    expect(wrapper.text()).toContain('You can add up to 20 sponsors');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:log -- --run tests/unit/TournamentBrandingCard.test.ts`  
Expected: FAIL because the component does not exist yet.

**Step 3: Implement the branding card**

Create `TournamentBrandingCard.vue` with:

1. tournament logo upload and preview,
2. sponsor row editing for `name`, `website`, and `logo`,
3. simple reorder buttons using `mdi-arrow-up` and `mdi-arrow-down`,
4. remove buttons,
5. sponsor cap warning at 20,
6. emitted payload for the parent view,
7. no save button inside the component; reuse the existing settings page save flow.

Recommended component contract:

```typescript
defineProps<{
  tournamentId: string;
  sponsors: TournamentSponsorRecord[];
  tournamentLogo: TournamentLogo | null | undefined;
}>();

const emit = defineEmits<{
  update: [payload: {
    tournamentLogoFile: File | null;
    keepTournamentLogo: boolean;
    sponsors: TournamentSponsor[];
    sponsorLogoFiles: Record<string, File | null>;
    removedLogoPaths: string[];
  }];
}>();
```

**Step 4: Integrate into `TournamentSettingsView.vue`**

Replace the current string-based sponsor section with the new card.

Update save logic so `saveSettings()`:

1. uploads a new tournament logo if selected,
2. uploads new or replaced sponsor logos,
3. normalizes sponsor `displayOrder`,
4. updates the tournament document with `tournamentLogo` and structured `sponsors`,
5. deletes removed or replaced storage objects only after the Firestore update succeeds,
6. preserves the existing success/error toast flow.

Do not weaken the existing settings save path for non-branding fields.

**Step 5: Run verification**

Run: `npm run test:log -- --run tests/unit/TournamentBrandingCard.test.ts`  
Expected: PASS.

Run: `npm run lint:log`  
Expected: PASS.

Run: `npm run build:log`  
Expected: PASS.

**Step 6: Commit**

```bash
git add src/features/tournaments/components/TournamentBrandingCard.vue src/features/tournaments/views/TournamentSettingsView.vue tests/unit/TournamentBrandingCard.test.ts
git commit -m "feat(branding): add tournament branding settings UI"
```

---

## Task 4: Add Shared Logo Rendering For Tournament And Public Headers

**Files:**
- Create: `src/components/common/TournamentBrandMark.vue`
- Modify: `src/features/tournaments/views/TournamentListView.vue`
- Modify: `src/features/tournaments/views/TournamentDashboardView.vue`
- Modify: `src/features/public/views/PublicScheduleView.vue`
- Modify: `src/features/public/views/PublicPlayerView.vue`
- Modify: `src/features/public/views/PublicBracketView.vue`
- Modify: `src/features/public/views/PublicScoringView.vue`
- Create: `tests/unit/TournamentBrandMark.test.ts`

**Step 1: Write the failing component test**

```typescript
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import TournamentBrandMark from '@/components/common/TournamentBrandMark.vue';

describe('TournamentBrandMark', () => {
  it('falls back to an icon when no logo URL is provided', () => {
    const wrapper = mount(TournamentBrandMark, {
      props: {
        tournamentName: 'Spring Open',
        logoUrl: '',
        icon: 'mdi-trophy',
      },
    });

    expect(wrapper.find('img').exists()).toBe(false);
    expect(wrapper.text()).toContain('mdi-trophy');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:log -- --run tests/unit/TournamentBrandMark.test.ts`  
Expected: FAIL because the component does not exist yet.

**Step 3: Implement the reusable brand mark**

Create `TournamentBrandMark.vue` that:

1. renders an image when `logoUrl` exists,
2. swaps to the fallback icon if the image errors,
3. accepts size props for card/header usage,
4. exposes meaningful `alt` text using the tournament name.

Suggested API:

```typescript
defineProps<{
  tournamentName: string;
  logoUrl?: string | null;
  icon?: string;
  size?: number;
  rounded?: 'circle' | 'lg';
}>();
```

**Step 4: Patch the views**

Use `useTournamentBranding()` plus `TournamentBrandMark` to update:

1. `TournamentListView.vue` card avatar
2. `TournamentDashboardView.vue` header
3. `PublicScheduleView.vue` header
4. `PublicPlayerView.vue` header
5. `PublicBracketView.vue` header
6. `PublicScoringView.vue` header

Keep existing icons and copy as the fallback state. Do not redesign the pages beyond the branding insertion.

**Step 5: Run verification**

Run: `npm run test:log -- --run tests/unit/TournamentBrandMark.test.ts`  
Expected: PASS.

Run: `npm run lint:log`  
Expected: PASS.

Run: `npm run build:log`  
Expected: PASS.

**Step 6: Commit**

```bash
git add src/components/common/TournamentBrandMark.vue src/features/tournaments/views/TournamentListView.vue src/features/tournaments/views/TournamentDashboardView.vue src/features/public/views/PublicScheduleView.vue src/features/public/views/PublicPlayerView.vue src/features/public/views/PublicBracketView.vue src/features/public/views/PublicScoringView.vue tests/unit/TournamentBrandMark.test.ts
git commit -m "feat(branding): add tournament logos to organizer and public views"
```

---

## Task 5: Update Overlay Views For Structured Sponsor Logos And Tournament Branding

**Files:**
- Modify: `src/features/overlay/views/OverlayBoardView.vue`
- Modify: `src/features/overlay/views/OverlayTickerView.vue`
- Modify: `src/features/overlay/views/OverlayCourtView.vue`
- Modify: `tests/unit/OverlayBoardView.test.ts`
- Create: `tests/unit/OverlayTickerView.branding.test.ts`

**Step 1: Write the failing tests**

Add or update tests that verify:

```typescript
it('orders sponsor logos by displayOrder and falls back to sponsor names', async () => {
  runtime.currentTournament = {
    id: 't1',
    name: 'Spring Open',
    tournamentLogo: {
      url: 'https://example.com/logo.png',
      storagePath: 'tournaments/t1/branding/logo/logo.png',
    },
    sponsors: [
      {
        id: 's2',
        name: 'Second',
        logoUrl: 'https://example.com/second.png',
        logoPath: 'tournaments/t1/branding/sponsors/s2/second.png',
        displayOrder: 2,
      },
      {
        id: 's1',
        name: 'First',
        logoUrl: '',
        logoPath: '',
        displayOrder: 1,
      },
    ],
  };

  const wrapper = mountView();
  await flushPromises();

  expect(wrapper.text()).toContain('First');
});
```

In the ticker-specific test, assert that the compact tournament logo block renders when `tournamentLogo.url` exists.

**Step 2: Run test to verify it fails**

Run: `npm run test:log -- --run tests/unit/OverlayBoardView.test.ts tests/unit/OverlayTickerView.branding.test.ts`  
Expected: FAIL because the overlays still assume `sponsors: string[]`.

**Step 3: Implement minimal overlay changes**

Use `useTournamentBranding()` in all three overlay views.

For `OverlayBoardView.vue`:

1. replace `sponsorsText` with normalized sponsor rendering,
2. show sponsor logos first,
3. keep a text fallback when a sponsor has no logo or the image fails,
4. preserve the current board layout hierarchy.

For `OverlayTickerView.vue` and `OverlayCourtView.vue`:

1. add a compact tournament logo treatment,
2. keep the scoring/status content dominant,
3. do not introduce clickable sponsor links in overlays.

**Step 4: Run verification**

Run: `npm run test:log -- --run tests/unit/OverlayBoardView.test.ts tests/unit/OverlayTickerView.branding.test.ts`  
Expected: PASS.

Run: `npm run lint:log`  
Expected: PASS.

Run: `npm run build:log`  
Expected: PASS.

**Step 5: Commit**

```bash
git add src/features/overlay/views/OverlayBoardView.vue src/features/overlay/views/OverlayTickerView.vue src/features/overlay/views/OverlayCourtView.vue tests/unit/OverlayBoardView.test.ts tests/unit/OverlayTickerView.branding.test.ts
git commit -m "feat(branding): add tournament and sponsor branding to overlays"
```

---

## Task 6: End-To-End Verification And Manual Smoke

**Files:**
- No new source files unless defects are found during verification

**Step 1: Run the focused unit suite**

Run:

```bash
npm run test:log -- --run \
  tests/unit/useTournamentBranding.test.ts \
  tests/unit/tournamentBrandingStorage.test.ts \
  tests/unit/TournamentBrandingCard.test.ts \
  tests/unit/TournamentBrandMark.test.ts \
  tests/unit/OverlayBoardView.test.ts \
  tests/unit/OverlayTickerView.branding.test.ts
```

Expected: PASS.

**Step 2: Run lint and build**

Run: `npm run lint:log`  
Expected: PASS.

Run: `npm run build:log`  
Expected: PASS.

**Step 3: Manual smoke in the app**

Run:

```bash
npm run emulators:log
npm run dev:log
```

Then verify manually:

1. open a tournament settings page,
2. upload one tournament logo,
3. add two sponsors with different display orders,
4. save successfully,
5. confirm the tournament list card shows the tournament logo,
6. confirm public schedule, player, bracket, and scoring pages show the tournament logo,
7. confirm overlay board shows sponsor branding in order,
8. confirm a tournament with legacy string sponsors still renders text safely.

**Step 4: Record Debug KB entries if needed**

If any `:log` command fails:

1. capture the fingerprint,
2. search `docs/debug-kb/index.yml`,
3. apply the documented fix or create a new KB entry before retrying.

**Step 5: Commit**

If verification required source fixes, stage only the touched files and commit them with a focused message. If no fixes were needed, do not create an extra no-op commit.

---

## Notes For The Implementer

1. Keep the rollout backward compatible. Legacy `string[]` sponsors are not optional behavior; they are part of the acceptance criteria.
2. Do not modify `TournamentCreateView.vue` in v1 unless a later task proves it is necessary. Branding management belongs in tournament settings.
3. Do not add drag-and-drop or external upload libraries.
4. Prefer small shared primitives like `TournamentBrandMark.vue` over broad visual refactors.
