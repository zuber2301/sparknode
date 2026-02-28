# 🚀 SparkNode Deployment & Infrastructure

This document provides a comprehensive overview of the SparkNode infrastructure, deployment pipelines, and operational best practices.

## 🏗 System Architecture

SparkNode follows a **Multi-Stage Deployment** architecture, orchestrated via Terraform and managed through Docker Compose.

### Core Components
- **Frontend**: Vite-based React SPA, served via Nginx with Traefik as the ingress proxy.
- **Backend**: FastAPI (Python 3.12) running under Gunicorn/Uvicorn.
- **Worker**: Celery workers for asynchronous tasks (emails, report generation).
- **Database**: PostgreSQL 15.8 (Custom WAL-G Image) with Point-In-Time Recovery (PITR).
- **Cache**: Redis 7-alpine for session management and Celery broker.
- **Ingress**: Traefik v3.1 for automated Let's Encrypt TLS and reverse proxying.

---

## 🛠 Deployment Workflow

We use a "Build Once, Deploy Anywhere" philosophy using GitHub Actions and DockerHub.

### 1. CI Pipeline ([ci.yml](.github/workflows/ci.yml))
- **Trigger**: Manual via `workflow_dispatch`.
- **Actions**:
  - Builds Docker images for `backend` and `frontend`.
  - Tags images using Semantic Versioning (from `VERSION` file).
  - Pushes images to DockerHub (`zuber2301/sparknode-*`).
  - Purges old image versions to maintain registry hygiene.

### 2. Infrastructure Provisioning ([terraform/](deployment_sparknode/terraform/))
- **Providers**: AWS, Azure, GCP (Modular setup).
- **State**: Managed via Terraform Cloud or local backend.
- **Initialization**: `user_data.sh` handles initial VM security, Docker installation, and multi-file Compose orchestration.

### 3. CD Pipeline ([deploy.yml](deployment_sparknode/.github/workflows/deploy.yml))
- **Actions**:
  - Connects to target VM via SSH.
  - Pulls latest images from DockerHub.
  - Orchestrates migrations: `docker exec backend alembic upgrade head`.
  - Restarts services with zero-downtime strategy.

---

## 💾 Database & Backups (WAL-G)

SparkNode uses **WAL-G** for high-durability continuous backups.

- **Archiving**: PostgreSQL WAL segments are streamed to S3 every 60 seconds.
- **Full Snapshots**: Pushed daily at 02:00 UTC via Cron.
- **Retention**: Rolling 14-day window for full restores; older data handled by S3 Lifecycle rules.
- **Testing**: Automated weekly restore tests via [.github/workflows/backup-restore-test.yml](.github/workflows/backup-restore-test.yml).

---

## 📊 Monitoring & Observability

A complete observability stack is deployed alongside the application ([docker-monitoring.yml](deployment_sparknode/docker/docker-monitoring.yml)).

- **Prometheus**: Scrapes metrics from Backend (`/metrics`), Postgres, and Node Exporter.
- **Grafana**: Accessible at `grafana.${DOMAIN}` for real-time visualization.
- **Logs**: Container logs are forwarded to **AWS CloudWatch** using the `awslogs` driver.
- **Alerting**: Configured via Prometheus Alertmanager (Email/Slack).

---

## 🛡 Security & Compliance

- **Secrets**: Injected via GitHub Secrets → `.env` files. No hardcoded credentials in code or Terraform.
- **Firewall**: Security Groups restrict access to ports 80/443. DB (5432) and Cache (6379) are isolated to internal networks.
- **Versions**: All software is pinned to specific stable tags (e.g., `postgres:15.8-alpine`).

---

## 🎮 SparkNode Launchpad (Manager UI)

For an interactive deployment experience, use the **Launchpad UI** located in `deployment_sparknode/manager-ui/`.

```bash
cd deployment_sparknode/manager-ui
npm install
npm run dev
```

The Launchpad provides a themed, multi-step wizard to configure cloud regions, instance sizing, and backup policies before triggering the pipelines.

---

## 🧪 Post-Deployment Validation

After every deployment, run the validation suite to ensure stack integrity:

```bash
# On the target VM
chmod +x ./deployment_sparknode/validate_aws_deploy.sh
./deployment_sparknode/validate_aws_deploy.sh
```

Refer to [aws_deployment_test_cases.md](deployment_sparknode/aws_deployment_test_cases.md) for a full checklist of infrastructure expectations.
