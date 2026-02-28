# ──────────────────────────────────────────────────────────────
# SparkNode — GCP Module
# Provisions: VPC, Subnet, Firewall, Static IP, Compute Instance
# ──────────────────────────────────────────────────────────────

terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.10"
    }
  }
}

provider "google" {
  project = var.gcp_project_id
  region  = var.gcp_region
  zone    = var.gcp_zone
}

# ──────────────────────────────────────────────────────────────
# VPC Network & Subnet
# ──────────────────────────────────────────────────────────────

resource "google_compute_network" "main" {
  name                    = "${var.project_name}-vpc"
  auto_create_subnetworks = false

  description = "SparkNode VPC network"
}

resource "google_compute_subnetwork" "public" {
  name          = "${var.project_name}-subnet"
  ip_cidr_range = var.subnet_cidr
  region        = var.gcp_region
  network       = google_compute_network.main.id

  description = "SparkNode public subnet"
}

# ──────────────────────────────────────────────────────────────
# Firewall Rules
# ──────────────────────────────────────────────────────────────

resource "google_compute_firewall" "allow_ssh" {
  name    = "${var.project_name}-allow-ssh"
  network = google_compute_network.main.name

  allow {
    protocol = "tcp"
    ports    = ["22"]
  }

  source_ranges = var.ssh_allowed_cidrs
  target_tags   = ["${var.project_name}-server"]
  description   = "Allow SSH access"
}

resource "google_compute_firewall" "allow_http" {
  name    = "${var.project_name}-allow-http"
  network = google_compute_network.main.name

  allow {
    protocol = "tcp"
    ports    = ["80"]
  }

  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["${var.project_name}-server"]
  description   = "Allow HTTP traffic"
}

resource "google_compute_firewall" "allow_https" {
  name    = "${var.project_name}-allow-https"
  network = google_compute_network.main.name

  allow {
    protocol = "tcp"
    ports    = ["443"]
  }

  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["${var.project_name}-server"]
  description   = "Allow HTTPS traffic"
}

# ──────────────────────────────────────────────────────────────
# Static External IP
# ──────────────────────────────────────────────────────────────

resource "google_compute_address" "sparknode" {
  name         = "${var.project_name}-ip"
  region       = var.gcp_region
  address_type = "EXTERNAL"

  description = "SparkNode static IP"
}

# ──────────────────────────────────────────────────────────────
# Compute Instance (Ubuntu 22.04)
# ──────────────────────────────────────────────────────────────

resource "google_compute_instance" "sparknode" {
  name         = "${var.project_name}-${var.environment}-vm"
  machine_type = var.machine_type
  zone         = var.gcp_zone

  boot_disk {
    initialize_params {
      image = "ubuntu-os-cloud/ubuntu-2204-lts"
      size  = var.boot_disk_size_gb
      type  = var.boot_disk_type
    }
  }

  network_interface {
    subnetwork = google_compute_subnetwork.public.id

    access_config {
      nat_ip = google_compute_address.sparknode.address
    }
  }

  metadata = {
    ssh-keys = "${var.ssh_user}:${file(var.ssh_public_key_path)}"
  }

  metadata_startup_script = base64decode(var.user_data)

  tags = ["${var.project_name}-server"]

  labels = {
    project     = var.project_name
    environment = var.environment
    managed_by  = "terraform"
  }

  service_account {
    scopes = ["cloud-platform"]
  }

  shielded_instance_config {
    enable_secure_boot          = true
    enable_vtpm                 = true
    enable_integrity_monitoring = true
  }

  lifecycle {
    ignore_changes = [metadata_startup_script]
  }
}
