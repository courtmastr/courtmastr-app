# CourtMastr API Audit and Reference (2026-03-04)

## Scope
- Backend surface reviewed: Firebase Cloud Functions in `functions/src/*.ts`
- Client usage reviewed: `httpsCallable` call sites in `src/`
- Standards lens: OWASP API Security Top 10 themes (authn/authz, abuse controls, data exposure, error handling), plus Firebase callable best practices

## API Inventory (Current Contract)

| Endpoint | Type | Request Payload | AuthN | AuthZ | Primary Callers |
|---|---|---|---|---|---|
| `generateBracket` | Callable | `{ tournamentId, categoryId }` (extra fields ignored) | Required | Role check: `admin` or `organizer` (global role only) | `src/stores/tournaments.ts` (flagged off) |
| `generateSchedule` | Callable | `{ tournamentId }` (extra fields ignored) | Required | Role check: `admin` only | `src/stores/tournaments.ts` (flagged off) |
| `advanceWinner` | Callable | `{ tournamentId, matchId, winnerId }` | Not required | None | `src/stores/matches.ts` (flagged off) |
| `updateMatch` | Callable | `{ tournamentId, categoryId, matchId, status, winnerId?, scores? }` | Required | None beyond auth presence | `src/stores/matches.ts` (flagged off) |
| `submitBugReport` | Callable | `{ description, pageUrl?, browserInfo?, screenshotUrl? }` | Required | Any authenticated user | `src/components/layout/AppLayout.vue` |
| `searchSelfCheckInCandidates` | Callable | `{ tournamentId, query }` | Not required | None | `src/features/checkin/composables/useSelfCheckIn.ts` |
| `submitSelfCheckIn` | Callable | `{ tournamentId, registrationId, participantIds[] }` | Not required | Registration-scoped participant check only | `src/features/checkin/composables/useSelfCheckIn.ts` |
| `healthCheck` | HTTP | none | Not required | None | Operational/manual checks |

## Findings (Prioritized)

### API-001 (Critical): `advanceWinner` has no authentication or authorization checks
- Evidence: `functions/src/index.ts:117` to `functions/src/index.ts:171` (no `request.auth` validation)
- Risk: any unauthenticated caller can update bracket outcomes via Admin SDK privileges.
- Standards gap: Broken Function Level Authorization / Broken Object Level Authorization.
- Recommendation:
  1. Require auth.
  2. Enforce role + tournament membership (`admin` or tournament organizer/scorekeeper).
  3. Validate request schema strictly.

### API-002 (High): `updateMatch` only checks `request.auth` existence, not caller permissions
- Evidence: `functions/src/updateMatch.ts:17` to `functions/src/updateMatch.ts:47`
- Risk: any authenticated user can potentially modify scores/status for arbitrary tournament/category IDs.
- Standards gap: missing object-level authorization for mutable operations.
- Recommendation:
  1. Verify role and tournament-level permission before writes.
  2. Add positive allowlist per action (`scorekeeper`/`organizer`/`admin`).

### API-003 (High): `generateBracket` uses global role check, not tournament-scoped authorization
- Evidence: `functions/src/index.ts:45` to `functions/src/index.ts:53`
- Risk: any user with `organizer` role can operate on tournaments they may not own.
- Standards gap: function-level authz is not scoped to target resource ownership.
- Recommendation:
  1. Reuse tournament membership check (same logic style as Firestore rules `isOrganizerOf(tournamentId)`).
  2. Deny when organizer is not assigned to target tournament.

### API-004 (High): Public self-check-in callables are unauthenticated and enumerable
- Evidence: `functions/src/selfCheckIn.ts:53` and `functions/src/selfCheckIn.ts:122` (no auth/app gate)
- Risk:
  1. Candidate enumeration by name/category.
  2. Automated check-in abuse or scripted spam.
- Standards gap: weak anti-automation and endpoint hardening on public mutation/search endpoints.
- Recommendation:
  1. If endpoint must stay public, add App Check enforcement or kiosk session token.
  2. Add rate limiting per IP/device/session.
  3. Reduce returned fields to minimum needed for selection UI.

### API-005 (High): No abuse/rate limiting on high-impact callables
- Evidence: no rate limiter/throttling logic in:
  - `functions/src/bugReport.ts`
  - `functions/src/selfCheckIn.ts`
  - `functions/src/updateMatch.ts`
- Risk: GitHub issue spam, check-in spam, high write amplification, quota/cost spikes.
- Standards gap: missing API4-style resource/abuse controls.
- Recommendation:
  1. Add per-user/IP throttling (Firestore counter windows or managed edge control).
  2. Add idempotency key for `submitBugReport` to prevent duplicate retries.

### API-006 (Medium): Internal error messages are returned directly to clients
- Evidence:
  - `functions/src/index.ts:60` to `functions/src/index.ts:63`
  - `functions/src/index.ts:106` to `functions/src/index.ts:109`
  - `functions/src/index.ts:166` to `functions/src/index.ts:168`
  - `functions/src/updateMatch.ts:186` to `functions/src/updateMatch.ts:189`
  - `functions/src/bugReport.ts:146` to `functions/src/bugReport.ts:149`
- Risk: backend internals leak through user-visible errors.
- Standards gap: insufficient error sanitization.
- Recommendation:
  1. Return stable public error codes/messages.
  2. Log detailed stack/context server-side with correlation ID.

### API-007 (Medium): Secret management for GitHub integration is not hardened
- Evidence:
  - `functions/src/bugReport.ts:12` to `functions/src/bugReport.ts:14` uses `process.env.*`
  - local root `.env` contains GitHub token material (`.env:1`)
- Risk: operational secret leakage risk and inconsistent production secret handling.
- Standards gap: not using managed secret rotation/access controls by default.
- Recommendation:
  1. Move GitHub credential to Firebase/Google Secret Manager-backed function secret.
  2. Prefer GitHub App or fine-grained token over long-lived PAT.
  3. Add startup guard that fails closed when secret binding is missing.

### API-008 (Medium): Contract drift between client payloads and callable handlers
- Evidence:
  - Client sends extra schedule/bracket options: `src/stores/tournaments.ts:1009` and `src/stores/tournaments.ts:1403`
  - Handler only consumes minimal fields: `functions/src/index.ts:35` and `functions/src/index.ts:81`
  - Global API types are stale relative to callable contract: `src/types/index.ts:517` to `src/types/index.ts:532`
- Risk: caller confusion, silent no-op parameters, brittle future migrations.
- Standards gap: no single source of truth for API contract/schema.
- Recommendation:
  1. Define shared request/response schemas and validate at runtime.
  2. Align caller payloads and remove ignored fields.

### API-009 (Low): `healthCheck` is open and method-agnostic
- Evidence: `functions/src/index.ts:207` to `functions/src/index.ts:212`
- Risk: low direct risk, but can increase unauthenticated traffic/noise.
- Standards gap: missing basic hardening (method restriction, cache and lightweight abuse guard).
- Recommendation:
  1. Restrict to `GET`.
  2. Add simple cache headers and minimal request logging.

### API-010 (Medium): No backend function test suite for callable authorization and payload validation
- Evidence: no function test files found under `functions/` (`rg --files functions | rg "(test|spec)\\.(ts|js)$"` returned empty)
- Risk: authz regressions and contract breaks can ship unnoticed.
- Standards gap: missing regression tests on security-critical API boundaries.
- Recommendation:
  1. Add emulator-backed tests for each callable path (auth success/fail + invalid payloads).
  2. Gate deployment on function test pass.

## Positive Controls Already Present
- Structured Firebase callable errors are used (`HttpsError`) in all callables.
- `submitSelfCheckIn` uses transaction semantics for consistency (`functions/src/selfCheckIn.ts:134`).
- Score and timestamp writes generally use server timestamps (e.g., `FieldValue.serverTimestamp()`).
- Storage rules constrain bug screenshot type/size and upload ownership (`storage.rules:15` to `storage.rules:27`).

## Recommended Fix Plan (Phased)

### Phase 0 (Immediate: Block Critical/High)
1. Patch `advanceWinner` auth + authz.
2. Patch `updateMatch` authz.
3. Add tournament-scoped authz to `generateBracket`.
4. Add abuse controls (rate limits/App Check) for self-check-in and bug report endpoints.

### Phase 1 (Contract Hardening)
1. Introduce shared runtime schemas for all callable payloads.
2. Remove or implement currently ignored payload fields.
3. Standardize error contract (`code`, `message`, `correlationId`).

### Phase 2 (Operational Hardening)
1. Move GitHub secret handling to managed secrets with rotation policy.
2. Add backend callable integration tests in `functions/`.
3. Add endpoint-level observability metrics (error rates, throttle events, authz denials).

## Notes
- This document is an audit and documentation artifact only; no production behavior was changed.
- Several callable paths are currently feature-flagged off on the frontend, but they remain deployable backend surface and should still be secured.
