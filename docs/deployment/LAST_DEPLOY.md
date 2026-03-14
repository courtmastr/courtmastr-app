# Last Deploy Record

Updated: 2026-03-14 (America/Chicago)

## Latest Production Deploy

- Date: 2026-03-14 12:31 CDT
- Deployed branch: `master`
- Deployed commit: `c05ceaa` (`merge: add Firebase env preflight guard for deploy/build`)
- Commands:
  - `npm run deploy:log`
- Firebase project: `courtmaster-v2`
- Hosting URL: `https://courtmaster-v2.web.app`
- Deploy result:
  - Hosting: released successfully
  - Functions: unchanged/skipped (no function source changes)
- Build log artifact from deploy-log run:
  - `docs/debug-kb/_artifacts/2026-03-14-17-31-22.npm-run-build.log`
- Incident note:
  - Earlier 2026-03-14 deployment built in a worktree missing `.env.production`, causing `auth/invalid-api-key` in production.
  - Recovery completed by redeploying with valid Firebase env and then adding `check:firebase-env` preflight guard.

## Last Confirmed Firebase Deploy (Artifact-Backed)

- Date: 2026-02-18 06:34:10 -0600
- Command: `firebase deploy --only hosting --project production`
- Project: `courtmaster-v2`
- Hosting URL: `https://courtmaster-v2.web.app`
- Artifact: `docs/debug-kb/_artifacts/2026-02-18-06-34-10.firebase-deploy-only-hosting-project-production.log`
- Status: ✅ success (hosting deploy complete)

## Latest Production Merge Milestone

- Date: 2026-03-14 11:31:40 -0500
- Commit: `5c3fa50faf00b218acb10ecaf3b730b92fa844aa`
- Message: `merge: Horizon 1+2 brand rollout`
- Note: deploy output for this merge is not currently recorded in `docs/debug-kb/_artifacts`.
