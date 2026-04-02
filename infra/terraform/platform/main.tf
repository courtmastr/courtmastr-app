locals {
  default_storage_bucket_name = coalesce(var.default_storage_bucket_name, "${var.project_id}.appspot.com")
  firestore_index_spec        = jsondecode(file("${path.module}/../../../firestore.indexes.json"))
  composite_indexes           = try(local.firestore_index_spec.indexes, [])

  composite_indexes_by_key = {
    for index in local.composite_indexes :
    "${index.collectionGroup}-${index.queryScope}-${join("-", [
      for field in index.fields :
      "${field.fieldPath}-${try(field.order, try(field.arrayConfig, "VALUE"))}"
    ])}" => index
  }
}

resource "google_firestore_database" "default" {
  provider    = google-beta
  project     = var.project_id
  name        = "(default)"
  location_id = var.firestore_location
  type        = "FIRESTORE_NATIVE"

  lifecycle {
    prevent_destroy = true
  }
}

resource "google_firebaserules_ruleset" "firestore" {
  provider = google-beta
  project  = var.project_id

  source {
    files {
      name    = "firestore.rules"
      content = file("${path.module}/../../../firestore.rules")
    }
  }
}

resource "google_firebaserules_release" "firestore" {
  provider     = google-beta
  project      = var.project_id
  name         = "cloud.firestore"
  ruleset_name = google_firebaserules_ruleset.firestore.name
}

resource "google_firebaserules_ruleset" "storage" {
  provider = google-beta
  project  = var.project_id

  source {
    files {
      name    = "storage.rules"
      content = file("${path.module}/../../../storage.rules")
    }
  }
}

resource "google_firebaserules_release" "storage" {
  provider     = google-beta
  project      = var.project_id
  name         = "firebase.storage/${local.default_storage_bucket_name}"
  ruleset_name = google_firebaserules_ruleset.storage.name
}

resource "google_firestore_index" "composite" {
  provider   = google-beta
  for_each   = local.composite_indexes_by_key
  project    = var.project_id
  database   = "(default)"
  collection = each.value.collectionGroup
  query_scope = each.value.queryScope

  dynamic "fields" {
    for_each = each.value.fields
    content {
      field_path   = fields.value.fieldPath
      order        = try(fields.value.order, null)
      array_config = try(fields.value.arrayConfig, null)
    }
  }

  depends_on = [google_firestore_database.default]
}

resource "google_firebase_web_app" "web" {
  provider     = google-beta
  count        = var.create_web_app ? 1 : 0
  project      = var.project_id
  display_name = var.web_app_display_name
}

resource "google_secret_manager_secret" "app" {
  for_each  = var.secret_ids
  project   = var.project_id
  secret_id = each.value

  replication {
    auto {}
  }
}
