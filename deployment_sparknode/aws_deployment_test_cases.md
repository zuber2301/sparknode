# AWS Deployment & Infrastructure Test Cases for SparkNode

This document outlines the validation steps to ensure a successful landing of the SparkNode platform on AWS infrastructure.

## 1. Networking & Security (VPC/SGs)
| Test Case ID | Description | Expected Result | Priority |
| :--- | :--- | :--- | :--- |
| **AWS-NET-01** | External access to HTTP (80) | Traffic automatically redirected to HTTPS (443) via Traefik. | High |
| **AWS-NET-02** | External access to HTTPS (443) | Traefik serves a valid Let's Encrypt certificate for the domain. | High |
| **AWS-NET-03** | SSH Access Restriction | Port 22 only accessible from authorized CIDR blocks (bastion/VPN). | Medium |
| **AWS-NET-04** | Internal DB Isolation | Postgres (5432) and Redis (6379) NOT externally reachable. | High |

## 2. Infrastructure (EC2/EBS/EIP)
| Test Case ID | Description | Expected Result | Priority |
| :--- | :--- | :--- | :--- |
| **AWS-IF-01** | Persistent Storage Mounts | EBS volumes for `postgres_data` and `redis_data` survive container restarts. | High |
| **AWS-IF-02** | Elastic IP Assignment | Platform remains reachable at the same IP after EC2 reboot. | Medium |
| **AWS-IF-03** | User Data Execution | `user_data.sh` completes cleanly (check `/var/log/cloud-init-output.log`). | High |

## 3. Application & Stack Performance
| Test Case ID | Description | Expected Result | Priority |
| :--- | :--- | :--- | :--- |
| **AWS-APP-01** | Traefik Dashboard | Accessible at `traefik.${DOMAIN}` (if enabled/secured). | Medium |
| **AWS-APP-02** | Backend Health Check | `/api/v1/health` returns `200 OK`. | High |
| **AWS-APP-03** | Frontend Load Time | Vite application shells load under 1.5s from CloudFront/Nginx. | Medium |

## 4. Monitoring & Logging (CloudWatch)
| Test Case ID | Description | Expected Result | Priority |
| :--- | :--- | :--- | :--- |
| **AWS-MON-01** | Prometheus Metrics | Scrape targets (`backend`, `postgres_exporter`) show as `UP` in Grafana. | High |
| **AWS-MON-02** | CloudWatch Log Streams | Logs from `backend` and `celery` visible in `/sparknode/` log groups. | High |
| **AWS-MON-03** | Grafana Dashboards | Visualizations for CPU/Memory and DB connections populate correctly. | Medium |

## 5. Backup & Recovery (S3/WAL-G)
| Test Case ID | Description | Expected Result | Priority |
| :--- | :--- | :--- | :--- |
| **AWS-BCK-01** | WAL Archiving | New `.wal` segments appear in S3 bucket every ~60s or upon load. | High |
| **AWS-BCK-02** | Full Backup Push | `wal-g backup-push` succeeds manually and via cron. | High |
| **AWS-BCK-03** | Restore Simulation | `wal-g backup-fetch` successfully recreates the data directory in staging. | Critical |

## 6. CI/CD Pipeline Integration
| Test Case ID | Description | Expected Result | Priority |
| :--- | :--- | :--- | :--- |
| **AWS-CI-01** | GitHub Actions Deploy | `deploy.yml` completes build, push, and remote migration without error. | High |
| **AWS-CI-02** | Version Rollback | Previous image tag can be redeployed via `workflow_dispatch`. | Medium |
