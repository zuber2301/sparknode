# ──────────────────────────────────────────────────────────────
# SparkNode — Terraform outputs
# ──────────────────────────────────────────────────────────────

output "instance_id" {
  description = "EC2 instance ID"
  value       = aws_instance.sparknode.id
}

output "public_ip" {
  description = "Elastic IP address"
  value       = aws_eip.sparknode.public_ip
}

output "ssh_command" {
  description = "SSH command to connect to the instance"
  value       = "ssh -i <your-key>.pem ubuntu@${aws_eip.sparknode.public_ip}"
}

output "app_url" {
  description = "Application URL"
  value       = "https://${var.domain}"
}

output "vpc_id" {
  description = "VPC ID"
  value       = aws_vpc.main.id
}

output "security_group_id" {
  description = "Security group ID"
  value       = aws_security_group.sparknode.id
}
