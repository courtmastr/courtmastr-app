# CourtMastr Terraform: Bootstrap

This root manages foundational project bootstrap.

## Owns

- optional Google Cloud project creation
- Firebase enablement on the project
- App Engine application
- required Google APIs for Firebase, Functions, Secret Manager, and deploy IAM

## Modes

### Existing project

Use this for the current production project:

- set `create_project = false`
- import existing Firebase/App Engine resources before first apply

### New project

Use this for greenfield environments:

- set `create_project = true`
- provide billing and org/folder placement inputs

## Apply

```bash
cd infra/terraform/bootstrap
terraform init
terraform plan
terraform apply
```

## Notes

- App Engine location is immutable after creation.
- For an existing project like `courtmaster-v2`, do not attempt to recreate the project or App Engine app. Import them first.
