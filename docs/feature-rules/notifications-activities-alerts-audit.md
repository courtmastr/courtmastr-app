# Notifications Activities Alerts Audit

## Basic Rules / Business Logic
- Notification subscriptions emit unread toast events and maintain unread state.
- Activity, alert, and audit feeds subscribe in realtime with connection-loss handling.
- Audit logging must include actor metadata when available and degrade safely when absent.

## Workflow (ASCII)
`[Subscribe Feed] -> [Snapshot Update] -> [Transform + Store] -> [UI Counters/Toasts]`

## Test Coverage
- Direct: `tests/unit/notifications.store.test.ts`, `tests/unit/activities.store.test.ts`, `tests/unit/alerts.store.test.ts`, `tests/unit/audit.store.test.ts`, `tests/integration/ops-stores.integration.test.ts`
- Indirect: `tests/unit/FrontDeskCheckInView.test.ts`, `tests/unit/MatchControlView.assignments.test.ts`

## Source References
- `src/stores/notifications.ts`
- `src/stores/activities.ts`
- `src/stores/alerts.ts`
- `src/stores/audit.ts`
