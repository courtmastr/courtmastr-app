# CourtMastr Terraform Layout

CourtMastr infrastructure is split into three Terraform roots:

1. `bootstrap`
2. `platform`
3. `deploy`

Apply them in that order.

## What Terraform Manages

- project/Firebase bootstrap
- App Engine and required Google APIs
- Firestore database, rules, and indexes
- Storage rules
- Firebase web app registration
- Secret Manager secret containers
- deploy IAM and GitHub OIDC

## What Terraform Does Not Replace

Routine application releases still go through:

- `npm run release:plan`
- `npm run release:deploy`
- GitHub Actions deploy on `master`

Terraform manages environment state. Firebase CLI still pushes app code, Hosting assets, Functions code, and release notes through the repo release workflow.

Secret values themselves are not committed to Terraform in this repo. Terraform creates the secret containers; operators or CI must still populate secret versions securely.

## Operating Model

### One-time per environment

- apply `bootstrap`
- apply `platform`
- apply `deploy`
- set GitHub repository variables from `deploy` outputs
- populate required secret values

### When infra changes

- rerun the affected Terraform root

### On every code release

- run `npm run release:plan`
- run `npm run release:deploy`

## Existing Production Project

`courtmaster-v2` is an existing production project. For that project, expect an import-first workflow for foundational Firebase resources instead of trying to recreate them.

## Greenfield Limitation

Firebase documents that, starting October 30, 2024, Terraform can no longer provision the default Cloud Storage bucket. For new environments, create the default bucket via Firebase Console or the documented API, then let Terraform manage Storage rules and the rest of the platform.
