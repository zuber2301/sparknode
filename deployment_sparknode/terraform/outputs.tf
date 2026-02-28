# ──────────────────────────────────────────────────────────────
# SparkNode — Terraform outputs (Multi-Cloud)
# Routes to the active provider's module outputs
# ──────────────────────────────────────────────────────────────

output "cloud_provider" {
  description = "Active cloud provider"
  value       = var.cloud_provider
}

output "instance_id" {
  description = "VM / instance ID"
  value = (
    var.cloud_provider == "aws"   ? module.aws[0].instance_id :
    var.cloud_provider == "azure" ? module.azure[0].instance_id :
    var.cloud_provider == "gcp"   ? module.gcp[0].instance_id :
    "unknown"
  )
}

output "public_ip" {
  description = "Public IP address of the VM"
  value = (
    var.cloud_provider == "aws"   ? module.aws[0].public_ip :
    var.cloud_provider == "azure" ? module.azure[0].public_ip :
    var.cloud_provider == "gcp"   ? module.gcp[0].public_ip :
    "unknown"
  )
}

output "ssh_user" {
  description = "SSH username for the VM"
  value = (
    var.cloud_provider == "aws"   ? module.aws[0].ssh_user :
    var.cloud_provider == "azure" ? module.azure[0].ssh_user :
    var.cloud_provider == "gcp"   ? module.gcp[0].ssh_user :
    "unknown"
  )
}

output "ssh_command" {
  description = "SSH command to connect to the VM"
  value = (
    var.cloud_provider == "aws"   ? module.aws[0].ssh_command :
    var.cloud_provider == "azure" ? module.azure[0].ssh_command :
    var.cloud_provider == "gcp"   ? module.gcp[0].ssh_command :
    "unknown"
  )
}

output "app_url" {
  description = "Application URL"
  value       = "https://${var.domain}"
}
