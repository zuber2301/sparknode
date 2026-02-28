# ──────────────────────────────────────────────────────────────
# SparkNode — Main Terraform configuration (Multi-Cloud)
#
# Set cloud_provider = "aws" | "azure" | "gcp" to choose
# which cloud to provision infrastructure on.
# ──────────────────────────────────────────────────────────────

terraform {
  required_version = ">= 1.5"

  # Providers are configured inside the modules.
  # Only the selected module's provider is actually used.
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.80"
    }
    google = {
      source  = "hashicorp/google"
      version = "~> 5.10"
    }
  }
}

# ──────────────────────────────────────────────────────────────
# Shared locals — cloud-init user_data rendered once
# ──────────────────────────────────────────────────────────────

locals {
  user_data_raw = templatefile("${path.module}/user_data.sh", {
    project_name        = var.project_name
    domain              = var.domain
    acme_email          = var.acme_email
    postgres_password   = var.postgres_password
    app_secret_key      = var.app_secret_key
    smtp_host           = var.smtp_host
    smtp_port           = var.smtp_port
    smtp_user           = var.smtp_user
    smtp_password       = var.smtp_password
    app_version         = var.app_version
    dockerhub_org       = var.dockerhub_org
    dockerhub_username  = var.dockerhub_username
    dockerhub_token     = var.dockerhub_token
    environment         = var.environment
  })

  user_data_b64 = base64encode(local.user_data_raw)
}

# ──────────────────────────────────────────────────────────────
# AWS Module
# ──────────────────────────────────────────────────────────────

module "aws" {
  source = "./modules/aws"
  count  = var.cloud_provider == "aws" ? 1 : 0

  project_name       = var.project_name
  environment        = var.environment
  aws_region         = var.aws_region
  aws_profile        = var.aws_profile
  vpc_cidr           = var.vpc_cidr
  public_subnet_cidr = var.public_subnet_cidr
  availability_zone  = var.availability_zone
  instance_type      = var.instance_type
  ami_id             = var.ami_id
  key_name           = var.key_name
  root_volume_size   = var.root_volume_size
  root_volume_type   = var.root_volume_type
  ssh_allowed_cidrs  = var.ssh_allowed_cidrs
  user_data          = local.user_data_b64
}

# ──────────────────────────────────────────────────────────────
# Azure Module
# ──────────────────────────────────────────────────────────────

module "azure" {
  source = "./modules/azure"
  count  = var.cloud_provider == "azure" ? 1 : 0

  project_name              = var.project_name
  environment               = var.environment
  azure_location            = var.azure_location
  azure_resource_group_name = var.azure_resource_group_name
  vm_size                   = var.azure_vm_size
  os_disk_size_gb           = var.azure_os_disk_size_gb
  admin_username            = var.azure_admin_username
  ssh_public_key_path       = var.ssh_public_key_path
  ssh_allowed_cidrs         = var.ssh_allowed_cidrs
  vnet_cidr                 = var.vpc_cidr
  subnet_cidr               = var.public_subnet_cidr
  user_data                 = local.user_data_b64
}

# ──────────────────────────────────────────────────────────────
# GCP Module
# ──────────────────────────────────────────────────────────────

module "gcp" {
  source = "./modules/gcp"
  count  = var.cloud_provider == "gcp" ? 1 : 0

  project_name        = var.project_name
  environment         = var.environment
  gcp_project_id      = var.gcp_project_id
  gcp_region          = var.gcp_region
  gcp_zone            = var.gcp_zone
  machine_type        = var.gcp_machine_type
  boot_disk_size_gb   = var.gcp_boot_disk_size_gb
  boot_disk_type      = var.gcp_boot_disk_type
  ssh_user            = var.gcp_ssh_user
  ssh_public_key_path = var.ssh_public_key_path
  ssh_allowed_cidrs   = var.ssh_allowed_cidrs
  subnet_cidr         = var.public_subnet_cidr
  user_data           = local.user_data_b64
}
