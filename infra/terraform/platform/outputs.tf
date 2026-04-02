output "firestore_database_name" {
  description = "Firestore default database identifier."
  value       = google_firestore_database.default.name
}

output "storage_rules_bucket_name" {
  description = "Bucket name targeted by the Firebase Storage rules release."
  value       = local.default_storage_bucket_name
}

output "firebase_web_app_id" {
  description = "Firebase web app ID when Terraform creates the app."
  value       = var.create_web_app ? google_firebase_web_app.web[0].app_id : null
}

output "secret_ids" {
  description = "Secret Manager secret IDs created by the platform layer."
  value       = [for secret in google_secret_manager_secret.app : secret.secret_id]
}
