# ──────────────────────────────────────────────────────────────
# SparkNode — Remote state backend (Multi-Cloud)
#
# Uncomment ONE of the following blocks depending on your
# preferred state storage backend.
# ──────────────────────────────────────────────────────────────

# ─── Option 1: AWS S3 ────────────────────────────────────────
# terraform {
#   backend "s3" {
#     bucket         = "sparknode-terraform-state"
#     key            = "sparknode/production/terraform.tfstate"
#     region         = "ap-south-1"
#     dynamodb_table = "sparknode-terraform-lock"
#     encrypt        = true
#   }
# }

# ─── Option 2: Azure Blob Storage ────────────────────────────
# terraform {
#   backend "azurerm" {
#     resource_group_name  = "sparknode-tfstate-rg"
#     storage_account_name = "sparknodetfstate"
#     container_name       = "tfstate"
#     key                  = "sparknode/production/terraform.tfstate"
#   }
# }

# ─── Option 3: GCP Cloud Storage ─────────────────────────────
# terraform {
#   backend "gcs" {
#     bucket = "sparknode-terraform-state"
#     prefix = "sparknode/production"
#   }
# }
