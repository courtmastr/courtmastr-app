# CLI Release Automation Design

**Date:** 2026-03-28
**Status:** Approved

## Goal

Automate the CourtMastr CLI production release flow so a single repo-native command can classify the next semantic version, generate release notes, enforce release guardrails, and deploy only after the process passes.

## Chosen Flow

Two CLI commands:

1. `npm run release:plan`
   - dry-run preview
   - reads the latest deployed version and commit from `docs/deployment/LAST_DEPLOY.md`
   - inspects unreleased commits and changed paths
   - classifies the release as `patch`, `minor`, or `major`
   - computes the next semantic version
   - prints a release preview and the draft release-note path

2. `npm run release:deploy`
   - requires a clean worktree at start
   - computes the release size automatically
   - bumps the repo version automatically
   - generates the versioned release note
   - runs deploy guardrails
   - deploys to Firebase
   - updates `docs/deployment/LAST_DEPLOY.md`

## Version Classification Rules

The user-approved rule is:

- small / scoped changes -> patch (`1.1.1`)
- broader feature work -> minor (`1.2.0`)
- very large, platform-spanning, or explicitly breaking work -> major (`2.0.0`)

The classifier should use repo evidence:

- commit subjects
- changed file count
- touched product areas
- breaking-change keywords
- infra/rules/functions impact

## Guardrails

`release:deploy` must run, in order:

1. version bump + release note generation
2. `npm run verify:release`
3. `npm run build`
4. `npm run build:log`
5. `npm run deploy`
6. `npm run deploy:log`

If any step fails after auto-generated local changes, the script should restore the pre-release files it changed.

## Files Changed By Automation

- `package.json`
- `package-lock.json`
- `docs/releases/v<version>.md`
- `docs/deployment/LAST_DEPLOY.md`

## Release Notes

Release notes remain human-readable markdown, but the initial content is generated from:

- commit range since the last deployed commit
- highlighted commit subjects
- touched product areas
- known risk markers such as Firebase rules, indexes, or functions changes

## Non-Goals

- Git tag creation
- Auto-committing release metadata
- GitHub Actions deployment
