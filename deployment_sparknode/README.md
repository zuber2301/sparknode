# SparkNode Deployment — Multi-Cloud (AWS / Azure / GCP)

End-to-end infrastructure-as-code deployment using **Terraform** to provision a
VM on **AWS**, **Azure**, or **GCP**, then deploy SparkNode via **Docker Compose**
with **Traefik** as the reverse proxy / TLS terminator.

Images are built in CI and pushed to **DockerHub**. Deployment pulls
pre-built images onto the VM — no source code or build tools needed on the server.

## 3-Step Deployment Pipeline

```
Step 1: CI Build & Push                Step 2: Infrastructure           Step 3: Deploy
──────────────────────────             ─────────────────────            ──────────────────
Push to main ──► GitHub Actions        terraform plan/apply             workflow_dispatch
  │                                      │                                │
  ├── Build backend Dockerfile           ├── Provision VM                 ├── SSH into VM
  ├── Build frontend Dockerfile.prod     ├── Configure networking         ├── Update APP_VERSION
  ├── Tag with git SHA + latest          ├── Set up Docker (cloud-init)   ├── docker compose pull
  └── Push to DockerHub                  └── Bootstrap services           └── docker compose up
```

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
│  │  Docker Compose (images pulled from DockerHub)        │  │
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

## Container Images

| Image | Source | Registry |
|-------|--------|----------|
| `zuber2301/sparknode-backend:<tag>` | `backend/Dockerfile` | DockerHub |
| `zuber2301/sparknode-frontend:<tag>` | `frontend/Dockerfile.prod` | DockerHub |

Images use **semantic versioning** (e.g. `1.2.3`) with additional tags for `X.Y`, `X`, `latest`, and `sha-<short>` on every push to `main` or git tag.

## Directory Structure

```
deployment_sparknode/
├── terraform/
│   ├── main.tf                  # Root — routes to provider module
│   ├── variables.tf             # Shared + provider-specific vars
│   ├── outputs.tf               # Unified outputs (IP, SSH, etc.)
│   ├── backend.tf               # Remote state (S3 / Blob / GCS)
│   ├── user_data.sh             # Cloud-init bootstrap (image pull)
│   ├── terraform.tfvars.example
│   └── modules/
│       ├── aws/                 # VPC, SG, EIP, EC2
│       ├── azure/               # RG, VNet, NSG, PIP, VM
│       └── gcp/                 # VPC, Firewall, Static IP, VM
├── docker/
│   ├── docker-compose.prod.yml  # Uses image: from DockerHub
│   ├── traefik/
│   │   ├── traefik.yml
│   │   └── dynamic/middlewares.yml
│   ├── nginx.prod.conf
│   └── .env.example
├── scripts/
│   ├── deploy.sh                # Deploy specific image version
│   ├── rollback.sh              # Rollback to previous version
│   ├── backup-db.sh             # Backup to S3/Blob/GCS
│   └── health-check.sh          # Post-deploy validation
├── .github/
│   └── workflows/
│       ├── deploy.yml           # Deploy pipeline (image pull)
│       └── terraform.yml        # Infra management
└── README.md

# Project root also contains:
.github/workflows/ci.yml          # CI: Build & push to DockerHub
frontend/Dockerfile.prod           # Production multi-stage frontend
frontend/nginx.prod.conf           # Nginx config baked into image
backend/Dockerfile                 # Production backend image
```

## Quick Start

### 1. Prerequisites

| Provider | Requirements |
|----------|-------------|
| **AWS**  | `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, EC2 key pair |
| **Azure** | `ARM_CLIENT_ID`, `ARM_CLIENT_SECRET`, `ARM_SUBSCRIPTION_ID`, `ARM_TENANT_ID`, SSH public key |
| **GCP**  | `GOOGLE_APPLICATION_CREDENTIALS` (service account JSON), SSH public key, GCP project ID |

Common: Terraform >= 1.5, DockerHub account, domain name pointed to the VM's public IP.

### 2. Step 1 — Build & Push Images (CI)

Images are automatically built and pushed on every push to `main` via
`.github/workflows/ci.yml`. You can also trigger manually:

```bash
# Manual trigger via GitHub CLI
gh workflow run ci.yml -f version_bump=patch -f push=true

# Or with a custom version
gh workflow run ci.yml -f version_bump=custom -f custom_version=2.0.0-rc.1 -f push=true
```

### 3. Step 2 — Provision Infrastructure

```bash
cd deployment_sparknode/terraform
cp terraform.tfvars.example terraform.tfvars

# Edit terraform.tfvars — set cloud_provider, dockerhub_org, etc.
# cloud_provider = "aws"   # or "azure" or "gcp"

terraform init
terraform plan
terraform apply
```

### 4. Step 3 — Deploy Application

```bash
cd deployment_sparknode/scripts

# Deploy a specific image version (recommended — use semver)
./deploy.sh --version 1.2.3

# Deploy latest
./deploy.sh --version latest

# Or specify provider and host explicitly
./deploy.sh --provider aws --host 1.2.3.4 --version 1.2.3
```

### 5. CI/CD (GitHub Actions)

**CI workflow** (`.github/workflows/ci.yml`) — runs on push to main or `v*` tags:
- Reads `VERSION` file for semantic version
- Builds backend & frontend Docker images
- Tags with `X.Y.Z`, `X.Y`, `X`, `latest`, `sha-<short>`
- Pushes to DockerHub (`zuber2301`)
- Manual dispatch supports patch/minor/major bumps

**Deploy workflow** (`deployment_sparknode/.github/workflows/deploy.yml`) — manual dispatch:
- Inputs: `cloud_provider` (aws/azure/gcp), `environment`, `image_tag`
- SSHs into VM, sets APP_VERSION, pulls images, restarts

**Terraform workflow** (`deployment_sparknode/.github/workflows/terraform.yml`) — manual dispatch:
- Inputs: `cloud_provider` (aws/azure/gcp), `action` (plan/apply/destroy)

#### Required GitHub Secrets

| Secret | Used by | Description |
|--------|---------|-------------|
| `DOCKERHUB_USERNAME` | CI | DockerHub username for push |
| `DOCKERHUB_TOKEN` | CI + Deploy | DockerHub access token |
| `DEPLOY_SSH_KEY` | Deploy | SSH private key for VM |
| `DEPLOY_HOST` | Deploy | VM public IP (fallback) |
| `DEPLOY_HOST_AWS` | Deploy | AWS VM public IP |
| `DEPLOY_HOST_AZURE` | Deploy | Azure VM public IP |
| `DEPLOY_HOST_GCP` | Deploy | GCP VM public IP |
| `AWS_ACCESS_KEY_ID` | Terraform | AWS |
| `AWS_SECRET_ACCESS_KEY` | Terraform | AWS |
| `ARM_CLIENT_ID` | Terraform | Azure |
| `ARM_CLIENT_SECRET` | Terraform | Azure |
| `ARM_SUBSCRIPTION_ID` | Terraform | Azure |
| `ARM_TENANT_ID` | Terraform | Azure |
| `GCP_CREDENTIALS_JSON` | Terraform | GCP |
| `POSTGRES_PASSWORD` | Terraform | DB password |
| `APP_SECRET_KEY` | Terraform | JWT secret |
| `SMTP_PASSWORD` | Terraform | Optional |

#### GitHub Variables (non-secret)

| Variable | Default | Description |
|----------|---------|-------------|
| `DOCKERHUB_ORG` | `zuber2301` | DockerHub org/username |
| `DOMAIN` | `app.sparknode.io` | Domain for the app |

## Rollback

```bash
# Rollback to a specific image version
./scripts/rollback.sh --version 1.1.0

# Rollback with database restore
./scripts/rollback.sh --version abc1234 --restore-db

# If no --version is specified, uses the last deployed version
./scripts/rollback.sh
```

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
7. Run `./scripts/deploy.sh --version <tag>` to deploy
