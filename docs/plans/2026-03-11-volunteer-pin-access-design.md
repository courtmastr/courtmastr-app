# Tournament Volunteer PIN Access Design

**Date:** 2026-03-11  
**Source:** Multi-role live-operations UX review and follow-up product decisions  
**Status:** Approved

---

## Problem Summary

CourtMaster already has global user roles and some role-gated routes, but the live tournament experience is still centered on a shared authenticated shell. In practice:

1. volunteers are exposed to director-oriented navigation,
2. check-in and scorekeeping are not tournament-scoped access modes,
3. the public registration screen still presents privileged role choices,
4. live-event safety depends too heavily on UI hiding instead of purpose-built access flows.

The primary goal is to make live multi-role use safe and easy before doing broader director/admin visual cleanup.

---

## Product Decisions Confirmed

1. Phase one optimizes for safer live multi-role use, not director polish first.
2. Volunteers should not use the standard email/password account login flow.
3. Volunteer access should be tournament-specific, not platform-global.
4. Check-in and scorekeeper access should use simple shared PIN entry.
5. Each tournament should have one shared `Check-in` PIN and one shared `Scorekeeper` PIN in phase one.
6. Volunteers should enter via direct tournament links and a PIN, not the normal login page.
7. Tournament admins should be able to reveal, reset, and invalidate these PINs at any time.
8. Public self-registration should not advertise privileged roles like organizer or scorekeeper.

---

## Scope

### In Scope

1. Tournament-scoped volunteer access model for `check-in` and `scorekeeper`
2. Direct volunteer access pages with PIN verification
3. Dedicated restricted shells for check-in and scorekeeper workflows
4. Tournament settings UI for PIN management
5. Immediate invalidation of volunteer sessions after PIN reset
6. Public register flow tightening so privileged roles are not self-selectable

### Out of Scope

1. Director/admin UI visual cleanup beyond what is required to support volunteer access
2. Multiple scorekeeper PINs per court or per station
3. Magic links, OTP, SMS verification, or email-based volunteer auth
4. Replacing the existing staff Firebase account login model
5. Broader Firestore security rule redesign outside volunteer-session needs

---

## Approaches Considered

### Option A: Tournament PIN Sessions (Recommended)

Keep current staff login for admins and organizers. Add tournament-specific volunteer access pages that verify a shared PIN and establish a short-lived, restricted volunteer session for either `check-in` or `scorekeeper`.

Pros:

1. Best match for low-friction volunteer access
2. Clean separation between staff auth and volunteer access
3. Tournament-local invalidation and reset behavior is straightforward
4. Supports restricted shells without granting platform-wide identities

Cons:

1. Requires a parallel volunteer-session model
2. Needs backend verification instead of route-only checks

### Option B: Hidden Shared User Accounts

Create behind-the-scenes Firebase users for volunteer roles, but hide that from the UI and let PIN entry sign in as those accounts.

Pros:

1. Reuses existing auth mechanics

Cons:

1. Pollutes the platform auth model with synthetic users
2. Harder cleanup and auditability
3. Higher risk of role leakage across tournaments

### Option C: Organizer Login With Kiosk Lock

Keep organizer login on volunteer devices and add a PIN-protected kiosk mode on top of it.

Pros:

1. Smallest implementation surface

Cons:

1. Weakest safety model
2. Leaves privileged auth active on volunteer devices
3. Does not meet the core product goal

---

## Selected Strategy

Adopt **Option A: Tournament PIN Sessions**.

This is the smallest architecture that gives volunteers a simple entry flow while keeping director-level permissions out of volunteer devices and volunteer UI surfaces.

---

## Access Model

CourtMaster will operate with two parallel access paths:

1. **Staff login**
   Existing admin and organizer users continue using the standard account login flow.

2. **Volunteer PIN access**
   Check-in and scorekeeper volunteers access the tournament through direct role-specific links and enter a shared tournament PIN.

Key rules:

1. Do not add a new global `checkin` platform user role.
2. Keep existing platform roles for real users: `admin`, `organizer`, `scorekeeper`, `player`, `viewer`.
3. Model volunteer access as tournament-scoped access configuration plus tournament-scoped sessions.
4. Do not route volunteer access through public signup or the normal login form.

---

## UI Architecture

### 1. Director Shell

The existing authenticated shell remains the operating surface for admins and organizers.

Responsibilities:

1. Full sidebar and staff navigation
2. Tournament dashboard and settings
3. Volunteer PIN management

### 2. Check-in Shell

A dedicated, stripped-down shell for front-desk operation.

Characteristics:

1. No global sidebar
2. No global search
3. No director breadcrumbs or tournament state controls
4. Single-purpose header with tournament name, role label, and exit action
5. Default working view is the existing front-desk check-in experience

### 3. Scorekeeper Shell

A dedicated, stripped-down shell for score entry.

Characteristics:

1. No global sidebar
2. No organizer-only actions
3. Mobile-first layout expectations
4. Default working flow is match list to scoring interface

### Route Shape

Planned route families:

1. `/tournaments/:tournamentId/checkin-access`
2. `/tournaments/:tournamentId/checkin-kiosk`
3. `/tournaments/:tournamentId/scoring-access`
4. `/tournaments/:tournamentId/scoring-kiosk`
5. `/tournaments/:tournamentId/scoring-kiosk/matches/:matchId`

Directors continue to use existing authenticated tournament routes.

---

## Tournament Settings Changes

Add a `Volunteer Access` section to tournament settings.

Required capabilities:

1. View status for check-in access and scorekeeper access
2. Reveal or mask PIN values
3. Reset PIN immediately
4. Copy direct access links
5. Enable or disable each volunteer role independently
6. Show last reset time and current access status

Behavioral rule:

1. Resetting a PIN invalidates the currently active volunteer sessions for that role immediately.

---

## Public Registration Tightening

The public register flow should stop presenting privileged role creation as a normal signup path.

Phase-one intent:

1. remove `Tournament Organizer` and `Scorekeeper` from public role selection,
2. keep public registration player-safe,
3. reserve privileged operational access for staff login and tournament-issued volunteer PIN entry.

This aligns the product surface with the intended trust model.

---

## Data Model

Add tournament-scoped volunteer access metadata under the tournament record or a dedicated tournament subdocument.

Suggested shape:

```ts
volunteerAccess: {
  checkin: {
    enabled: boolean;
    encryptedPin: string;
    pinRevision: number;
    updatedAt: Timestamp;
  };
  scorekeeper: {
    enabled: boolean;
    encryptedPin: string;
    pinRevision: number;
    updatedAt: Timestamp;
  };
}
```

Rules:

1. Store PINs encrypted at rest so admins can reveal current values later.
2. Never store plaintext PINs in client-readable documents or logs.
3. Use revision numbers so resets invalidate old sessions deterministically.
4. Keep this model tournament-local.

---

## Session and Authorization Flow

### Volunteer PIN Flow

1. Admin creates or resets a tournament PIN for a volunteer role.
2. Volunteer opens the direct tournament access URL for that role.
3. Volunteer enters the PIN.
4. Backend decrypts or securely verifies the stored PIN and returns a short-lived volunteer session.
5. The frontend loads the restricted shell for that role and tournament only.

### Session Constraints

Every volunteer session must be bound to:

1. `tournamentId`
2. `role`
3. `pinRevision`
4. expiration time

Every protected volunteer route must verify:

1. tournament matches the session,
2. role matches the shell,
3. session is not expired,
4. current tournament PIN revision matches the session revision.

If any check fails, access returns to PIN entry.

### Authorization Boundaries

`check-in` volunteer session can:

1. read tournament and registration data needed for front desk operation,
2. read near-term match context,
3. perform check-in actions only.

`check-in` volunteer session cannot:

1. access settings,
2. access match control,
3. change tournament state,
4. reach bracket or organizer actions outside the check-in flow.

`scorekeeper` volunteer session can:

1. read scoring-relevant tournament context,
2. read scorable matches,
3. submit scores through the score-entry flow.

`scorekeeper` volunteer session cannot:

1. access registrations,
2. access tournament settings,
3. access match control,
4. change tournament lifecycle state.

---

## Failure and Recovery Behavior

Volunteer flows must fail closed.

Required behaviors:

1. Wrong PIN shows a clear inline error and grants no access.
2. Disabled volunteer role shows a blocked-access state.
3. Expired session redirects back to PIN entry.
4. PIN reset invalidates current volunteer sessions immediately.
5. Missing or archived tournament blocks volunteer access gracefully.
6. Network failure during verification does not create any offline bypass.
7. Manual navigation to a staff route from a volunteer session redirects to the correct kiosk landing page or PIN entry.

---

## Rollout Sequence

### Phase 1

1. Tighten public register roles so privileged roles are not self-selected
2. Add tournament volunteer access configuration and PIN reset UI
3. Add volunteer PIN entry pages
4. Add dedicated check-in and scorekeeper shells
5. Add volunteer-session validation and route protection

### Phase 2

1. Harden backend/data-access checks where needed for volunteer mutations
2. Improve mobile scorekeeper ergonomics
3. Perform broader director/admin shell cleanup separately

---

## Testing and Verification Strategy

### Unit and Component Coverage

1. PIN validation state handling
2. Volunteer session expiry and revision mismatch handling
3. Restricted shell navigation behavior
4. Tournament settings PIN reset and enable/disable controls
5. Public register role list no longer exposes privileged options

### Integration Coverage

1. Check-in PIN opens only the check-in shell
2. Scorekeeper PIN opens only the scoring shell
3. Volunteer cannot reach staff routes by URL
4. PIN reset immediately invalidates active volunteer sessions

### End-to-End Coverage

1. Admin sets volunteer PINs in tournament settings
2. Check-in volunteer opens direct link, enters PIN, and checks in participants
3. Scorekeeper opens direct link, enters PIN, and submits a score
4. Public registration remains player-safe
5. Staff login and organizer flows remain intact

---

## Risks and Mitigations

1. **Risk:** Volunteer restrictions exist only in the Vue shell and are bypassable by URL.
   **Mitigation:** require backend-verified volunteer sessions and tournament/role/revision checks.

2. **Risk:** PIN reset does not fully invalidate existing access.
   **Mitigation:** bind sessions to `pinRevision` and reject mismatches on every protected entry point.

3. **Risk:** Revealable PIN storage weakens secrecy if stored carelessly.
   **Mitigation:** store PINs encrypted at rest, reveal only through staff-authorized settings flows, and avoid logging decrypted values.

4. **Risk:** Public signup continues to create privileged operational identities.
   **Mitigation:** remove privileged role choices from the public registration surface.

5. **Risk:** Scorekeeper shell remains too desktop-oriented for live use.
   **Mitigation:** treat mobile-first scoring ergonomics as explicit implementation acceptance criteria.

---

## Approval Record

1. Safer live multi-role access was prioritized ahead of director/admin UI cleanup.
2. Shared tournament PINs were approved over account login for volunteers.
3. Direct tournament links plus role PIN entry were approved as the volunteer entry flow.
4. Admin reveal/reset behavior with immediate invalidation was approved.
5. Shared role PINs were approved for phase one, with no per-court PIN expansion.
