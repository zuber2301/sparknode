# ──────────────────────────────────────────────────────────────
# SparkNode — (Optional) S3 remote state backend
#
# Uncomment and configure once you have an S3 bucket + DynamoDB
# table for state locking.
# ──────────────────────────────────────────────────────────────

# terraform {
#   backend "s3" {
#     bucket         = "sparknode-terraform-state"
#     key            = "sparknode/production/terraform.tfstate"
#     region         = "ap-south-1"
#     dynamodb_table = "sparknode-terraform-lock"
#     encrypt        = true
#   }
# }
