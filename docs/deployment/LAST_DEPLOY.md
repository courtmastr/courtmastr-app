# Last Deploy Record

Updated: 2026-03-15 (America/Chicago)

## Latest Production Deploy

- Date: 2026-03-15 08:33 CDT
- Deployed branch: `master`
- Deployed commit: `96ead60` (`merge: finalize horizon 2 foundation polish`)
- Commands:
  - `npm run deploy`
  - `npm run deploy:log`
- Firebase project: `courtmaster-v2`
- Hosting URL: `https://courtmaster-v2.web.app`
- Deploy result:
  - Hosting: released successfully
  - Functions: unchanged/skipped on both deploy runs
- Build log artifact from deploy-log run:
  - `docs/debug-kb/_artifacts/2026-03-15-13-32-26.npm-run-build.log`
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

- Date: 2026-03-15 08:31:00 -0500
- Commit: `96ead606cacd08b283e7998f3aa932581ee5e89d`
- Message: `merge: finalize horizon 2 foundation polish`
- Note: deployed via `npm run deploy` and `npm run deploy:log` on 2026-03-15.
