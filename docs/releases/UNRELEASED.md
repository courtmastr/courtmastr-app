# Unreleased Draft

- Status: draft
- Package version: `1.1.0`
- Draft date: 2026-03-28

## Summary

This draft captures the known work that exists after the latest recorded production deploy. It is not a release note yet because the next semantic version has not been chosen in `package.json`.

## Highlights

- `origin/master` contains post-deploy branding polish that has been pushed but is not recorded as deployed.
- Local `master` contains a large unreleased stack including:
  - global players and organization platform
  - org dashboard, org profile, and org public home
  - player directory, search, and profile flows
  - super admin platform
  - event center redesign
  - match control redesign
  - SmartBracketView redesign
  - live scoring view and release-gate hardening

## Verification

- Repo state inspected on 2026-03-28:
  - `git status --short --branch`
  - `git rev-list --count 96ead60..origin/master`
  - `git rev-list --count origin/master..HEAD`
- Current counts at inspection time:
  - `5` commits on `origin/master` after the latest deployed commit
  - `81` additional local commits after `origin/master`

## Deployment

- Not deployed
- Next action required before release:
  - choose the next semantic version
  - create `docs/releases/v<next-version>.md`
  - run `npm run verify:release`
  - deploy from clean release state

## Risks / Follow-Ups

- The current package version is still `1.1.0`, so the next production release must bump the version before deploy.
- This draft mixes pushed and local-only work; trim it into a concrete release scope before the next production deployment.
