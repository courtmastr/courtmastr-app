output "project_id" {
  description = "Managed Google Cloud project ID."
  value       = local.project_id
}

output "project_number" {
  description = "Managed Google Cloud project number."
  value       = var.create_project ? google_project.project[0].number : data.google_project.existing[0].number
}

output "app_engine_location" {
  description = "App Engine application location."
  value       = google_app_engine_application.app.location_id
}

output "app_engine_default_service_account_email" {
  description = "App Engine default service account email."
  value       = "${local.project_id}@appspot.gserviceaccount.com"
}
