# ──────────────────────────────────────────────────────────────
# SparkNode — Terraform variables (Multi-Cloud)
# ──────────────────────────────────────────────────────────────

# ─── CLOUD PROVIDER SELECTOR ─────────────────────────────────
variable "cloud_provider" {
  description = "Cloud provider to deploy on: aws, azure, or gcp"
  type        = string
  default     = "aws"

  validation {
    condition     = contains(["aws", "azure", "gcp"], var.cloud_provider)
    error_message = "cloud_provider must be one of: aws, azure, gcp"
  }
}

# ═════════════════════════════════════════════════════════════
#  SHARED VARIABLES (all providers)
# ═════════════════════════════════════════════════════════════

# ─── Networking (shared CIDRs) ───────────────────────────────
variable "vpc_cidr" {
  description = "CIDR block for the VPC / VNet"
  type        = string
  default     = "10.0.0.0/16"
}

variable "public_subnet_cidr" {
  description = "CIDR block for the public subnet"
  type        = string
  default     = "10.0.1.0/24"
}

# ─── Access control ───────────────────────────────────────────
variable "ssh_allowed_cidrs" {
  description = "CIDR blocks allowed to SSH into the instance"
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "ssh_public_key_path" {
  description = "Path to SSH public key file (Azure & GCP)"
  type        = string
  default     = "~/.ssh/id_rsa.pub"
}

# ─── Application ──────────────────────────────────────────────
variable "project_name" {
  description = "Project name used for tagging and naming"
  type        = string
  default     = "sparknode"
}

variable "environment" {
  description = "Environment name (production, staging)"
  type        = string
  default     = "production"
}

variable "domain" {
  description = "Primary domain for TLS certificate (e.g. app.sparknode.io)"
  type        = string
}

variable "acme_email" {
  description = "Email address for Let's Encrypt certificate notifications"
  type        = string
}

# ─── Application secrets (passed to the VM via cloud-init) ───
variable "postgres_password" {
  description = "PostgreSQL password"
  type        = string
  sensitive   = true
}

variable "app_secret_key" {
  description = "Backend JWT / session secret key"
  type        = string
  sensitive   = true
}

variable "smtp_host" {
  description = "SMTP server hostname"
  type        = string
  default     = ""
}

variable "smtp_port" {
  description = "SMTP server port"
  type        = number
  default     = 587
}

variable "smtp_user" {
  description = "SMTP username"
  type        = string
  default     = ""
}

variable "smtp_password" {
  description = "SMTP password"
  type        = string
  sensitive   = true
  default     = ""
}

# ─── Docker image tag ────────────────────────────────────────
variable "app_version" {
  description = "Docker image tag / git ref to deploy"
  type        = string
  default     = "latest"
}

# ─── GitHub repo (for cloning on the VM) ─────────────────────
variable "github_repo" {
  description = "GitHub repository URL (HTTPS)"
  type        = string
  default     = ""
}

variable "github_deploy_token" {
  description = "GitHub personal access token for private repo clone"
  type        = string
  sensitive   = true
  default     = ""
}

# ═════════════════════════════════════════════════════════════
#  AWS-SPECIFIC VARIABLES
# ═════════════════════════════════════════════════════════════

variable "aws_region" {
  description = "AWS region to deploy into"
  type        = string
  default     = "ap-south-1"
}

variable "aws_profile" {
  description = "AWS CLI profile name (leave empty for env-var / IAM-role auth)"
  type        = string
  default     = ""
}

variable "availability_zone" {
  description = "AWS AZ for the public subnet"
  type        = string
  default     = "ap-south-1a"
}

variable "instance_type" {
  description = "AWS EC2 instance type"
  type        = string
  default     = "t3.medium"
}

variable "ami_id" {
  description = "AWS AMI ID (Ubuntu 22.04). Leave empty to auto-discover latest."
  type        = string
  default     = ""
}

variable "key_name" {
  description = "Name of an existing EC2 key pair for SSH access"
  type        = string
  default     = ""
}

variable "root_volume_size" {
  description = "AWS root EBS volume size in GB"
  type        = number
  default     = 40
}

variable "root_volume_type" {
  description = "AWS root EBS volume type"
  type        = string
  default     = "gp3"
}

# ═════════════════════════════════════════════════════════════
#  AZURE-SPECIFIC VARIABLES
# ═════════════════════════════════════════════════════════════

variable "azure_location" {
  description = "Azure region / location"
  type        = string
  default     = "centralindia"
}

variable "azure_resource_group_name" {
  description = "Azure resource group name (auto-generated if empty)"
  type        = string
  default     = ""
}

variable "azure_vm_size" {
  description = "Azure VM size"
  type        = string
  default     = "Standard_B2s"
}

variable "azure_os_disk_size_gb" {
  description = "Azure OS disk size in GB"
  type        = number
  default     = 40
}

variable "azure_admin_username" {
  description = "Azure VM admin username"
  type        = string
  default     = "azureuser"
}

# ═════════════════════════════════════════════════════════════
#  GCP-SPECIFIC VARIABLES
# ═════════════════════════════════════════════════════════════

variable "gcp_project_id" {
  description = "GCP project ID"
  type        = string
  default     = ""
}

variable "gcp_region" {
  description = "GCP region"
  type        = string
  default     = "asia-south1"
}

variable "gcp_zone" {
  description = "GCP zone within the region"
  type        = string
  default     = "asia-south1-a"
}

variable "gcp_machine_type" {
  description = "GCP Compute Engine machine type"
  type        = string
  default     = "e2-medium"
}

variable "gcp_boot_disk_size_gb" {
  description = "GCP boot disk size in GB"
  type        = number
  default     = 40
}

variable "gcp_boot_disk_type" {
  description = "GCP boot disk type"
  type        = string
  default     = "pd-ssd"
}

variable "gcp_ssh_user" {
  description = "GCP VM SSH username"
  type        = string
  default     = "ubuntu"
}
