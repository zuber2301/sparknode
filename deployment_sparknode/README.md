# SparkNode Deployment — Management Platform & Cloud Orchestration

This directory contains the **SparkNode Management Platform** (The Orchestrator) and the infrastructure-as-code (Terraform) needed to deploy the SparkNode application across multiple clouds (**AWS**, **Azure**, **GCP**).

## 🧠 The Platform Architecture

The system is split into two distinct lifecycles:

1.  **Management Platform (Control Plane):** A self-hosted UI and API that manages your cloud infrastructure and application deployments.
2.  **Target Infrastructure:** The remote virtual machines and services provisioned by the platform to run the actual SparkNode application.

---

## 🚀 Getting Started (Run the Platform)

To start the Management Platform on your orchestration server:

```bash
# 1. Navigate to the orchestration directory
cd deployment_sparknode

# 2. Run the bootstrap script (Handles .env and Docker)
./bootstrap_sparknode_prod.sh
```

### 🌍 How to Access the Manager UI

Once the platform is running, it is accessible via the domain configured in your `.env` file. By default, Traefik routes traffic as follows:

- **Management UI:** `https://manage.app.sparknode.io` (or just `https://app.sparknode.io`)
- **Orchestrator API:** `https://api.manage.app.sparknode.io` (or `https://app.sparknode.io/api`)

*Note: If running locally for testing, ensure your `/etc/hosts` maps these domains to `127.0.0.1`.*

---

## 🛠 Platform Components

| Service | Container Name | Purpose |
| :--- | :--- | :--- |
| **Manager UI** | `sparknode-manager-ui` | The React-based dashboard for orchestrating deployments. |
| **Orchestrator** | `sparknode-orchestrator` | FastAPI/Celery backend with Terraform & SSH capabilities. |
| **Router** | `sparknode-mgmt-router` | Traefik reverse proxy with automatic SSL (Let's Encrypt). |
| **Platform DB** | `sparknode-mgmt-db` | Metadata storage for deployments, VM status, and cloud config. |

---

## 📡 Deployment Workflow

1.  **Provision:** Use the **Manager UI** to select a cloud provider and region. The Orchestrator will run **Terraform** to create the VM and Network.
2.  **Deploy:** The platform will then SSH into the new VM and deploy the application using the **`app-target.yml`** blueprint, pulling versioned images directly from **DockerHub**.

For more technical details on the inner workings, see [PLATFORM_OPERATIONS.md](./PLATFORM_OPERATIONS.md).
