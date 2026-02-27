# SparkNode Deployment — Docker Compose + AWS VM + Traefik

End-to-end infrastructure-as-code deployment using **Terraform** to provision an
AWS EC2 instance and deploy SparkNode via **Docker Compose** with **Traefik** as
the reverse proxy / TLS terminator.

## Architecture

```
Internet
  │
  ▼
┌─────────────────────────────────────────────────┐
│  AWS EC2 (Ubuntu 22.04)                         │
│                                                 │
│  ┌───────────────────────────────────────────┐  │
│  │  Docker Compose                           │  │
│  │                                           │  │
│  │  ┌──────────┐   :443/:80                  │  │
│  │  │ Traefik  │◄────── Internet             │  │
│  │  │ (proxy)  │                             │  │
│  │  └────┬─────┘                             │  │
│  │       │                                   │  │
│  │  ┌────▼─────┐  ┌──────────┐               │  │
│  │  │ Frontend │  │ Backend  │               │  │
│  │  │ (nginx)  │  │ (uvicorn)│               │  │
│  │  └──────────┘  └────┬─────┘               │  │
│  │                     │                     │  │
│  │  ┌──────────┐  ┌────▼─────┐  ┌─────────┐ │  │
│  │  │  Redis   │  │ Postgres │  │ Celery  │ │  │
│  │  └──────────┘  └──────────┘  └─────────┘ │  │
│  └───────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

## Directory Structure

```
deployment_sparknode/
├── terraform/
│   ├── main.tf              # Provider, VPC, EC2, SG
│   ├── variables.tf         # Input variables
│   ├── outputs.tf           # Public IP, SSH command
│   ├── user_data.sh         # Cloud-init bootstrap
│   ├── terraform.tfvars.example
│   └── backend.tf           # S3 remote state (optional)
├── docker/
│   ├── docker-compose.prod.yml   # Production compose
│   ├── traefik/
│   │   ├── traefik.yml           # Static config
│   │   └── dynamic/
│   │       └── middlewares.yml   # Dynamic config
│   └── .env.example              # Env template
├── scripts/
│   ├── deploy.sh            # SSH deploy script
│   ├── rollback.sh          # Rollback to previous
│   ├── backup-db.sh         # PostgreSQL backup
│   └── health-check.sh      # Post-deploy validation
├── .github/
│   └── workflows/
│       └── deploy.yml       # GitHub Actions CI/CD
└── README.md
```

## Quick Start

### 1. Prerequisites
- AWS account with IAM credentials
- Terraform >= 1.5
- SSH key pair (or let Terraform create one)
- Domain name pointed to the EC2 Elastic IP (for TLS)

### 2. Provision Infrastructure
```bash
cd deployment_sparknode/terraform
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your values
terraform init
terraform plan
terraform apply
```

### 3. Deploy Application
```bash
cd deployment_sparknode/scripts
./deploy.sh
```

### 4. CI/CD (GitHub Actions)
Push to `main` branch triggers automatic deployment. See `.github/workflows/deploy.yml`.

## TLS / HTTPS
Traefik automatically obtains Let's Encrypt certificates via the HTTP-01 challenge.
Set `DOMAIN` and `ACME_EMAIL` in your environment variables.

## Backups
Automated daily PostgreSQL backups via cron (configured in cloud-init).
Manual backup: `./scripts/backup-db.sh`
