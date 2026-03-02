# TypeScript Standards Hardening Design

**Date:** 2026-03-02  
**Scope:** Production code only (`src/`) with safe refactors allowed  
**Priority Areas:**
1. Check-in + Leaderboard
2. Routing + Guards + Auth
3. Core Stores/Services

---

## Objective

Raise TypeScript quality standards across high-impact production paths without changing runtime behavior. The intent is to replace weak typing patterns (`any`, broad casts, implicit contracts) with explicit, compile-safe models using advanced TypeScript patterns.

## Constraints and Non-Goals

- No user-facing behavior changes.
- No Firestore schema/path changes.
- No auth/security rule changes.
- No broad repo-wide rewrite in this iteration.
- Tests and type-checks remain the source of truth for safety.

## Architecture

### 1. Small Domain Typing Layer

Add/extend minimal shared types in `src/types/`:
- Branded IDs for key entities (`TournamentId`, `CategoryId`, `RegistrationId`, `MatchId`)
- Common service boundary result shapes (`Result<T, E>`)
- Narrow unions for status/state values used by check-in and leaderboard

This layer stays minimal and pragmatic; it supports feature hardening without introducing a type framework.

### 2. Feature Hardening Layers (Execution Order)

#### A. Check-in + Leaderboard
- Define explicit view-model/DTO contracts for UI consumption.
- Use discriminated unions for row/state rendering paths.
- Replace weak `Record<string, any>` or inferred object bags with typed records keyed by branded IDs.
- Keep all ranking/check-in logic behaviorally identical.

#### B. Routing + Guards + Auth
- Replace `next: any` with proper Vue Router guard signatures.
- Define typed route meta contract (auth and role requirements).
- Add typed role predicates/utilities to avoid duplicated unsafe checks.

#### C. Stores + Services
- Harden Firestore adapters/helpers with constrained generics.
- Type update payloads with mapped/partial utility types where needed.
- Remove `any` usage in transformation helpers through explicit generic constraints.

### 3. Safety Rails

- Type-only hardening + safe refactors.
- Extract pure typed helper utilities instead of broad inline casting.
- Avoid introducing new `as unknown as` double-casts in production paths.

## Advanced TypeScript Patterns to Apply

- **Branded types** for entity/document IDs.
- **Discriminated unions** for UI/state branching.
- **Generic constraints** for shared service helpers.
- **Mapped types** for safe patch/update payloads.
- **Conditional utility typing** only where it directly improves safety/readability.

Use YAGNI: introduce complexity only when it removes real ambiguity or runtime risk.

## Data Flow Design

### Check-in and Leaderboard
- Raw store/service data is normalized into typed feature DTOs.
- Components consume typed DTOs only (not loosely typed store internals).
- Ranking/check-in status transitions are represented with constrained unions.

### Guards/Auth
- Route metadata is explicitly typed and validated by guard helper functions.
- Role checks use typed predicates with predictable boolean contracts.

### Stores/Services
- Firestore serialization/normalization helpers use typed generic boundaries.
- Update APIs accept safe key/value combinations via mapped partial types.

## Error Handling Design

- Keep current runtime behavior while improving compile-time safety.
- Catch blocks use `unknown`, narrowed through type guards.
- Service boundaries return typed success/error shapes where currently implicit.

## Testing and Verification Strategy

After each phase:
1. `npm run type-check`
2. Run targeted suites for touched areas with `npm run test:log -- --run ...`
3. Keep test additions focused on typing contracts and behavior invariance.

## Rollout Plan

1. Phase A: Check-in + Leaderboard
2. Phase B: Routing + Guards + Auth
3. Phase C: Stores + Services

Each phase should be independently reviewable and commit-sized.

## Acceptance Criteria

- No new `any` or unsafe casts introduced in targeted production files.
- Check-in/leaderboard state models are explicit and discriminated.
- Route guards and route meta contracts are compile-safe and explicit.
- Targeted store/service helper typing is hardened with constrained generics.
- `npm run type-check` passes and impacted tests pass.
- Runtime behavior remains unchanged.
