-- Migration: 2026-01-31 - Add Events Hub Tables
-- Creates comprehensive event management system with activities, nominations, teams, gifts, and budgets

BEGIN;

-- Events table
CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    title VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(50) NOT NULL, -- annual_day, gift_distribution, sports_day, custom
    
    start_datetime TIMESTAMP WITH TIME ZONE NOT NULL,
    end_datetime TIMESTAMP WITH TIME ZONE NOT NULL,
    
    venue VARCHAR(500),
    location VARCHAR(500),
    format VARCHAR(50) DEFAULT 'onsite', -- onsite, virtual, hybrid
    
    status VARCHAR(50) DEFAULT 'draft', -- draft, published, ongoing, closed, archived
    visibility VARCHAR(50) DEFAULT 'all_employees',
    visible_to_departments JSONB DEFAULT '[]',
    
    banner_url VARCHAR(500),
    color_code VARCHAR(20) DEFAULT '#3B82F6',
    
    nomination_start TIMESTAMP WITH TIME ZONE,
    nomination_end TIMESTAMP WITH TIME ZONE,
    who_can_nominate VARCHAR(50) DEFAULT 'all_employees',
    max_activities_per_person INTEGER DEFAULT 5,
    
    planned_budget DECIMAL(15, 2) DEFAULT 0,
    currency VARCHAR(10) DEFAULT 'USD',
    
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_events_tenant_id ON events(tenant_id);
CREATE INDEX idx_events_status ON events(status);
CREATE INDEX idx_events_start_datetime ON events(start_datetime DESC);

-- Event Activities table
CREATE TABLE event_activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL, -- solo, group, other
    
    max_participants INTEGER,
    max_teams INTEGER,
    min_team_size INTEGER DEFAULT 1,
    max_team_size INTEGER,
    
    nomination_start TIMESTAMP WITH TIME ZONE,
    nomination_end TIMESTAMP WITH TIME ZONE,
    activity_start TIMESTAMP WITH TIME ZONE,
    activity_end TIMESTAMP WITH TIME ZONE,
    
    requires_approval BOOLEAN DEFAULT FALSE,
    allow_multiple_teams BOOLEAN DEFAULT FALSE,
    rules_text TEXT,
    
    sequence INTEGER,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_event_activities_event_id ON event_activities(event_id);
CREATE INDEX idx_event_activities_tenant_id ON event_activities(tenant_id);

-- Event Nominations table
CREATE TABLE event_nominations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    activity_id UUID NOT NULL REFERENCES event_activities(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    nominee_user_id UUID NOT NULL REFERENCES users(id),
    team_id UUID REFERENCES event_teams(id) ON DELETE SET NULL,
    
    created_by UUID REFERENCES users(id),
    status VARCHAR(50) DEFAULT 'pending', -- pending, approved, rejected, waitlisted
    
    performance_title VARCHAR(255),
    notes TEXT,
    preferred_slot VARCHAR(100),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_event_nominations_event_id ON event_nominations(event_id);
CREATE INDEX idx_event_nominations_activity_id ON event_nominations(activity_id);
CREATE INDEX idx_event_nominations_nominee_user_id ON event_nominations(nominee_user_id);
CREATE INDEX idx_event_nominations_status ON event_nominations(status);
CREATE INDEX idx_event_nominations_tenant_id ON event_nominations(tenant_id);

-- Event Teams table
CREATE TABLE event_teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    activity_id UUID NOT NULL REFERENCES event_activities(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    team_name VARCHAR(255) NOT NULL,
    description TEXT,
    
    captain_user_id UUID NOT NULL REFERENCES users(id),
    
    status VARCHAR(50) DEFAULT 'forming', -- forming, complete, approved, rejected
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_event_teams_activity_id ON event_teams(activity_id);
CREATE INDEX idx_event_teams_tenant_id ON event_teams(tenant_id);
CREATE INDEX idx_event_teams_captain_user_id ON event_teams(captain_user_id);

-- Event Team Members table
CREATE TABLE event_team_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID NOT NULL REFERENCES event_teams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    role VARCHAR(50) DEFAULT 'member', -- member, captain
    status VARCHAR(50) DEFAULT 'active', -- active, inactive, left
    
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_event_team_members_team_id ON event_team_members(team_id);
CREATE INDEX idx_event_team_members_user_id ON event_team_members(user_id);
CREATE INDEX idx_event_team_members_tenant_id ON event_team_members(tenant_id);

-- Event Gift Batches table
CREATE TABLE event_gift_batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    gift_name VARCHAR(255) NOT NULL,
    gift_type VARCHAR(50) NOT NULL, -- hamper, voucher, swag, merchandise, other
    description TEXT,
    
    quantity INTEGER NOT NULL,
    unit_value DECIMAL(10, 2) NOT NULL,
    
    eligible_criteria JSONB DEFAULT '{}',
    distribution_start TIMESTAMP WITH TIME ZONE,
    distribution_end TIMESTAMP WITH TIME ZONE,
    distribution_locations JSONB DEFAULT '[]',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_event_gift_batches_event_id ON event_gift_batches(event_id);
CREATE INDEX idx_event_gift_batches_tenant_id ON event_gift_batches(tenant_id);

-- Event Gift Redemptions table (QR-based collection tracking)
CREATE TABLE event_gift_redemptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    gift_batch_id UUID NOT NULL REFERENCES event_gift_batches(id) ON DELETE CASCADE,
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    user_id UUID NOT NULL REFERENCES users(id),
    
    qr_token VARCHAR(500) NOT NULL UNIQUE,
    qr_token_expires_at TIMESTAMP WITH TIME ZONE,
    
    status VARCHAR(50) DEFAULT 'not_issued', -- not_issued, issued, redeemed, expired
    
    redeemed_at TIMESTAMP WITH TIME ZONE,
    redeemed_location VARCHAR(255),
    redeemed_by UUID REFERENCES users(id),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_event_gift_redemptions_gift_batch_id ON event_gift_redemptions(gift_batch_id);
CREATE INDEX idx_event_gift_redemptions_event_id ON event_gift_redemptions(event_id);
CREATE INDEX idx_event_gift_redemptions_user_id ON event_gift_redemptions(user_id);
CREATE INDEX idx_event_gift_redemptions_status ON event_gift_redemptions(status);
CREATE INDEX idx_event_gift_redemptions_tenant_id ON event_gift_redemptions(tenant_id);

-- Event Budgets table
CREATE TABLE event_budgets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL UNIQUE REFERENCES events(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    planned_budget DECIMAL(15, 2) NOT NULL,
    actual_spend DECIMAL(15, 2) DEFAULT 0,
    committed_spend DECIMAL(15, 2) DEFAULT 0,
    
    budget_breakdown JSONB DEFAULT '{}',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_event_budgets_event_id ON event_budgets(event_id);
CREATE INDEX idx_event_budgets_tenant_id ON event_budgets(tenant_id);

-- Event Metrics table (aggregated analytics)
CREATE TABLE event_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL UNIQUE REFERENCES events(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    total_invited INTEGER DEFAULT 0,
    total_registered INTEGER DEFAULT 0,
    total_participated INTEGER DEFAULT 0,
    no_shows INTEGER DEFAULT 0,
    
    activity_metrics JSONB DEFAULT '{}',
    
    gifts_eligible INTEGER DEFAULT 0,
    gifts_issued INTEGER DEFAULT 0,
    gifts_redeemed INTEGER DEFAULT 0,
    
    department_metrics JSONB DEFAULT '{}',
    
    computed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_event_metrics_event_id ON event_metrics(event_id);
CREATE INDEX idx_event_metrics_tenant_id ON event_metrics(tenant_id);

-- Add foreign key constraint for team_id in nominations (now that event_teams exists)
ALTER TABLE event_nominations 
ADD CONSTRAINT fk_event_nominations_team_id 
FOREIGN KEY (team_id) REFERENCES event_teams(id) ON DELETE SET NULL;

COMMIT;
