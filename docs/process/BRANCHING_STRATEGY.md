# CourtMastr Branching Strategy

This repository uses a short-lived branch model with `master` as the production branch.

## Branch Roles

- `master`
  - Production branch.
  - Must stay deployable.
  - Only updated by merge commits or reviewed PR merges.

- `feat/<scope>`
  - New features and UX changes.
  - Example: `feat/horizon3-landing-templates`.

- `fix/<scope>`
  - Bug fixes that are not urgent production incidents.

- `hotfix/<scope>`
  - Urgent production fixes branched from `master`, validated, and merged back immediately.

- `chore/<scope>`
  - Tooling, docs, or maintenance work.

## Standard Flow

1. Sync `master`.
2. Create a short-lived branch from `master`.
3. Implement small, focused commits.
4. Run required verification gates:
   - `npm run build`
   - `npm run build:log`
   - target tests + `npm run test:log -- --run <files>`
5. Open PR or merge with review evidence attached.
6. Deploy from merged `master`.

## Merge Policy

1. Keep PR scope narrow (single feature/fix theme).
2. Avoid stacking unrelated work in one branch.
3. Prefer merge commits for grouped milestones and traceability.
4. If urgent production issue exists, use `hotfix/<scope>` flow only.

## Hotfix Flow

1. Branch `hotfix/<scope>` from current `master`.
2. Implement minimal patch.
3. Run full release gates.
4. Merge to `master` and deploy immediately.
5. Back-merge hotfix branch into active feature branches when needed.
