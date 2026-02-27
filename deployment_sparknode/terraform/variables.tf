# ──────────────────────────────────────────────────────────────
# SparkNode — Terraform variables
# ──────────────────────────────────────────────────────────────

# ─── AWS ──────────────────────────────────────────────────────
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

# ─── Networking ───────────────────────────────────────────────
variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "public_subnet_cidr" {
  description = "CIDR block for the public subnet"
  type        = string
  default     = "10.0.1.0/24"
}

variable "availability_zone" {
  description = "AZ for the public subnet"
  type        = string
  default     = "ap-south-1a"
}

# ─── EC2 Instance ─────────────────────────────────────────────
variable "instance_type" {
  description = "EC2 instance type"
  type        = string
  default     = "t3.medium"
}

variable "ami_id" {
  description = "AMI ID (Ubuntu 22.04). Leave empty to auto-discover latest."
  type        = string
  default     = ""
}

variable "key_name" {
  description = "Name of an existing EC2 key pair for SSH access"
  type        = string
}

variable "root_volume_size" {
  description = "Root EBS volume size in GB"
  type        = number
  default     = 40
}

variable "root_volume_type" {
  description = "Root EBS volume type"
  type        = string
  default     = "gp3"
}

# ─── Access control ───────────────────────────────────────────
variable "ssh_allowed_cidrs" {
  description = "CIDR blocks allowed to SSH into the instance"
  type        = list(string)
  default     = ["0.0.0.0/0"]
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
