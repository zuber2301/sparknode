# SparkNode Deployment — Multi-Cloud (AWS / Azure / GCP)

End-to-end infrastructure-as-code deployment using **Terraform** to provision a
VM on **AWS**, **Azure**, or **GCP**, then deploy SparkNode via **Docker Compose**
with **Traefik** as the reverse proxy / TLS terminator.

Choose your cloud provider with a single variable — the pipeline, scripts,
and Terraform modules handle the rest.

## Architecture

```
Internet
  │
  ▼
┌─────────────────────────────────────────────────────────────┐
│  VM (AWS EC2 / Azure VM / GCP Compute Engine)               │
│  Ubuntu 22.04                                               │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Docker Compose                                       │  │
│  │                                                       │  │
│  │  ┌──────────┐   :443/:80                              │  │
│  │  │ Traefik  │◄────── Internet                         │  │
│  │  │ (proxy)  │                                         │  │
│  │  └────┬─────┘                                         │  │
│  │       │                                               │  │
│  │  ┌────▼─────┐  ┌──────────┐                           │  │
│  │  │ Frontend │  │ Backend  │                           │  │
│  │  │ (nginx)  │  │ (uvicorn)│                           │  │
│  │  └──────────┘  └────┬─────┘                           │  │
│  │                     │                                 │  │
│  │  ┌──────────┐  ┌────▼─────┐  ┌─────────┐             │  │
│  │  │  Redis   │  │ Postgres │  │ Celery  │             │  │
│  │  └──────────┘  └──────────┘  └─────────┘             │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Directory Structure

```
deployment_sparknode/
├── terraform/
│   ├── main.tf                  # Root — routes to provider module
│   ├── variables.tf             # Shared + provider-specific vars
│   ├── outputs.tf               # Unified outputs (IP, SSH, etc.)
│   ├── backend.tf               # Remote state (S3 / Blob / GCS)
│   ├── user_data.sh             # Cloud-init bootstrap (shared)
│   ├── terraform.tfvars.example
│   └── modules/
│       ├── aws/                 # VPC, SG, EIP, EC2
│       │   ├── main.tf
│       │   ├── variables.tf
│       │   └── outputs.tf
│       ├── azure/               # RG, VNet, NSG, PIP, VM
│       │   ├── main.tf
│       │   ├── variables.tf
│       │   └── outputs.tf
│       └── gcp/                 # VPC, Firewall, Static IP, VM
│           ├── main.tf
│           ├── variables.tf
│           └── outputs.tf
├── docker/
│   ├── docker-compose.prod.yml
│   ├── traefik/
│   │   ├── traefik.yml
│   │   └── dynamic/
│   │       └── middlewares.yml
│   ├── nginx.prod.conf
│   └── .env.example
├── scripts/
│   ├── deploy.sh                # Multi-cloud deploy (--provider flag)
│   ├── rollback.sh              # Multi-cloud rollback
│   ├── backup-db.sh             # Backup to S3/Blob/GCS
│   └── health-check.sh          # Post-deploy validation
├── .github/
│   └── workflows/
│       ├── deploy.yml           # CI/CD with cloud provider choice
│       └── terraform.yml        # Infra management with provider choice
└── README.md
```

## Quick Start

### 1. Prerequisites

| Provider | Requirements |
|----------|-------------|
| **AWS**  | `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, EC2 key pair |
| **Azure** | `ARM_CLIENT_ID`, `ARM_CLIENT_SECRET`, `ARM_SUBSCRIPTION_ID`, `ARM_TENANT_ID`, SSH public key |
| **GCP**  | `GOOGLE_APPLICATION_CREDENTIALS` (service account JSON), SSH public key, GCP project ID |

Common: Terraform >= 1.5, domain name pointed to the VM's public IP.

### 2. Provision Infrastructure

```bash
cd deployment_sparknode/terraform
cp terraform.tfvars.example terraform.tfvars

# Edit terraform.tfvars — set cloud_provider and fill provider-specific values
# cloud_provider = "aws"   # or "azure" or "gcp"

terraform init
terraform plan
terraform apply
```

### 3. Deploy Application

```bash
cd deployment_sparknode/scripts

# Auto-detects provider, host, and SSH user from Terraform outputs
./deploy.sh

# Or specify explicitly
./deploy.sh --provider aws --host 1.2.3.4
./deploy.sh --provider azure --host 1.2.3.4
./deploy.sh --provider gcp --host 1.2.3.4
```

### 4. CI/CD (GitHub Actions)

Push to `main` triggers automatic deployment. For manual dispatch, select the
cloud provider from the dropdown:

**Terraform workflow** (`.github/workflows/terraform.yml`):
- Inputs: `cloud_provider` (aws/azure/gcp), `action` (plan/apply/destroy)

**Deploy workflow** (`.github/workflows/deploy.yml`):
- Inputs: `cloud_provider` (aws/azure/gcp), `environment`, `branch`

#### Required GitHub Secrets

| Secret | Used by |
|--------|---------|
| `AWS_ACCESS_KEY_ID` | AWS |
| `AWS_SECRET_ACCESS_KEY` | AWS |
| `ARM_CLIENT_ID` | Azure |
| `ARM_CLIENT_SECRET` | Azure |
| `ARM_SUBSCRIPTION_ID` | Azure |
| `ARM_TENANT_ID` | Azure |
| `GCP_CREDENTIALS_JSON` | GCP |
| `DEPLOY_SSH_KEY` | All (SSH private key) |
| `DEPLOY_HOST` | All (fallback host) |
| `DEPLOY_HOST_AWS` | AWS (provider-specific host) |
| `DEPLOY_HOST_AZURE` | Azure (provider-specific host) |
| `DEPLOY_HOST_GCP` | GCP (provider-specific host) |
| `POSTGRES_PASSWORD` | All |
| `APP_SECRET_KEY` | All |
| `SMTP_PASSWORD` | All (optional) |

## Cloud Provider Comparison

| Feature | AWS | Azure | GCP |
|---------|-----|-------|-----|
| VM type | EC2 `t3.medium` | `Standard_B2s` | `e2-medium` |
| Default OS | Ubuntu 22.04 | Ubuntu 22.04 | Ubuntu 22.04 |
| Static IP | Elastic IP | Public IP (Static) | Static External IP |
| Network | VPC + Subnet | VNet + Subnet | VPC + Subnet |
| Firewall | Security Group | NSG | Firewall Rules |
| SSH user | `ubuntu` | `azureuser` | `ubuntu` |
| Default region | `ap-south-1` | `centralindia` | `asia-south1` |
| State backend | S3 + DynamoDB | Azure Blob Storage | GCS |

## TLS / HTTPS
Traefik automatically obtains Let's Encrypt certificates via the HTTP-01 challenge.
Set `domain` and `acme_email` in your terraform.tfvars.

## Backups

```bash
# AWS — backup to S3
./scripts/backup-db.sh --provider aws --host <IP> --s3 s3://my-bucket/sparknode/

# Azure — backup to Blob
./scripts/backup-db.sh --provider azure --host <IP> --blob https://account.blob.core.windows.net/backups

# GCP — backup to GCS
./scripts/backup-db.sh --provider gcp --host <IP> --gcs gs://my-bucket/sparknode/
```

Automated daily PostgreSQL backups via cron (configured in cloud-init).

## Switching Providers

To migrate to a different cloud provider:

1. Update `cloud_provider` in `terraform.tfvars`
2. Fill in the provider-specific variables
3. Run `terraform init` (downloads new provider plugins)
4. Run `terraform plan` to review
5. Run `terraform apply`
6. Point your DNS to the new VM's public IP
7. Run `./scripts/deploy.sh` to deploy the application
