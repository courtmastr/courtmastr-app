variable "project_id" {
  description = "Google Cloud project ID for the production Firebase project."
  type        = string
}

variable "region" {
  description = "Default region for Google provider operations."
  type        = string
  default     = "us-central1"
}

variable "deploy_service_account_id" {
  description = "Account ID for the dedicated deploy service account."
  type        = string
  default     = "firebase-deploy"
}

variable "github_owner" {
  description = "GitHub organization or user that owns the repository."
  type        = string
}

variable "github_repo" {
  description = "GitHub repository name."
  type        = string
}

variable "github_branch" {
  description = "GitHub branch allowed to impersonate the deploy service account."
  type        = string
  default     = "master"
}

variable "workload_identity_pool_id" {
  description = "Workload identity pool ID."
  type        = string
  default     = "github-actions"
}

variable "workload_identity_pool_provider_id" {
  description = "Workload identity pool provider ID."
  type        = string
  default     = "courtmastr-github"
}

variable "enable_required_services" {
  description = "Whether Terraform should enable the APIs needed for IAM federation and Firebase deploys."
  type        = bool
  default     = true
}

variable "local_deployer_principals" {
  description = "Optional IAM members allowed to impersonate the deploy service account for local CLI deploys."
  type        = set(string)
  default     = []
}
