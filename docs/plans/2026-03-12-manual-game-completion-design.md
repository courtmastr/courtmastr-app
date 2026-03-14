# Manual Game Completion Design

**Date:** 2026-03-12  
**Source:** Volunteer/mobile scoring bug report after accidental auto-clinch during live score entry  
**Status:** Approved

---

## Problem Summary

The current point-by-point scorer auto-completes a game as soon as the live score reaches a valid winning state. In practice, that is too aggressive for live tournament operation:

1. scorekeepers can accidentally tap `+1`,
2. the game commits immediately before they can recover,
3. the UI advances the game or match state from a transient mistake,
4. the scorer is forced into correction instead of simple undo.

The product goal is to make game completion an explicit scorer decision while keeping live scoring fast on mobile.

---

## Product Decisions Confirmed

1. Reaching a valid winning score must not auto-complete the game.
2. Once a winning score is reached, the scorer should only be able to `Undo Point` or `Complete Game`.
3. Point entry must stay locked until the scorer either confirms or undoes below the winning threshold.
4. Manual fallback remains available for rescue scenarios, but it is secondary to tap scoring.
5. The change should reuse the existing scorer and avoid a backend schema migration.

---

## Scope

### In Scope

1. Change point-by-point scoring so legal game-point states require explicit confirmation
2. Add a `Complete Game` action to the scorer UI
3. Lock additional point entry while a game is pending completion
4. Preserve `Undo Point` while completion is pending
5. Keep volunteer/mobile scoring flow working with this interaction model
6. Add tests covering pending completion, undo, and explicit match completion

### Out of Scope

1. Changing the manual fallback data model
2. Adding a new Firestore document shape for pending game state
3. Reworking tournament scoring rules or badminton validation logic
4. Redesigning score correction after a game is already completed

---

## Approaches Considered

### Option A: Explicit `Complete Game` Confirmation (Recommended)

Keep live point taps, but once the score reaches a valid game-ending state, freeze further point entry and require the scorer to tap `Complete Game`.

Pros:

1. Matches live scorekeeping behavior
2. Prevents accidental auto-clinch from committing the set
3. Keeps the fix localized to scoring state and UI behavior
4. Works well on mobile with a large dedicated confirmation button

Cons:

1. Adds one extra tap at the end of every game
2. Requires a new pending-completion state in the scorer interaction flow

### Option B: Auto-Complete With Timed Undo Window

Auto-complete the game but allow a short undo grace period before moving on.

Pros:

1. Minimal extra UI

Cons:

1. Still commits a mistaken score first
2. Relies on the scorer reacting quickly under pressure
3. More fragile and less predictable than explicit confirmation

### Option C: Auto-Complete Plus Immediate Score Correction

Keep the current auto-complete flow and rely on correction tools to repair mistakes.

Pros:

1. Smallest engineering change

Cons:

1. Solves the wrong problem
2. Makes normal live scoring feel unsafe
3. Forces recovery after state has already advanced

---

## Selected Strategy

Adopt **Option A: Explicit `Complete Game` Confirmation**.

The scorer should remain in control of when a game becomes final. Point entry stays fast, but the last step becomes deliberate instead of automatic.

---

## State Model

This change should remain a **UI/store interaction change**, not a persisted schema change.

Current model:

1. `GameScore.isComplete = true` makes the game final
2. match winner detection counts completed games only

New model:

1. score taps change only `score1` and `score2`
2. a legal winning score produces a **pending completion** state
3. pending completion is derived from `validateCompletedGameScore(...)`
4. only `Complete Game` sets `isComplete = true` and assigns `winnerId`
5. only completed games count toward match completion

The pending state should be computed from the current game rather than stored as a new Firestore field. That keeps the backend shape stable and limits the change to scorer behavior.

---

## UI Behavior

### Before game point

1. tapping a player score adds one point
2. `Undo Point` works as it does today
3. no completion CTA is shown

### At a valid winning score

1. both score cards stop accepting additional points
2. `Undo Point` remains enabled
3. a full-width `Complete Game` action appears
4. the scorer sees a short helper message explaining that the game is ready to confirm
5. the game does not move to `Previous Games` yet

### After `Complete Game`

1. the current game is marked complete
2. `winnerId` is set for that game
3. the next game opens if the match is still live
4. if enough completed games exist, then the match completes

### Mobile requirement

On narrow screens, `Complete Game` should be a large primary action below the score cards. The confirmation action must be visually separated from the score-tap targets.

---

## Store Behavior

The scoring logic in [matches.ts](/Users/ramc/Documents/Code/courtmaster-v2/src/stores/matches.ts) should change in two parts:

1. `updateScore()` no longer auto-completes a game when validation passes
2. a new explicit action such as `completeCurrentGame()` validates the current score and finalizes the game

Expected behavior:

1. if the current score is not a legal finish, `completeCurrentGame()` rejects
2. if the current score is a legal finish, it marks that game complete
3. then it checks whether the match is complete
4. only if the match is complete does it trigger the existing completion path

This keeps manual fallback and live scoring aligned around the same rule: only completed games count.

---

## Error Handling

Failure behavior should remain conservative:

1. invalid `Complete Game` tap shows a scoring validation error
2. failed persistence leaves the current score visible and uncommitted
3. `Undo Point` from a pending-completion score clears the pending state immediately
4. extra point taps while pending completion are ignored in the UI and store layer

---

## Testing Strategy

Required tests:

1. reaching `20-12` or `21-19` does not auto-complete the game on tap
2. once a winning score is reached, additional point taps are blocked
3. `Undo Point` from a pending-completion score unlocks point entry again
4. `Complete Game` marks the game complete and starts the next game
5. final-game confirmation is the only path that completes the match
6. volunteer scorekeeper routing and mobile scoring still work

Browser verification should confirm the exact operator flow:

1. tap into game-point state
2. see `Complete Game`
3. verify extra point taps do nothing
4. verify undo re-enables scoring
5. confirm the game explicitly

---

## Success Criteria

This design is complete when:

1. a mistaken game-point tap no longer commits the set,
2. scorekeepers can undo before confirmation,
3. the scorer advances only after explicit `Complete Game`,
4. mobile volunteer scoring remains fast and readable.
