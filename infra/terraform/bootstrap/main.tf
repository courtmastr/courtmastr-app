locals {
  project_id = var.create_project ? google_project.project[0].project_id : var.project_id

  required_services = toset([
    "appengine.googleapis.com",
    "artifactregistry.googleapis.com",
    "cloudbuild.googleapis.com",
    "cloudfunctions.googleapis.com",
    "firebase.googleapis.com",
    "firebaserules.googleapis.com",
    "firebasestorage.googleapis.com",
    "firestore.googleapis.com",
    "iam.googleapis.com",
    "iamcredentials.googleapis.com",
    "identitytoolkit.googleapis.com",
    "run.googleapis.com",
    "secretmanager.googleapis.com",
    "serviceusage.googleapis.com",
    "sts.googleapis.com",
  ])
}

resource "google_project" "project" {
  count = var.create_project ? 1 : 0

  project_id      = var.project_id
  name            = var.project_name
  billing_account = var.billing_account
  org_id          = var.org_id
  folder_id       = var.folder_id
}

data "google_project" "existing" {
  count      = var.create_project ? 0 : 1
  project_id = var.project_id
}

resource "google_project_service" "required" {
  for_each = var.enable_required_services ? local.required_services : []

  project            = local.project_id
  service            = each.value
  disable_on_destroy = false

  depends_on = [google_project.project]
}

resource "google_firebase_project" "project" {
  provider = google-beta
  project  = local.project_id

  depends_on = [
    google_project.project,
    google_project_service.required,
  ]
}

resource "google_app_engine_application" "app" {
  provider      = google-beta
  project       = local.project_id
  location_id   = var.app_engine_location
  database_type = "CLOUD_FIRESTORE"

  depends_on = [
    google_firebase_project.project,
    google_project_service.required,
  ]

  lifecycle {
    prevent_destroy = true
  }
}
