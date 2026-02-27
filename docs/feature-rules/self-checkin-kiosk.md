# Self Check-In Kiosk

## Basic Rules / Business Logic
- Self check-in searches approved registrations by participant name.
- Singles and doubles paths support one-person or partner-inclusive check-in.
- Presence updates map to registration status only when completion criteria are met.

## Workflow (ASCII)
`[Search Name] -> [Select Candidate] -> [Submit Presence] -> [Success/Partner Pending]`

## Test Coverage
- Direct: `tests/unit/SelfCheckInView.test.ts`, `tests/unit/useSelfCheckIn.test.ts`, `tests/unit/selfCheckInDomain.test.ts`
- Indirect: `e2e/p0-self-checkin-kiosk.spec.ts`, `tests/unit/selfCheckInRoute.test.ts`

## Source References
- `src/features/checkin/views/SelfCheckInView.vue`
- `src/features/checkin/composables/useSelfCheckIn.ts`
- `src/stores/registrations.ts`
