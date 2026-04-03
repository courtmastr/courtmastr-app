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
5. Open a PR with review evidence attached.
6. Prefer merging via PR into `master` using the repository's merge policy.
7. Let the `master` CI/CD workflow handle production deployment automatically.
8. Do not run manual production deploy commands from feature branches or from local `master`.

## Merge Policy

1. Keep PR scope narrow (single feature/fix theme).
2. Avoid stacking unrelated work in one branch.
3. Prefer PR merges into `master` for grouped milestones, review traceability, and release automation.
4. Production rollout happens after the PR merge via the `master` workflow, not from a local shell.
5. If urgent production issue exists, use `hotfix/<scope>` flow only.

## Hotfix Flow

1. Branch `hotfix/<scope>` from current `master`.
2. Implement minimal patch.
3. Run full release gates.
4. Merge to `master` via PR when feasible; if time-critical, use the approved emergency path.
5. Allow the `master` auto-deploy workflow to release the merged hotfix.
6. Back-merge hotfix branch into active feature branches when needed.
