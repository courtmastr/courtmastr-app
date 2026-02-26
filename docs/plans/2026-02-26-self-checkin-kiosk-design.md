# Self Check-In Kiosk Design

Date: 2026-02-26  
Status: Approved  
Scope: Add a public iPad-friendly self check-in flow that works with imported registrations and team-partner check-ins.

## 1. Problem and Goal

Tournament desks need a public self check-in surface where participants can quickly mark attendance without relying on email/OTP data (because imported registrations may not include it).

Goal: enable name-based self check-in with partner support while preserving existing assignment gates that rely on `registrations.status`.

## 2. Confirmed Product Decisions

- Entry point: public venue kiosk route.
- Discovery mode: search-only (no full participant list shown initially).
- Identity: participant selects disambiguated result (name + category + partner/team label).
- Actions: `Check In Me` and `Check In Me + Partner`.
- Scope guard: users can only check in self and directly linked partner/team, not arbitrary participants.
- Team completion rule: registration is fully checked in only when all required participants are present.

## 3. Approaches Considered

1. Status-only updates on registration docs.
2. Participant presence tracking + derived registration status. (Selected)
3. Front-desk confirmation queue before status mutation.

Selected approach #2 is the smallest design that correctly models partial team arrival and partner-assisted check-in.

## 4. UX Flow

1. User opens `/tournaments/:tournamentId/self-checkin` on iPad.
2. User types at least 2 characters in search input.
3. System returns matching participants (minimal card details only).
4. User picks their card.
5. User chooses:
   - `Check In Me`
   - `Check In Me + Partner` (when partner/team exists)
6. Success panel shows:
   - participants marked present,
   - registrations now fully checked in,
   - registrations still waiting on partner.
7. Screen auto-resets to search for next person.

## 5. Data Model and State Semantics

Keep `registrations.status` as authoritative for operational gates.

Add participant presence tracking per registration:

- `participantPresence: { [playerId: string]: true }`
- Optional metadata for audit: `checkInSource`, `checkedInAt` (server timestamp)

Derivation:

- Singles: `status = checked_in` when the one required participant is present.
- Team/doubles: `status = checked_in` only when all required participants are present.
- Partial team presence stays non-checked-in (usually `approved`) until complete.

## 6. Security and Kiosk Guardrails

- Route remains unauthenticated but limited to active check-in window.
- Search-only API behavior (no participant dump).
- Minimal result details (no email/phone).
- Rate limiting and cooldown for repeated failed lookups.
- Audit every self-check-in event with source `kiosk-self-checkin`.

## 7. Integration With Existing Admin/Match Control

- Admin check-in dashboard remains primary operations console.
- Self-check-in writes to same registration docs, so match-control check-in gate continues to work unchanged.
- Existing "Assign Anyway (Admin)" path remains available for exceptional cases.

## 8. MVP Scope

### In Scope (Now)

- Public self-check-in route and view.
- Search-only participant lookup with disambiguation.
- Self + partner check-in actions.
- Participant presence tracking and status derivation.
- Kiosk success/reset UX.

### Out of Scope (Later)

- QR token cryptographic verification.
- OTP/magic-link identity flow.
- Advanced analytics dashboard for kiosk conversions.

## 9. Acceptance Criteria

- Participant can self-check-in by typing name and selecting correct card.
- Duplicate names are resolvable via category + partner/team context.
- `Check In Me + Partner` marks both present when linked.
- Team registration moves to `checked_in` only when all required participants are present.
- Match Control gate behavior remains consistent with registration status.

## 10. Test Strategy

- Unit:
  - name lookup/disambiguation,
  - presence-to-status derivation (single, partial team, full team),
  - partner check-in action boundaries.
- Integration:
  - kiosk action updates registrations and status derivation correctly.
- E2E:
  - iPad flow: search -> select -> check in -> auto-reset.
