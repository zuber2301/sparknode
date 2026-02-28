# ──────────────────────────────────────────────────────────────
# SparkNode — GCP Module Outputs
# ──────────────────────────────────────────────────────────────

output "instance_id" {
  description = "GCP Compute instance ID"
  value       = google_compute_instance.sparknode.instance_id
}

output "instance_name" {
  description = "GCP Compute instance name"
  value       = google_compute_instance.sparknode.name
}

output "public_ip" {
  description = "Static external IP address"
  value       = google_compute_address.sparknode.address
}

output "ssh_user" {
  description = "SSH username for the VM"
  value       = var.ssh_user
}

output "ssh_command" {
  description = "SSH command to connect to the VM"
  value       = "ssh -i <your-key> ${var.ssh_user}@${google_compute_address.sparknode.address}"
}

output "network_id" {
  description = "VPC Network ID"
  value       = google_compute_network.main.id
}

output "zone" {
  description = "GCP zone where the instance runs"
  value       = var.gcp_zone
}
