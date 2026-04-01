# Release Versioning and Release Notes Design

**Date:** 2026-03-28
**Status:** Approved

## Goal

Give CourtMastr a durable production release workflow where every future deploy is tied to a semantic version, release verification includes release-note validation, and historical deploys are backfilled from repo evidence as far as the available data allows.

## Chosen Approach

Use `package.json` as the source of truth for the next release version, store one release-note document per release in `docs/releases/`, and extend the existing `npm run verify:release` flow so it validates the presence and structure of the matching release note before deploy.

## Why This Approach

1. It keeps semantic versioning in the same place the app already declares its version.
2. It preserves the existing release verification workflow instead of adding a second parallel checklist.
3. It creates readable, versioned release artifacts without introducing fragile changelog automation.

## Scope

- Add versioned release-note documents under `docs/releases/`
- Add a release history index
- Backfill release notes for historically documented production deploys
- Add an unreleased draft note for work that is not yet deployed
- Extend release verification to validate release-note metadata
- Update deploy and test process docs to require semantic version bump + release notes before deploy

## Historical Backfill Rule

Historical deploys are backfilled from recorded evidence only.

- If the deployed package version is known, use `v<version>`
- If the same package version was deployed to production more than once before this workflow existed, use semver build metadata for the historical release ID, for example `v1.1.0+deploy.2`
- If version or commit evidence is missing, record the deploy in the index as historical evidence with gaps noted explicitly rather than inventing a version

## Release Note Shape

Each release note should include:

- Summary
- Highlights
- Verification
- Deployment
- Risks / Follow-Ups

This is enough structure for operators while staying lightweight enough to maintain.

## Verification Rule

`npm run verify:release` should fail when:

- the current package version does not have a matching `docs/releases/v<version>.md`
- the release note is missing required sections

Release verification should also record the current package version and release-note path in `docs/testing/test-run-summary.json`.

## Future Release Workflow

1. Bump `package.json` version using semantic versioning
2. Create or update `docs/releases/v<version>.md`
3. Run `npm run verify:release`
4. Deploy with `npm run deploy` and `npm run deploy:log`
5. Update `docs/deployment/LAST_DEPLOY.md` with version, commit, and release-note link

## Non-Goals

- Auto-generating changelogs from commit history
- Re-tagging git history
- Retroactively guessing missing historical version numbers
