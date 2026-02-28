# ──────────────────────────────────────────────────────────────
# SparkNode — Azure Module Outputs
# ──────────────────────────────────────────────────────────────

output "instance_id" {
  description = "Azure VM ID"
  value       = azurerm_linux_virtual_machine.sparknode.id
}

output "public_ip" {
  description = "Public IP address"
  value       = azurerm_public_ip.sparknode.ip_address
}

output "ssh_user" {
  description = "SSH username for the VM"
  value       = var.admin_username
}

output "ssh_command" {
  description = "SSH command to connect to the VM"
  value       = "ssh -i <your-key> ${var.admin_username}@${azurerm_public_ip.sparknode.ip_address}"
}

output "resource_group_name" {
  description = "Resource group name"
  value       = azurerm_resource_group.main.name
}

output "vnet_id" {
  description = "Virtual Network ID"
  value       = azurerm_virtual_network.main.id
}

output "nsg_id" {
  description = "Network Security Group ID"
  value       = azurerm_network_security_group.sparknode.id
}
