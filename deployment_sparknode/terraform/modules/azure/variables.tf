# ──────────────────────────────────────────────────────────────
# SparkNode — Azure Module Variables
# ──────────────────────────────────────────────────────────────

variable "project_name" {
  description = "Project name used for tagging and naming"
  type        = string
}

variable "environment" {
  description = "Environment name (production, staging)"
  type        = string
}

variable "azure_location" {
  description = "Azure region / location"
  type        = string
  default     = "centralindia"
}

variable "azure_resource_group_name" {
  description = "Name of the Azure resource group (created if it doesn't exist)"
  type        = string
  default     = ""
}

variable "vm_size" {
  description = "Azure VM size"
  type        = string
  default     = "Standard_B2s"
}

variable "os_disk_size_gb" {
  description = "OS disk size in GB"
  type        = number
  default     = 40
}

variable "admin_username" {
  description = "Admin username for the VM"
  type        = string
  default     = "azureuser"
}

variable "ssh_public_key_path" {
  description = "Path to SSH public key file for VM access"
  type        = string
  default     = "~/.ssh/id_rsa.pub"
}

variable "ssh_allowed_cidrs" {
  description = "CIDR blocks allowed to SSH into the instance"
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "vnet_cidr" {
  description = "CIDR block for the Virtual Network"
  type        = string
  default     = "10.0.0.0/16"
}

variable "subnet_cidr" {
  description = "CIDR block for the subnet"
  type        = string
  default     = "10.0.1.0/24"
}

variable "user_data" {
  description = "Base64-encoded cloud-init custom data script"
  type        = string
}
