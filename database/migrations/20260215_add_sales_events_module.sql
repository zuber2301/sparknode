-- Migration: 2026-02-15 - Add Sales & Marketting module tables
-- Creates sales_events, sales_event_registrations, sales_event_leads, sales_event_metrics

BEGIN;

-- sales_events table
CREATE TABLE IF NOT EXISTS sales_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  event_type VARCHAR(50) NOT NULL,
  start_at TIMESTAMP WITH TIME ZONE NOT NULL,
  end_at TIMESTAMP WITH TIME ZONE,
  location TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'draft',
  owner_user_id UUID NOT NULL REFERENCES users(id),
  marketing_owner_id UUID REFERENCES users(id),
  target_registrations INTEGER,
  target_pipeline NUMERIC(18,2),
  target_revenue NUMERIC(18,2),
  registration_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sales_events_tenant_id ON sales_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sales_events_status ON sales_events(status);

-- registrations
CREATE TABLE IF NOT EXISTS sales_event_registrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES sales_events(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  full_name TEXT,
  company TEXT,
  role VARCHAR(255),
  status VARCHAR(50) NOT NULL DEFAULT 'registered',
  source_channel VARCHAR(50),
  utm_source VARCHAR(255),
  utm_campaign VARCHAR(255),
  registered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  checked_in_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_sales_event_registrations_event_id ON sales_event_registrations(event_id);
CREATE INDEX IF NOT EXISTS idx_sales_event_registrations_email ON sales_event_registrations(email);

-- leads
CREATE TABLE IF NOT EXISTS sales_event_leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES sales_events(id) ON DELETE CASCADE,
  registration_id UUID REFERENCES sales_event_registrations(id),
  owner_user_id UUID REFERENCES users(id),
  lead_status VARCHAR(50) NOT NULL DEFAULT 'new',
  qualification_fit VARCHAR(50),
  qualification_timing VARCHAR(50),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sales_event_leads_event_id ON sales_event_leads(event_id);
CREATE INDEX IF NOT EXISTS idx_sales_event_leads_owner_user_id ON sales_event_leads(owner_user_id);

-- metrics
CREATE TABLE IF NOT EXISTS sales_event_metrics (
  event_id UUID PRIMARY KEY REFERENCES sales_events(id) ON DELETE CASCADE,
  registrations INT DEFAULT 0,
  attendees INT DEFAULT 0,
  meetings_booked INT DEFAULT 0,
  opportunities INT DEFAULT 0,
  pipeline_value NUMERIC(18,2) DEFAULT 0,
  revenue_closed NUMERIC(18,2) DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMIT;
