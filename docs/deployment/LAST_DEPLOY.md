# Last Deploy Record

Current policy note: production infrastructure is Terraform-managed and production application rollout is expected to happen through the `master` CI/CD workflow. Older entries below may reference the previous local release command path because they are historical records.

Updated: 2026-04-10 (America/Chicago)

## Latest Production Deploy

- Date: 2026-04-10 16:18 CDT
- Release ID: `v2.1.0`
- Package version: `2.1.0`
- Deployed branch: `master`
- Deployed commit: `151b857` (`Merge pull request #6 from courtmastr/feat/tnf-2026-seed-refresh`)
- Release notes:
  - [docs/releases/v2.1.0.md](docs/releases/v2.1.0.md)
- Commands:
  - `npm run release:deploy`
  - `npm run deploy`
  - `npm run deploy:log`
- Firebase project: `courtmaster-v2`
- Hosting URL: `https://courtmaster-v2.web.app`
- Deploy result:
  - Release automation completed all guardrails before Firebase deploy
  - See deploy-log artifact for full Firebase output
- Deploy log artifact from deploy-log run:
  - `docs/debug-kb/_artifacts/2026-04-10-21-16-48.npm-run-build-firebase-deploy-project-production.log`

## Last Confirmed Firebase Deploy (Artifact-Backed)

- Date: 2026-02-18 06:34:10 -0600
- Command: `firebase deploy --only hosting --project production`
- Project: `courtmaster-v2`
- Hosting URL: `https://courtmaster-v2.web.app`
- Artifact: `docs/debug-kb/_artifacts/2026-02-18-06-34-10.firebase-deploy-only-hosting-project-production.log`
- Status: ✅ success (hosting deploy complete)
- Version evidence: unavailable
- Commit evidence: unavailable

## Previous Versioned Production Releases

- `v2.0.1`
  - Date: 2026-04-02 08:48 CDT
  - Package version: `2.0.1`
  - Deployed commit: `151df76`
  - Release notes:
    - [docs/releases/v2.0.1.md](docs/releases/v2.0.1.md)
- `v2.0.0`
  - Date: 2026-04-02 01:03 CDT
  - Package version: `2.0.0`
  - Deployed commit: `835f652`
  - Release notes:
    - [docs/releases/v2.0.0.md](docs/releases/v2.0.0.md)
- `v1.1.0+deploy.2`
  - Date: 2026-03-15 08:33 CDT
  - Package version: `1.1.0`
  - Deployed commit: `96ead60`
  - Release notes:
    - [docs/releases/v1.1.0+deploy.2.md](/Users/ramc/Documents/Code/courtmaster-v2/docs/releases/v1.1.0+deploy.2.md)
- `v1.1.0`
  - Date: 2026-03-15 08:18 CDT
  - Package version: `1.1.0`
  - Deployed commit: `fa6a733` (`merge: release v1.1.0 horizon 1-3 completion`)
  - Release notes:
    - [docs/releases/v1.1.0.md](/Users/ramc/Documents/Code/courtmaster-v2/docs/releases/v1.1.0.md)
- `v1.0.0`
  - Date: 2026-03-14 12:13 CDT
  - Package version: `1.0.0`
  - Deployed commit: `4b5bac8` (`merge: Horizon 2 community voices polish`)
  - Release notes:
    - [docs/releases/v1.0.0.md](/Users/ramc/Documents/Code/courtmaster-v2/docs/releases/v1.0.0.md)

## Latest Production Merge Milestone

- Date: 2026-04-10 16:18 CDT
- Commit: `151b857a9a29d31c52ef00e4799b0a625ae99148`
- Message: `Merge pull request #6 from courtmastr/feat/tnf-2026-seed-refresh`
- Note: deployed via `npm run release:deploy` on 2026-04-10.