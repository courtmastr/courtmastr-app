# Layered Firebase IaC Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a layered Terraform structure for CourtMastr that manages bootstrap, platform runtime resources, and deploy IAM while keeping app releases on npm/CI.

**Architecture:** Create three Terraform roots under `infra/terraform/`: `bootstrap`, `platform`, and `deploy`. `bootstrap` handles project/Firebase/App Engine foundations, `platform` handles Firestore/rules/indexes/web app/secrets, and `deploy` handles service-account-based deploy access for CI and local impersonation.

**Tech Stack:** Terraform, Google provider, Google Beta provider, GitHub Actions, Firebase CLI

---

### Task 1: Write the layered IaC docs

**Files:**
- Create: `docs/plans/2026-04-01-layered-firebase-iac-design.md`
- Create: `docs/plans/2026-04-01-layered-firebase-iac.md`
- Create: `infra/terraform/README.md`

**Step 1: Document the three layers**

Describe:
- what `bootstrap` owns
- what `platform` owns
- what `deploy` owns

**Step 2: Document the release boundary**

State clearly:
- Terraform manages infrastructure
- `npm run release:deploy` and CI manage application rollout

**Step 3: Document import-first production strategy**

Call out that `courtmaster-v2` is an existing production project and should be imported where required rather than recreated.

### Task 2: Build `bootstrap`

**Files:**
- Create: `infra/terraform/bootstrap/versions.tf`
- Create: `infra/terraform/bootstrap/providers.tf`
- Create: `infra/terraform/bootstrap/variables.tf`
- Create: `infra/terraform/bootstrap/main.tf`
- Create: `infra/terraform/bootstrap/outputs.tf`
- Create: `infra/terraform/bootstrap/terraform.tfvars.example`
- Create: `infra/terraform/bootstrap/README.md`

**Step 1: Add provider configuration**

Include `google` and `google-beta` with a shared project/region model.

**Step 2: Add bootstrap variables**

Include:
- `project_id`
- optional project creation controls
- billing/org/folder inputs
- App Engine location
- required service enablement toggle

**Step 3: Add foundational resources**

Include:
- optional `google_project`
- Firebase enablement
- App Engine application
- required project services

**Step 4: Add outputs**

Expose:
- project id
- project number
- App Engine default service account email

### Task 3: Build `platform`

**Files:**
- Create: `infra/terraform/platform/versions.tf`
- Create: `infra/terraform/platform/providers.tf`
- Create: `infra/terraform/platform/variables.tf`
- Create: `infra/terraform/platform/main.tf`
- Create: `infra/terraform/platform/outputs.tf`
- Create: `infra/terraform/platform/terraform.tfvars.example`
- Create: `infra/terraform/platform/README.md`

**Step 1: Add runtime variables**

Include:
- `project_id`
- Firestore location
- default storage bucket name
- web app display name
- secret ids

**Step 2: Mirror repo-managed platform artifacts**

Add Terraform resources for:
- Firestore default database
- Firestore rules release using `firestore.rules`
- Firestore composite indexes using `firestore.indexes.json`
- Storage rules release using `storage.rules`
- Firebase web app registration
- Secret Manager secret containers

**Step 3: Document the storage-bucket limitation**

Explicitly state that greenfield default bucket creation still requires console/API action because Firebase no longer allows provisioning that bucket via Terraform.

### Task 4: Move IAM root into `deploy`

**Files:**
- Modify: `infra/terraform/deploy/**`
- Modify: `.github/workflows/ci-cd.yml`
- Modify: `package.json`

**Step 1: Reframe the root as the deploy layer**

Keep:
- deploy service account
- project IAM
- App Engine act-as
- GitHub OIDC
- optional local impersonation

**Step 2: Keep release safety**

Preserve:
- explicit `--project production` for npm deploy scripts
- CI auth through workload identity

### Task 5: Update deployment documentation

**Files:**
- Modify: `docs/deployment/DEPLOYMENT_GUIDE.md`
- Modify: `docs/coding-patterns/CODING_PATTERNS.md`

**Step 1: Update deployment guide**

Document:
- Terraform layer order
- bootstrap/import reality
- local impersonation path
- release deploy still happens through npm/CI

**Step 2: Capture deploy-targeting guardrail**

Add a coding pattern ensuring production deploy scripts always specify the Firebase project alias explicitly.

### Task 6: Verify what can be verified locally

**Files:**
- Test: repo-local workflow/docs/package verification only

**Step 1: Run release-targeted tests**

Run:
```bash
npm run test -- --run tests/unit/release-utils.test.ts tests/unit/release-notes-utils.test.ts tests/unit/verify-release.test.ts
```

**Step 2: Run logged tests**

Run:
```bash
npm run test:log -- --run tests/unit/release-utils.test.ts tests/unit/release-notes-utils.test.ts tests/unit/verify-release.test.ts
```

**Step 3: Run build verification**

Run:
```bash
npm run build
npm run build:log
```

**Step 4: Run structural checks**

Run:
```bash
ruby -e 'require "yaml"; YAML.load_file(".github/workflows/ci-cd.yml"); puts "ci-cd.yml parsed"'
git diff --check
```

**Step 5: Record Terraform constraint**

State explicitly that `terraform plan` was not run here because Terraform is not installed in this environment.
