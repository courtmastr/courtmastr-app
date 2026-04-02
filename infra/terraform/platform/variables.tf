variable "project_id" {
  description = "Google Cloud project ID."
  type        = string
}

variable "region" {
  description = "Default provider region."
  type        = string
  default     = "us-central1"
}

variable "firestore_location" {
  description = "Location for the Firestore default database."
  type        = string
  default     = "nam5"
}

variable "default_storage_bucket_name" {
  description = "Default Firebase Storage bucket name. For existing prod this is usually <project-id>.appspot.com."
  type        = string
  default     = null
}

variable "web_app_display_name" {
  description = "Display name for the Firebase web app when Terraform creates one."
  type        = string
  default     = "CourtMastr Web"
}

variable "create_web_app" {
  description = "Whether Terraform should create a Firebase web app."
  type        = bool
  default     = true
}

variable "secret_ids" {
  description = "Secret Manager secrets to create for runtime and deployment support."
  type        = set(string)
  default = [
    "GITHUB_TOKEN",
    "VOLUNTEER_PIN_SECRET",
    "VOLUNTEER_SESSION_SECRET",
  ]
}
