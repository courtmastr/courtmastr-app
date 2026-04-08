# TNF 2026 Seed Refresh Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refresh the TNF 2026 seed flow so local and production both load `TNF_Final_List_2026.xlsx`, create the TNF organization and organizer account, and seed `TNF Badminton - 2026`.

**Architecture:** Keep workbook parsing and tournament creation in the shared TNF 2026 seed core, then make both local and production entry points perform the same TNF organization bootstrap before invoking that shared core. This keeps local as the rehearsal environment for the exact production import path while limiting changes to the TNF seed surface.

**Tech Stack:** TypeScript, Firebase Auth, Firestore, XLSX, npm scripts

---

### Task 1: Refresh Shared TNF 2026 Defaults

**Files:**
- Modify: `/Users/ramc/Documents/Code/courtmaster-v2/scripts/seed/tnf2026-core.ts`
- Test: local seed console output from `npm run seed:tnf2026:local`

**Step 1: Update shared TNF 2026 defaults**

- Change the default tournament name to `TNF Badminton - 2026`.
- Change the default workbook path to `TNF_Final_List_2026.xlsx`.
- Update any TNF-specific descriptive strings that are now stale if they would mislead operators.

**Step 2: Review workbook-driven assumptions**

- Inspect the fixed category column mapping in `CATEGORY_CONFIGS`.
- Keep the parser shape unchanged unless the new workbook proves a mapping issue during local seed verification.

**Step 3: Verify TypeScript surface is still minimal**

- Ensure the shared seed signature still accepts overrides for `orgId`, `organizerIds`, `tournamentName`, and `workbookPath`.

### Task 2: Mirror TNF Org Bootstrap in Production

**Files:**
- Modify: `/Users/ramc/Documents/Code/courtmaster-v2/scripts/seed/tnf2026-prod.ts`
- Reuse: `/Users/ramc/Documents/Code/courtmaster-v2/scripts/seed/helpers.ts`

**Step 1: Align production user setup with local**

- Create or reuse `tnf-organizer@courtmastr.com` with password `tnf123`.
- Keep the existing admin seed user setup.

**Step 2: Create or reuse TNF organization**

- Use `createSeedOrg()` with `Tamilnadu Foundation (TNF)` and slug `tnf`.
- Add the TNF organizer as an org member with role `organizer`.
- Set `activeOrgId` on the TNF organizer user document.

**Step 3: Seed the tournament through the shared TNF core**

- Pass `orgId` for the TNF org.
- Pass `organizerIds` including the TNF organizer.
- Pass tournament name `TNF Badminton - 2026`.

**Step 4: Update production console output**

- Print the TNF org ID and organizer login so production operators can verify the result.

### Task 3: Make `seed:prod` TNF-Only

**Files:**
- Modify: `/Users/ramc/Documents/Code/courtmaster-v2/package.json`
- Modify: `/Users/ramc/Documents/Code/courtmaster-v2/scripts/seed/README.md`
- Modify: `/Users/ramc/Documents/Code/courtmaster-v2/scripts/seed/production.ts` if needed for consistency or operator guidance

**Step 1: Repoint the top-level production seed command**

- Update `npm run seed:prod` so it executes the TNF 2026 production seed path.

**Step 2: Keep documentation honest**

- Update README text so operators know `seed:prod` is now TNF-only.

### Task 4: Keep Local TNF Seed Explicit and Consistent

**Files:**
- Modify: `/Users/ramc/Documents/Code/courtmaster-v2/scripts/seed/tnf2026-local.ts`

**Step 1: Align local seed parameters**

- Update local tournament name to `TNF Badminton - 2026`.
- Let local rely on the updated shared workbook default unless an explicit override is still useful.

**Step 2: Keep local messaging accurate**

- Update local console output if needed so it reflects the new tournament name and workbook expectation.

### Task 5: Update Seed Documentation

**Files:**
- Modify: `/Users/ramc/Documents/Code/courtmaster-v2/scripts/seed/README.md`

**Step 1: Update workbook prerequisite**

- Replace references to the old TNF workbook filename with `TNF_Final_List_2026.xlsx`.

**Step 2: Update TNF seed behavior notes**

- Document that both local and production TNF 2026 seeds create the TNF org and TNF organizer account.
- Document that the TNF production seed is intended to load TNF only and now backs `npm run seed:prod`.

### Task 6: Verify Locally

**Files:**
- Evidence only; no file required unless parser issues force code changes

**Step 1: Run local TNF seed path**

Run:
```bash
npm run emulators
```

In a second terminal:
```bash
npm run seed:tnf2026:local
```

Expected:
- seed completes without runtime error
- console prints TNF org ID and tournament ID

**Step 2: Inspect seeded records**

- Confirm the TNF org exists.
- Confirm `tnf-organizer@courtmastr.com` has TNF membership and `activeOrgId`.
- Confirm a tournament named `TNF Badminton - 2026` exists under that org.

**Step 3: If the workbook mapping fails, correct only the mapping layer**

- Limit parser fixes to `tnf2026-core.ts`.
- Do not introduce a second TNF parser path.

### Task 7: Run Required Build Verification

**Files:**
- Evidence only

**Step 1: Run build gate**

Run:
```bash
npm run build
```

**Step 2: Run logged build gate**

Run:
```bash
npm run build:log
```

**Step 3: Capture any Debug KB fingerprint if a `:log` command fails**

- Follow `docs/debug-kb/` protocol if `npm run build:log` fails.

### Task 8: Prepare Production Handoff

**Files:**
- Evidence only unless follow-up docs are needed

**Step 1: Summarize exact production seed command**

Run later, after local verification and user approval:
```bash
npm run seed:prod
```

**Step 2: Record the operator checks**

- TNF org exists
- TNF organizer login works
- tournament name is `TNF Badminton - 2026`
- imported registrations match the validated workbook
