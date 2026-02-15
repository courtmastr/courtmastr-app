# npm run build:log reports missing script

- Status: ✅ fixed
- Date: 2026-02-01
- Fingerprint: n/a (npm missing script error, no run-and-log output)
- Command: cd functions && npm run build:log
- Node: v22.22.0
- Firebase-tools: not installed (firebase command not found)
- Normalized error signature: npm error Missing script: "build:log"
- Artifact log: docs/debug-kb/_artifacts/2026-02-01-22-36-22.tsc.log

## Root cause
The first build attempt reported a missing npm script even though the functions package.json defines build:log.

## Fix (final)
Re-ran `npm run build:log` from `functions/`, which executed `node ../scripts/run-and-log.mjs tsc` successfully and produced the artifact log.

## Verification
- cd functions && npm run build:log
