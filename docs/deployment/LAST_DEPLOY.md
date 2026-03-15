# Last Deploy Record

Updated: 2026-03-15 (America/Chicago)

## Latest Production Deploy

- Date: 2026-03-15 08:18 CDT
- Deployed branch: `master`
- Deployed commit: `fa6a733` (`merge: release v1.1.0 horizon 1-3 completion`)
- Commands:
  - `npm run deploy`
  - `npm run deploy:log`
- Firebase project: `courtmaster-v2`
- Hosting URL: `https://courtmaster-v2.web.app`
- Deploy result:
  - Hosting: released successfully
  - Functions: updated on `npm run deploy` run, then skipped as unchanged on `npm run deploy:log`
- Build log artifact from deploy-log run:
  - `docs/debug-kb/_artifacts/2026-03-15-13-18-42.npm-run-build.log`
- Function URL evidence:
  - `healthCheck(us-central1)`: `https://healthcheck-s3armjwzja-uc.a.run.app`

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
