-- Migration: add CRM connectors and webhook logs for sales module
CREATE TABLE IF NOT EXISTS crm_connectors (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name text NOT NULL,
    connector_type text NOT NULL,
    config jsonb DEFAULT '{}'::jsonb,
    enabled boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_connectors_tenant ON crm_connectors(tenant_id);

CREATE TABLE IF NOT EXISTS webhook_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    connector_id uuid REFERENCES crm_connectors(id) ON DELETE SET NULL,
    event_type text NOT NULL,
    payload jsonb,
    response_status integer,
    response_body text,
    attempted_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhook_logs_tenant ON webhook_logs(tenant_id);
