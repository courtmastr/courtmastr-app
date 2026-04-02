locals {
  app_engine_default_service_account_email = "${var.project_id}@appspot.gserviceaccount.com"
  compute_default_service_account_email    = "${data.google_project.current.number}-compute@developer.gserviceaccount.com"

  required_services = toset([
    "artifactregistry.googleapis.com",
    "cloudbuild.googleapis.com",
    "cloudfunctions.googleapis.com",
    "firebase.googleapis.com",
    "firebaserules.googleapis.com",
    "iam.googleapis.com",
    "iamcredentials.googleapis.com",
    "run.googleapis.com",
    "serviceusage.googleapis.com",
    "sts.googleapis.com",
  ])

  deploy_roles = toset([
    "roles/artifactregistry.admin",
    "roles/cloudbuild.builds.editor",
    "roles/cloudfunctions.admin",
    "roles/firebase.admin",
    "roles/run.admin",
    "roles/serviceusage.serviceUsageConsumer",
    "roles/storage.admin",
    "roles/viewer",
  ])

  github_repository = "${var.github_owner}/${var.github_repo}"
}

data "google_project" "current" {
  project_id = var.project_id
}

resource "google_project_service" "required" {
  for_each = var.enable_required_services ? local.required_services : []

  project            = var.project_id
  service            = each.value
  disable_on_destroy = false
}

resource "google_service_account" "firebase_deploy" {
  account_id   = var.deploy_service_account_id
  display_name = "CourtMastr Firebase Deploy"
  description  = "Dedicated service account for production Firebase deploys."
  project      = var.project_id
}

resource "google_project_iam_member" "deploy_roles" {
  for_each = local.deploy_roles

  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.firebase_deploy.email}"
}

resource "google_service_account_iam_member" "appspot_act_as" {
  service_account_id = "projects/${var.project_id}/serviceAccounts/${local.app_engine_default_service_account_email}"
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.firebase_deploy.email}"
}

resource "google_service_account_iam_member" "compute_default_act_as" {
  service_account_id = "projects/${var.project_id}/serviceAccounts/${local.compute_default_service_account_email}"
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.firebase_deploy.email}"
}

resource "google_iam_workload_identity_pool" "github" {
  workload_identity_pool_id = var.workload_identity_pool_id
  display_name              = "CourtMastr GitHub Actions"
  description               = "OIDC trust for CourtMastr GitHub Actions deploys."
  project                   = var.project_id
}

resource "google_iam_workload_identity_pool_provider" "github" {
  workload_identity_pool_id          = google_iam_workload_identity_pool.github.workload_identity_pool_id
  workload_identity_pool_provider_id = var.workload_identity_pool_provider_id
  display_name                       = "CourtMastr GitHub Provider"
  description                        = "GitHub OIDC provider for CourtMastr deploy workflow."
  project                            = var.project_id

  attribute_mapping = {
    "google.subject"             = "assertion.sub"
    "attribute.actor"            = "assertion.actor"
    "attribute.ref"              = "assertion.ref"
    "attribute.repository"       = "assertion.repository"
    "attribute.repository_owner" = "assertion.repository_owner"
  }

  attribute_condition = "assertion.repository_owner == '${var.github_owner}' && assertion.repository == '${local.github_repository}' && assertion.ref == 'refs/heads/${var.github_branch}'"

  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }
}

resource "google_service_account_iam_member" "github_wif_user" {
  service_account_id = google_service_account.firebase_deploy.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github.name}/attribute.repository/${local.github_repository}"
}

resource "google_service_account_iam_member" "local_impersonation" {
  for_each = var.local_deployer_principals

  service_account_id = google_service_account.firebase_deploy.name
  role               = "roles/iam.serviceAccountTokenCreator"
  member             = each.value
}
