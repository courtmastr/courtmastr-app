# CourtMastr Terraform: Platform

This root manages platform resources that the app expects to exist.

## Owns

- Firestore default database
- Firestore rules release from the repo rules file
- Firestore composite indexes from the repo indexes file
- Storage rules release
- Firebase web app registration
- Secret Manager secret containers

Terraform creates the secret containers only. Secret values still need to be added separately through Secret Manager or your secure CI/operator workflow.

## Important Limitation

Firebase documents that, starting October 30, 2024, Terraform can no longer provision the default Cloud Storage bucket. For greenfield environments, create the default Firebase Storage bucket outside Terraform first, then apply this root.

For the current production project, the bucket should already exist.

## Existing Production Project

For `courtmaster-v2`, expect to import existing resources such as:

- the Firestore default database
- the current Firebase web app if you want Terraform to manage that exact app registration

Rules releases, indexes, and secret containers can then be managed forward from code.

## Apply

```bash
cd infra/terraform/platform
terraform init
terraform plan
terraform apply
```

## Repo Inputs

This root reads directly from:

- [/Users/ramc/Documents/Code/courtmaster-v2/firestore.rules](/Users/ramc/Documents/Code/courtmaster-v2/firestore.rules)
- [/Users/ramc/Documents/Code/courtmaster-v2/firestore.indexes.json](/Users/ramc/Documents/Code/courtmaster-v2/firestore.indexes.json)
- [/Users/ramc/Documents/Code/courtmaster-v2/storage.rules](/Users/ramc/Documents/Code/courtmaster-v2/storage.rules)
