variable "create_project" {
  description = "Whether Terraform should create the Google Cloud project instead of attaching to an existing one."
  type        = bool
  default     = false
}

variable "project_id" {
  description = "Google Cloud project ID."
  type        = string
}

variable "project_name" {
  description = "Display name used only when create_project is true."
  type        = string
  default     = "CourtMastr"
}

variable "billing_account" {
  description = "Billing account ID used only when create_project is true."
  type        = string
  default     = null
}

variable "org_id" {
  description = "Organization ID used only when create_project is true."
  type        = string
  default     = null
}

variable "folder_id" {
  description = "Folder ID used only when create_project is true."
  type        = string
  default     = null
}

variable "region" {
  description = "Default provider region."
  type        = string
  default     = "us-central1"
}

variable "app_engine_location" {
  description = "App Engine application location. This is immutable after creation."
  type        = string
  default     = "us-central"
}

variable "enable_required_services" {
  description = "Whether Terraform should enable required Google APIs."
  type        = bool
  default     = true
}
