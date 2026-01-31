-- SparkNode Database Initialization Script
-- Multi-tenant Employee Rewards & Recognition Platform
-- Version 2.0 - Full Multi-Tenant SaaS Architecture

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- TENANT & IDENTITY TABLES
-- =====================================================

-- Tenants (Companies) - Enhanced for SaaS
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE,
    domain VARCHAR(255) UNIQUE,
    logo_url VARCHAR(500),
    favicon_url VARCHAR(500),
    
    -- Theme & Branding Config
    theme_config JSONB DEFAULT '{"primary_color": "#3B82F6", "secondary_color": "#8B5CF6", "font_family": "Inter"}',
    domain_whitelist JSONB DEFAULT '[]',
    auth_method VARCHAR(50) DEFAULT 'PASSWORD_AND_OTP',
    
    -- Point Economy Config
    currency_label VARCHAR(100) DEFAULT 'Points',
    conversion_rate NUMERIC(10, 4) DEFAULT 1.0,
    auto_refill_threshold NUMERIC(5, 2) DEFAULT 20.0,
    
    -- Recognition Laws Config
    award_tiers JSONB DEFAULT '{"Gold": 5000, "Silver": 2500, "Bronze": 1000}',
    peer_to_peer_enabled BOOLEAN DEFAULT TRUE,
    expiry_policy VARCHAR(50) DEFAULT 'NEVER',
    
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended', 'trial')),
    
    -- Subscription & Billing
    subscription_tier VARCHAR(50) DEFAULT 'starter' CHECK (subscription_tier IN ('free', 'starter', 'professional', 'enterprise', 'basic', 'premium')),
    subscription_status VARCHAR(50) DEFAULT 'active' CHECK (subscription_status IN ('active', 'past_due', 'cancelled')),
    subscription_started_at TIMESTAMP WITH TIME ZONE,
    subscription_ends_at TIMESTAMP WITH TIME ZONE,
    max_users INTEGER DEFAULT 50,
    master_budget_balance DECIMAL(15, 2) NOT NULL DEFAULT 0,
    
    -- Settings & Customization
    settings JSONB DEFAULT '{"copay_enabled": false, "points_to_currency_ratio": 0.10, "peer_to_peer_recognition": true, "social_feed_enabled": true, "events_module_enabled": true}',
    feature_flags JSONB DEFAULT '{}',
    catalog_settings JSONB DEFAULT '{}',
    branding JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Departments
CREATE TABLE departments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL CHECK (name IN ('Human Resource (HR)', 'Techology (IT)', 'Sale & Marketting', 'Business Unit -1', 'Business Unit-2', 'Business Unit-3')),
    parent_id UUID REFERENCES departments(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(tenant_id, name)
);

-- Users with 4-tier role model
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    corporate_email VARCHAR(255) NOT NULL,
    personal_email VARCHAR(255),
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    org_role VARCHAR(50) NOT NULL CHECK (org_role IN ('platform_admin', 'tenant_admin', 'hr_admin', 'tenant_lead', 'manager', 'corporate_user', 'employee')),
    department_id UUID NOT NULL REFERENCES departments(id),
    manager_id UUID REFERENCES users(id),
    avatar_url VARCHAR(500),
    phone_number VARCHAR(20),
    mobile_number VARCHAR(20),
    date_of_birth DATE,
    hire_date DATE,
    status VARCHAR(50) DEFAULT 'ACTIVE' CHECK (status IN ('PENDING_INVITE', 'ACTIVE', 'DEACTIVATED', 'pending_invite', 'active', 'deactivated')),
    is_super_admin BOOLEAN DEFAULT FALSE,
    invitation_sent_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(tenant_id, corporate_email)
);

-- System Admins (Platform Admins)
CREATE TABLE system_admins (
    admin_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    access_level VARCHAR(20) DEFAULT 'PLATFORM_ADMIN',
    mfa_enabled BOOLEAN DEFAULT TRUE,
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- OTP Tokens (Email/SMS verification)
CREATE TABLE otp_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    channel VARCHAR(20) NOT NULL CHECK (channel IN ('email', 'sms')),
    destination VARCHAR(255) NOT NULL,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_otp_tokens_user_channel ON otp_tokens(user_id, channel);

-- Bulk Upload Staging
CREATE TABLE user_upload_staging (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    batch_id UUID NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    department_name VARCHAR(255),
    org_role VARCHAR(50),
    manager_email VARCHAR(255),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    department_id UUID,
    manager_id UUID,
    status VARCHAR(50) DEFAULT 'pending',
    errors JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_user_upload_staging_batch ON user_upload_staging(batch_id);

-- =====================================================
-- BUDGET & ALLOCATION TABLES
-- =====================================================

-- Company Budgets (Annual/Quarterly)
CREATE TABLE budgets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    fiscal_year INTEGER NOT NULL,
    fiscal_quarter INTEGER CHECK (fiscal_quarter IN (1, 2, 3, 4)),
    total_points DECIMAL(15, 2) NOT NULL DEFAULT 0,
    allocated_points DECIMAL(15, 2) NOT NULL DEFAULT 0,
    remaining_points DECIMAL(15, 2) GENERATED ALWAYS AS (total_points - allocated_points) STORED,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('draft', 'active', 'closed')),
    expiry_date DATE,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Department Budgets
CREATE TABLE department_budgets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    budget_id UUID NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
    department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    allocated_points DECIMAL(15, 2) NOT NULL DEFAULT 0,
    spent_points DECIMAL(15, 2) NOT NULL DEFAULT 0,
    remaining_points DECIMAL(15, 2) GENERATED ALWAYS AS (allocated_points - spent_points) STORED,
    monthly_cap DECIMAL(15, 2),
    expiry_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(budget_id, department_id)
);

-- Lead Budgets (Allocation for individual Managers/Leads)
CREATE TABLE lead_budgets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    department_budget_id UUID NOT NULL REFERENCES department_budgets(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    total_points DECIMAL(15, 2) NOT NULL DEFAULT 0,
    spent_points DECIMAL(15, 2) NOT NULL DEFAULT 0,
    remaining_points DECIMAL(15, 2) GENERATED ALWAYS AS (total_points - spent_points) STORED,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'closed')),
    expiry_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(department_budget_id, user_id)
);

-- =====================================================
-- WALLET & LEDGER TABLES
-- =====================================================

-- Wallets (One per user)
CREATE TABLE wallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    balance DECIMAL(15, 2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
    lifetime_earned DECIMAL(15, 2) NOT NULL DEFAULT 0,
    lifetime_spent DECIMAL(15, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Wallet Ledger (Immutable transaction log)
CREATE TABLE wallet_ledger (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
    transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('credit', 'debit')),
    source VARCHAR(50) NOT NULL CHECK (source IN ('hr_allocation', 'recognition', 'redemption', 'adjustment', 'expiry', 'reversal')),
    points DECIMAL(15, 2) NOT NULL,
    balance_after DECIMAL(15, 2) NOT NULL,
    reference_type VARCHAR(50),
    reference_id UUID,
    description TEXT,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Master Budget Ledger (Tenant-level pool)
CREATE TABLE master_budget_ledger (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('credit', 'debit')),
    source VARCHAR(50) NOT NULL,
    points DECIMAL(15, 2) NOT NULL,
    balance_after DECIMAL(15, 2) NOT NULL,
    reference_type VARCHAR(50),
    reference_id UUID,
    description TEXT,
    created_by UUID REFERENCES users(id),    created_by_type VARCHAR(20) DEFAULT 'user',    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for ledger queries
CREATE INDEX idx_wallet_ledger_wallet_id ON wallet_ledger(wallet_id);
CREATE INDEX idx_wallet_ledger_created_at ON wallet_ledger(created_at);

-- =====================================================
-- RECOGNITION & SOCIAL TABLES
-- =====================================================

-- Badges/Award Types
CREATE TABLE badges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    icon_url VARCHAR(500),
    points_value DECIMAL(15, 2) DEFAULT 0,
    is_system BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Recognitions
CREATE TABLE recognitions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    from_user_id UUID NOT NULL REFERENCES users(id),
    to_user_id UUID NOT NULL REFERENCES users(id),
    badge_id UUID REFERENCES badges(id),
    points DECIMAL(15, 2) NOT NULL DEFAULT 0,
    message TEXT NOT NULL,
    visibility VARCHAR(20) DEFAULT 'public' CHECK (visibility IN ('public', 'private', 'department')),
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('pending', 'active', 'rejected', 'revoked')),
    department_budget_id UUID REFERENCES department_budgets(id),
    lead_budget_id UUID REFERENCES lead_budgets(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Recognition Comments
CREATE TABLE recognition_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recognition_id UUID NOT NULL REFERENCES recognitions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Recognition Reactions (Likes, etc.)
CREATE TABLE recognition_reactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recognition_id UUID NOT NULL REFERENCES recognitions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    reaction_type VARCHAR(20) DEFAULT 'like',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(recognition_id, user_id, reaction_type)
);

-- Social Feed
CREATE TABLE feed (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL CHECK (event_type IN ('recognition', 'redemption', 'milestone', 'birthday', 'anniversary', 'achievement')),
    reference_type VARCHAR(50),
    reference_id UUID,
    actor_id UUID REFERENCES users(id),
    target_id UUID REFERENCES users(id),
    visibility VARCHAR(20) DEFAULT 'public',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_feed_tenant_created ON feed(tenant_id, created_at DESC);

-- =====================================================
-- REWARDS CATALOG & REDEMPTION TABLES
-- =====================================================

-- Brands
CREATE TABLE brands (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    logo_url VARCHAR(500),
    category VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Vouchers/Rewards
CREATE TABLE vouchers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    denomination DECIMAL(15, 2) NOT NULL,
    points_required DECIMAL(15, 2) NOT NULL,
    copay_amount DECIMAL(15, 2) DEFAULT 0,
    image_url VARCHAR(500),
    terms_conditions TEXT,
    validity_days INTEGER DEFAULT 365,
    is_active BOOLEAN DEFAULT TRUE,
    stock_quantity INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tenant Voucher Settings (Which vouchers available to which tenant)
CREATE TABLE tenant_vouchers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    voucher_id UUID NOT NULL REFERENCES vouchers(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT TRUE,
    custom_points_required DECIMAL(15, 2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(tenant_id, voucher_id)
);

-- Redemptions
CREATE TABLE redemptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    voucher_id UUID NOT NULL REFERENCES vouchers(id),
    points_used DECIMAL(15, 2) NOT NULL,
    copay_amount DECIMAL(15, 2) DEFAULT 0,
    voucher_code VARCHAR(255),
    voucher_pin VARCHAR(100),
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled', 'expired')),
    provider_reference VARCHAR(255),
    fulfilled_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- AUDIT & COMPLIANCE TABLES
-- =====================================================

-- Audit Log (Immutable)
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id),
    actor_id UUID,
    actor_type VARCHAR(20) DEFAULT 'user',
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100),
    entity_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_audit_log_tenant ON audit_log(tenant_id, created_at DESC);
CREATE INDEX idx_audit_log_actor ON audit_log(actor_id, created_at DESC);

-- =====================================================
-- NOTIFICATIONS TABLE
-- =====================================================

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT,
    reference_type VARCHAR(50),
    reference_id UUID,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id, is_read, created_at DESC);

-- =====================================================
-- EVENTS & LOGISTICS TABLES
-- =====================================================

-- Events
CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(50) NOT NULL,
    start_datetime TIMESTAMP WITH TIME ZONE NOT NULL,
    end_datetime TIMESTAMP WITH TIME ZONE NOT NULL,
    venue VARCHAR(500),
    location VARCHAR(500),
    format VARCHAR(50) DEFAULT 'onsite',
    status VARCHAR(50) DEFAULT 'draft',
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

CREATE INDEX idx_events_tenant ON events(tenant_id, status, start_datetime);

-- Event Activities
CREATE TABLE event_activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL,
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

-- Event Participants
CREATE TABLE event_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'checked_in', 'completed')),
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    checked_in_at TIMESTAMP WITH TIME ZONE,
    checked_in_by UUID REFERENCES users(id),
    custom_field_responses JSONB DEFAULT '{}',
    registered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(event_id, user_id)
);

CREATE INDEX idx_event_participants ON event_participants(event_id, status);

-- Activity Participants
CREATE TABLE activity_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    activity_id UUID NOT NULL REFERENCES event_activities(id) ON DELETE CASCADE,
    event_participant_id UUID NOT NULL REFERENCES event_participants(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'registered' CHECK (status IN ('registered', 'attended', 'no_show')),
    checked_in_at TIMESTAMP WITH TIME ZONE,
    points_awarded DECIMAL(15, 2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Event Budgets
CREATE TABLE event_budgets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE UNIQUE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    planned_budget DECIMAL(15, 2) NOT NULL,
    actual_spend DECIMAL(15, 2) DEFAULT 0,
    committed_spend DECIMAL(15, 2) DEFAULT 0,
    budget_breakdown JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Event Metrics
CREATE TABLE event_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE UNIQUE,
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
    computed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Event Gift Items
CREATE TABLE event_gift_batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    gift_name VARCHAR(255) NOT NULL,
    gift_type VARCHAR(50) NOT NULL,
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

-- Event Gift Redemptions
CREATE TABLE event_gift_redemptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    gift_batch_id UUID NOT NULL REFERENCES event_gift_batches(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    redemption_date TIMESTAMP WITH TIME ZONE,
    location VARCHAR(500),
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Event Teams (for group activities)
CREATE TABLE event_teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    activity_id UUID NOT NULL REFERENCES event_activities(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    team_name VARCHAR(255) NOT NULL,
    leader_user_id UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Event Team Members
CREATE TABLE event_team_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID NOT NULL REFERENCES event_teams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Event Nominations
CREATE TABLE event_nominations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    activity_id UUID NOT NULL REFERENCES event_activities(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    nominee_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    team_id UUID REFERENCES event_teams(id) ON DELETE SET NULL,
    created_by UUID REFERENCES users(id),
    status VARCHAR(50) DEFAULT 'pending',
    performance_title VARCHAR(255),
    notes TEXT,
    preferred_slot VARCHAR(100),
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- ANALYTICS TABLES
-- =====================================================

-- Tenant Analytics (Pre-computed metrics)
CREATE TABLE tenant_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    period_type VARCHAR(20) NOT NULL CHECK (period_type IN ('daily', 'weekly', 'monthly', 'quarterly')),
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    active_users INTEGER DEFAULT 0,
    recognitions_given INTEGER DEFAULT 0,
    recognitions_received INTEGER DEFAULT 0,
    points_distributed DECIMAL(15, 2) DEFAULT 0,
    points_redeemed DECIMAL(15, 2) DEFAULT 0,
    budget_utilization_rate DECIMAL(5, 2) DEFAULT 0,
    budget_burn_rate DECIMAL(15, 2) DEFAULT 0,
    engagement_score DECIMAL(5, 2) DEFAULT 0,
    participation_rate DECIMAL(5, 2) DEFAULT 0,
    department_metrics JSONB DEFAULT '{}',
    top_recognizers JSONB DEFAULT '[]',
    top_recipients JSONB DEFAULT '[]',
    computed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(tenant_id, period_type, period_start)
);

CREATE INDEX idx_tenant_analytics ON tenant_analytics(tenant_id, period_type, period_start);

-- Platform Metrics (Platform Admin view)
CREATE TABLE platform_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    period_type VARCHAR(20) NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    total_tenants INTEGER DEFAULT 0,
    active_tenants INTEGER DEFAULT 0,
    new_tenants INTEGER DEFAULT 0,
    churned_tenants INTEGER DEFAULT 0,
    total_users INTEGER DEFAULT 0,
    active_users INTEGER DEFAULT 0,
    new_users INTEGER DEFAULT 0,
    total_recognitions INTEGER DEFAULT 0,
    total_points_distributed DECIMAL(15, 2) DEFAULT 0,
    total_redemptions INTEGER DEFAULT 0,
    total_redemption_value DECIMAL(15, 2) DEFAULT 0,
    mrr DECIMAL(15, 2) DEFAULT 0,
    arr DECIMAL(15, 2) DEFAULT 0,
    tier_breakdown JSONB DEFAULT '{}',
    tenant_benchmarks JSONB DEFAULT '[]',
    computed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- SEED DATA
-- =====================================================

-- Insert default badges (using emoji icons for display)
INSERT INTO badges (name, description, icon_url, points_value, is_system) VALUES
('Star Performer', 'Outstanding performance recognition', '⭐', 100, TRUE),
('Team Player', 'Excellent collaboration and teamwork', '🤝', 75, TRUE),
('Innovation Champion', 'Creative problem solving', '💡', 150, TRUE),
('Customer Hero', 'Exceptional customer service', '🦸', 100, TRUE),
('Quick Learner', 'Fast skill acquisition', '📚', 50, TRUE),
('Mentor', 'Helping others grow', '🎓', 100, TRUE),
('Above & Beyond', 'Going the extra mile', '🚀', 125, TRUE),
('Problem Solver', 'Finding solutions to challenges', '🔧', 75, TRUE);

-- Insert sample brands (using emoji icons for display)
INSERT INTO brands (name, description, logo_url, category) VALUES
('Amazon', 'World''s largest online retailer', '📦', 'Shopping'),
('Starbucks', 'Premium coffee and beverages', '☕', 'Food & Beverage'),
('Netflix', 'Streaming entertainment service', '🎬', 'Entertainment'),
('Uber', 'Ride-sharing and food delivery', '🚗', 'Transportation'),
('Spotify', 'Music streaming platform', '🎵', 'Entertainment'),
('Apple', 'Consumer electronics and services', '🍎', 'Technology'),
('Nike', 'Athletic footwear and apparel', '👟', 'Sports & Fashion'),
('Target', 'Retail department store', '🎯', 'Shopping');

-- Insert sample vouchers
INSERT INTO vouchers (brand_id, name, description, denomination, points_required, copay_amount, validity_days) VALUES
((SELECT id FROM brands WHERE name = 'Amazon'), 'Amazon Gift Card ₹25', 'Redeemable on Amazon.com', 25.00, 250, 0, 365),
((SELECT id FROM brands WHERE name = 'Amazon'), 'Amazon Gift Card ₹50', 'Redeemable on Amazon.com', 50.00, 500, 0, 365),
((SELECT id FROM brands WHERE name = 'Amazon'), 'Amazon Gift Card ₹100', 'Redeemable on Amazon.com', 100.00, 1000, 0, 365),
((SELECT id FROM brands WHERE name = 'Starbucks'), 'Starbucks Card ₹10', 'Valid at all Starbucks locations', 10.00, 100, 0, 180),
((SELECT id FROM brands WHERE name = 'Starbucks'), 'Starbucks Card ₹25', 'Valid at all Starbucks locations', 25.00, 250, 0, 180),
((SELECT id FROM brands WHERE name = 'Netflix'), 'Netflix 1 Month', 'One month standard subscription', 15.99, 160, 0, 90),
((SELECT id FROM brands WHERE name = 'Netflix'), 'Netflix 3 Months', 'Three months standard subscription', 47.97, 450, 0, 90),
((SELECT id FROM brands WHERE name = 'Uber'), 'Uber Credit ₹15', 'Valid for rides or Uber Eats', 15.00, 150, 0, 180),
((SELECT id FROM brands WHERE name = 'Uber'), 'Uber Credit ₹30', 'Valid for rides or Uber Eats', 30.00, 300, 0, 180),
((SELECT id FROM brands WHERE name = 'Spotify'), 'Spotify 1 Month Premium', 'Ad-free music streaming', 10.99, 110, 0, 60),
((SELECT id FROM brands WHERE name = 'Apple'), 'Apple Gift Card ₹25', 'For App Store, iTunes, and more', 25.00, 250, 0, 365),
((SELECT id FROM brands WHERE name = 'Apple'), 'Apple Gift Card ₹50', 'For App Store, iTunes, and more', 50.00, 500, 0, 365),
((SELECT id FROM brands WHERE name = 'Nike'), 'Nike Gift Card ₹50', 'Valid online and in-store', 50.00, 500, 0, 365),
((SELECT id FROM brands WHERE name = 'Target'), 'Target GiftCard ₹25', 'Valid at Target stores and Target.com', 25.00, 250, 0, 365),
((SELECT id FROM brands WHERE name = 'Target'), 'Target GiftCard ₹50', 'Valid at Target stores and Target.com', 50.00, 500, 0, 365);

-- Insert demo tenant
INSERT INTO tenants (id, name, domain, status) VALUES
('550e8400-e29b-41d4-a716-446655440000', 'Demo Company', 'demo.sparknode.com', 'active');

-- Insert root tenant (jSpark)
INSERT INTO tenants (id, name, slug, domain, status, subscription_tier, master_budget_balance) VALUES
('100e8400-e29b-41d4-a716-446655440000', 'jSpark', 'jspark', 'jspark.sparknode.io', 'active', 'enterprise', 0);

-- Insert default tenant scope (All Tenants)
INSERT INTO tenants (id, name, slug, domain, status, subscription_tier, master_budget_balance) VALUES
('100e8400-e29b-41d4-a716-446655440001', 'All Tenants', 'all-tenants', NULL, 'active', 'enterprise', 0);

-- Insert additional tenants
INSERT INTO tenants (id, name, slug, domain, status, subscription_tier, master_budget_balance) VALUES
('100e8400-e29b-41d4-a716-446655440010', 'Triton', 'triton', 'triton.sparknode.io', 'active', 'professional', 0),
('100e8400-e29b-41d4-a716-446655440011', 'Uniplane', 'uniplane', 'uniplane.sparknode.io', 'active', 'starter', 0),
('100e8400-e29b-41d4-a716-446655440012', 'Zebra', 'zebra', 'zebra.sparknode.io', 'active', 'starter', 0);

-- Insert root tenant department
