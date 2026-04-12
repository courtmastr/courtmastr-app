# Production Demo Seed

This runbook creates or reuses the isolated CourtMastr production demo data set.

## Scope

The demo seed writes only:

- `orgSlugIndex/demo`
- `organizations/{demoOrgId}` where `name` is `CourtMastr Demo Club`
- `organizations/{demoOrgId}/members/{operatorUid|demoOrganizerUid}`
- `users/{demoOrganizerUid}`
- `tournaments/{demoTournamentId}` where `name` is `CourtMastr Feature Demo` and `orgId` is the demo org
- `tournaments/{demoTournamentId}/...` subcollections
- demo player records and `playerEmailIndex` entries using `demo.courtmastr.local`

It must not write to TNF, MCIA, or any other production organization.

## Local Validation

Start emulators:

```bash
npm run emulators
```

In another terminal:

```bash
npm run seed:demo:local
```

Expected local access:

- Admin: `admin@courtmastr.com` / `admin123`
- Demo organizer: `demo-organizer@courtmastr.com` / `demo123`
- Check-in PIN: `1111`
- Scoring PIN: `2222`

Verify:

- Public org page: `/demo`
- Tournament list shows `CourtMastr Feature Demo`
- Categories, courts, registrations, brackets, schedules, live scoring, and leaderboard render with demo data
- Volunteer check-in and scoring access accept the local PINs

## Production Run

Set secrets in the shell without committing them:

```bash
COURTMASTR_SEED_OPERATOR_EMAIL="<admin email>" \
COURTMASTR_SEED_OPERATOR_PASSWORD="<admin password>" \
COURTMASTR_DEMO_ORGANIZER_PASSWORD="<shared demo password>" \
COURTMASTR_DEMO_CHECKIN_PIN="<optional 4-8 digit PIN>" \
COURTMASTR_DEMO_SCOREKEEPER_PIN="<optional 4-8 digit PIN>" \
npm run seed:demo:prod
```

The seed operator must already be an admin in production. The script pauses for five seconds before writing.

## Production Verification

After the command completes, verify:

- `orgSlugIndex/demo` points to the printed demo org ID.
- `organizations/{demoOrgId}.name` is `CourtMastr Demo Club`.
- `tournaments/{demoTournamentId}.name` is `CourtMastr Feature Demo`.
- `tournaments/{demoTournamentId}.orgId` is the printed demo org ID.
- The demo organizer appears in `organizerIds`.
- Categories include Men’s Singles, Men’s Doubles, and Mixed Doubles.
- `match_scores` exists under demo categories; do not use `/matches`.
- `/demo` loads publicly in production.
- The shared demo organizer can sign in and see only the demo org context.

## Re-runs

Re-running the seed reuses the existing demo tournament and merges demo access. It does not delete or reset existing demo data. Plan a separate reset flow if testers need a clean sandbox after mutations.
