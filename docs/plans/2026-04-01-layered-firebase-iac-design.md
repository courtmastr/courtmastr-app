# Layered Firebase IaC Design

## Goal

Define CourtMastr production infrastructure as code in layers so the environment is reproducible, reviewable, and safe to evolve without conflating cloud infrastructure with routine app releases.

## Decision

Use three Terraform roots:

1. `bootstrap`
   - project/Firebase enablement and foundational Google services
2. `platform`
   - Firestore, rules, indexes, storage rules, web app registration, and secret scaffolding
3. `deploy`
   - deploy service account, IAM, GitHub OIDC, and optional local impersonation

Routine releases remain outside Terraform:

- Terraform manages infrastructure state
- `npm run release:deploy` and GitHub Actions manage application rollout

## Why Layered Is Better

### Versus IAM-only Terraform

IAM-only Terraform solves the immediate deploy failure but leaves the rest of the environment dependent on console state:

- Firestore database existence
- rules and indexes lifecycle
- Firebase web app registration
- secret containers
- App Engine app

That is not enough for reliable long-term operations.

### Versus One Monolithic Terraform Root

One stack for everything increases blast radius and mixes different privilege domains:

- bootstrap needs higher privilege and is rare
- platform changes are moderate frequency
- deploy IAM is narrow and security-sensitive

Splitting them makes imports, reviews, and rollback safer.

## Repo-Grounded Scope

This repo actively depends on:

- Firebase Hosting
- Cloud Functions
- Firestore rules and indexes
- Cloud Storage rules
- Firebase Auth
- Firebase web app config via `VITE_FIREBASE_*`
- production alias `courtmaster-v2`

Repo evidence:

- [firebase.json](/Users/ramc/Documents/Code/courtmaster-v2/firebase.json)
- [.firebaserc](/Users/ramc/Documents/Code/courtmaster-v2/.firebaserc)
- [src/services/firebase.ts](/Users/ramc/Documents/Code/courtmaster-v2/src/services/firebase.ts)
- [functions/src/index.ts](/Users/ramc/Documents/Code/courtmaster-v2/functions/src/index.ts)

## Layer Responsibilities

### `infra/terraform/bootstrap`

Owns:

- optional project creation
- Firebase enablement on the project
- App Engine application
- base Google APIs required by Firebase, Functions, deploy IAM, and Secret Manager

Supports two modes:

- existing production project: import existing resources before apply
- new environment: create the project and bootstrap it

### `infra/terraform/platform`

Owns:

- Firestore default database
- Firestore rules release
- Firestore composite indexes generated from [firestore.indexes.json](/Users/ramc/Documents/Code/courtmaster-v2/firestore.indexes.json)
- Storage rules release
- Firebase web app registration
- Secret Manager secret containers for runtime/deploy inputs

Important limitation from Firebase docs:

- starting October 30, 2024, Terraform can no longer provision the default Cloud Storage bucket
- for greenfield environments, the default bucket must still be created through Firebase Console or the documented API endpoint outside Terraform

Source:
- [Firebase Terraform get started](https://firebase.google.com/docs/projects/terraform/get-started)

### `infra/terraform/deploy`

Owns:

- deploy service account
- project deploy roles
- `roles/iam.serviceAccountUser` on the App Engine default service account
- GitHub Workload Identity Federation
- optional local operator impersonation via `roles/iam.serviceAccountTokenCreator`

## Existing Production Strategy

For `courtmaster-v2`, this should be treated as an import-first migration, not greenfield creation.

Expected imports before first apply:

- Firebase project enablement
- App Engine application
- Firestore default database
- existing Firebase web app if you want Terraform to manage the current app registration

Rules releases, indexes, secrets, and deploy IAM can then be managed forward from code.

## Release Boundary

After the layered IaC is applied:

- infrastructure changes go through Terraform
- normal app releases still go through:
  - `npm run release:plan`
  - `npm run release:deploy`
  - GitHub Actions deploy on `master`

Terraform is not the right tool for every code deploy. It is the right tool for making the environment dependable.

## Risks

- some Firebase resources still require import for the current production project
- default storage bucket provisioning is not fully Terraform-manageable for new environments
- auth provider configuration is intentionally not overreached here without confirmed provider coverage; the app’s current required auth mode remains documented operationally
- Terraform is not installed in the current environment, so validation here is structural rather than `terraform plan`

## Success Criteria

- repo contains `bootstrap`, `platform`, and `deploy` Terraform roots
- deploy docs describe Terraform scope versus release scope accurately
- production deploy scripts continue to target the `production` Firebase alias explicitly
- CI auth uses workload identity instead of `FIREBASE_TOKEN`
- platform layer mirrors current rules/index/runtime needs from the repo
