# ──────────────────────────────────────────────────────────────────
# SparkNode Control Plane — Backend / Celery Worker Image
# Includes: Python 3.11 + Terraform for plan/apply tasks
# ──────────────────────────────────────────────────────────────────
FROM python:3.11-slim

# System deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl unzip ca-certificates git bash openssh-client \
    && rm -rf /var/lib/apt/lists/*

# ── Install Terraform ──────────────────────────────────────────
ARG TERRAFORM_VERSION=1.7.4
RUN curl -fsSL \
    "https://releases.hashicorp.com/terraform/${TERRAFORM_VERSION}/terraform_${TERRAFORM_VERSION}_linux_amd64.zip" \
    -o /tmp/terraform.zip \
    && unzip /tmp/terraform.zip -d /usr/local/bin \
    && rm /tmp/terraform.zip \
    && terraform version

WORKDIR /app

# ── App source ─────────────────────────────────────────────────
COPY control-plane-api/app/ ./app/

# ── Terraform modules (needed at runtime) ─────────────────────
COPY terraform/ ./terraform/

# ── Requirements ──────────────────────────────────────────────
COPY control-plane-api/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
