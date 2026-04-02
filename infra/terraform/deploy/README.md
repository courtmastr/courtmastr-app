# CourtMastr Terraform: Deploy

This Terraform root provisions the IAM and GitHub OIDC resources needed for production Firebase deploys.

## What it creates

- a dedicated deploy service account
- project-level roles required for Firebase Hosting and Cloud Functions deploys
- `roles/iam.serviceAccountUser` on the App Engine default service account
- a GitHub Workload Identity Pool + Provider
- impersonation rights from the configured GitHub repo/branch to the deploy service account

## Why this exists

Production deploys should not depend on a human account having ad hoc IAM access. This module moves deploy access into versioned infrastructure.

## Bootstrap requirement

The first `terraform apply` must be run by a project Owner or an IAM admin with enough privilege to:

- create service accounts
- grant project IAM roles
- create workload identity pools/providers
- grant service account IAM bindings
- enable required Google APIs when `enable_required_services = true`

## Files

- `versions.tf`
- `providers.tf`
- `variables.tf`
- `main.tf`
- `outputs.tf`
- `terraform.tfvars.example`

## Inputs

Required:

- `project_id`
- `github_owner`
- `github_repo`

Optional:

- `region` default `us-central1`
- `deploy_service_account_id` default `firebase-deploy`
- `github_branch` default `master`
- `workload_identity_pool_id` default `github-actions`
- `workload_identity_pool_provider_id` default `courtmastr-github`
- `enable_required_services` default `true`
- `local_deployer_principals` default `[]`

## Apply flow

1. install Terraform locally
2. copy `terraform.tfvars.example` to `terraform.tfvars`
3. fill in the real GitHub repo/owner and any local operator principals that should be allowed to impersonate the deploy service account
4. run:

```bash
cd infra/terraform/deploy
terraform init
terraform plan
terraform apply
```

## Outputs to copy into GitHub

After apply, record:

- `deploy_service_account_email`
- `github_workload_identity_provider_name`

Set them as GitHub repository variables:

- `GCP_DEPLOY_SERVICE_ACCOUNT`
- `GCP_WORKLOAD_IDENTITY_PROVIDER`

The workflow still needs the existing Firebase web config secrets already used for `npm run build`.

## Local CLI deploy path

If you populate `local_deployer_principals`, those operators can use short-lived impersonation instead of direct project IAM on their human accounts.

Example flow:

```bash
gcloud auth application-default login --impersonate-service-account "$(terraform output -raw deploy_service_account_email)"
gcloud config set auth/impersonate_service_account "$(terraform output -raw deploy_service_account_email)"
npm run release:deploy
```

That keeps local deploys aligned with the same dedicated deploy identity used by CI.

The repo's production deploy scripts now target the `production` Firebase alias explicitly, so impersonated local releases do not depend on whichever Firebase project was last selected in a developer shell.

## GitHub Actions behavior

After apply and repository variable setup, `.github/workflows/ci-cd.yml` authenticates with:

- `google-github-actions/auth`
- the workload identity provider
- the deploy service account

It no longer relies on `FIREBASE_TOKEN` for production deploys.

## Notes

- This root is intentionally limited to deploy access. Runtime platform resources live in `infra/terraform/platform`.
- If Google introduces a missing permission during future Cloud Functions deploys, add the minimal missing project role to `local.deploy_roles`.
