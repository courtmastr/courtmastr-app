output "deploy_service_account_email" {
  description = "Email of the dedicated Firebase deploy service account."
  value       = google_service_account.firebase_deploy.email
}

output "app_engine_default_service_account_email" {
  description = "App Engine default service account that the deploy account can act as."
  value       = local.app_engine_default_service_account_email
}

output "github_workload_identity_provider_name" {
  description = "Full Workload Identity Provider resource name for GitHub Actions auth."
  value       = google_iam_workload_identity_pool_provider.github.name
}

output "github_repository" {
  description = "GitHub repository trusted by the workload identity provider."
  value       = local.github_repository
}
