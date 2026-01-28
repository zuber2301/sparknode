-- SparkNode Database Initialization Script
-- Multi-tenant Employee Rewards & Recognition Platform

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- TENANT & IDENTITY TABLES
-- =====================================================

-- Tenants (Companies)
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    domain VARCHAR(255) UNIQUE,
    logo_url VARCHAR(500),
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Departments
CREATE TABLE departments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    parent_id UUID REFERENCES departments(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(tenant_id, name)
);

-- Users
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('platform_admin', 'hr_admin', 'manager', 'employee')),
    department_id UUID REFERENCES departments(id),
    manager_id UUID REFERENCES users(id),
    avatar_url VARCHAR(500),
    date_of_birth DATE,
    hire_date DATE,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(tenant_id, email)
);

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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(budget_id, department_id)
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
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
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
    actor_id UUID REFERENCES users(id),
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
-- SEED DATA
-- =====================================================

-- Insert default badges
INSERT INTO badges (name, description, icon_url, points_value, is_system) VALUES
('Star Performer', 'Outstanding performance recognition', '/badges/star.svg', 100, TRUE),
('Team Player', 'Excellent collaboration and teamwork', '/badges/team.svg', 75, TRUE),
('Innovation Champion', 'Creative problem solving', '/badges/innovation.svg', 150, TRUE),
('Customer Hero', 'Exceptional customer service', '/badges/customer.svg', 100, TRUE),
('Quick Learner', 'Fast skill acquisition', '/badges/learning.svg', 50, TRUE),
('Mentor', 'Helping others grow', '/badges/mentor.svg', 100, TRUE),
('Above & Beyond', 'Going the extra mile', '/badges/beyond.svg', 125, TRUE),
('Problem Solver', 'Finding solutions to challenges', '/badges/solver.svg', 75, TRUE);

-- Insert sample brands
INSERT INTO brands (name, description, logo_url, category) VALUES
('Amazon', 'World''s largest online retailer', '/brands/amazon.svg', 'Shopping'),
('Starbucks', 'Premium coffee and beverages', '/brands/starbucks.svg', 'Food & Beverage'),
('Netflix', 'Streaming entertainment service', '/brands/netflix.svg', 'Entertainment'),
('Uber', 'Ride-sharing and food delivery', '/brands/uber.svg', 'Transportation'),
('Spotify', 'Music streaming platform', '/brands/spotify.svg', 'Entertainment'),
('Apple', 'Consumer electronics and services', '/brands/apple.svg', 'Technology'),
('Nike', 'Athletic footwear and apparel', '/brands/nike.svg', 'Sports & Fashion'),
('Target', 'Retail department store', '/brands/target.svg', 'Shopping');

-- Insert sample vouchers
INSERT INTO vouchers (brand_id, name, description, denomination, points_required, copay_amount, validity_days) VALUES
((SELECT id FROM brands WHERE name = 'Amazon'), 'Amazon Gift Card $25', 'Redeemable on Amazon.com', 25.00, 250, 0, 365),
((SELECT id FROM brands WHERE name = 'Amazon'), 'Amazon Gift Card $50', 'Redeemable on Amazon.com', 50.00, 500, 0, 365),
((SELECT id FROM brands WHERE name = 'Amazon'), 'Amazon Gift Card $100', 'Redeemable on Amazon.com', 100.00, 1000, 0, 365),
((SELECT id FROM brands WHERE name = 'Starbucks'), 'Starbucks Card $10', 'Valid at all Starbucks locations', 10.00, 100, 0, 180),
((SELECT id FROM brands WHERE name = 'Starbucks'), 'Starbucks Card $25', 'Valid at all Starbucks locations', 25.00, 250, 0, 180),
((SELECT id FROM brands WHERE name = 'Netflix'), 'Netflix 1 Month', 'One month standard subscription', 15.99, 160, 0, 90),
((SELECT id FROM brands WHERE name = 'Netflix'), 'Netflix 3 Months', 'Three months standard subscription', 47.97, 450, 0, 90),
((SELECT id FROM brands WHERE name = 'Uber'), 'Uber Credit $15', 'Valid for rides or Uber Eats', 15.00, 150, 0, 180),
((SELECT id FROM brands WHERE name = 'Uber'), 'Uber Credit $30', 'Valid for rides or Uber Eats', 30.00, 300, 0, 180),
((SELECT id FROM brands WHERE name = 'Spotify'), 'Spotify 1 Month Premium', 'Ad-free music streaming', 10.99, 110, 0, 60),
((SELECT id FROM brands WHERE name = 'Apple'), 'Apple Gift Card $25', 'For App Store, iTunes, and more', 25.00, 250, 0, 365),
((SELECT id FROM brands WHERE name = 'Apple'), 'Apple Gift Card $50', 'For App Store, iTunes, and more', 50.00, 500, 0, 365),
((SELECT id FROM brands WHERE name = 'Nike'), 'Nike Gift Card $50', 'Valid online and in-store', 50.00, 500, 0, 365),
((SELECT id FROM brands WHERE name = 'Target'), 'Target GiftCard $25', 'Valid at Target stores and Target.com', 25.00, 250, 0, 365),
((SELECT id FROM brands WHERE name = 'Target'), 'Target GiftCard $50', 'Valid at Target stores and Target.com', 50.00, 500, 0, 365);

-- Insert demo tenant
INSERT INTO tenants (id, name, domain, status) VALUES
('550e8400-e29b-41d4-a716-446655440000', 'Demo Company', 'demo.perksu.com', 'active');

-- Insert demo departments
INSERT INTO departments (id, tenant_id, name) VALUES
('660e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440000', 'Engineering'),
('660e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440000', 'Marketing'),
('660e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440000', 'Sales'),
('660e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440000', 'Human Resources'),
('660e8400-e29b-41d4-a716-446655440005', '550e8400-e29b-41d4-a716-446655440000', 'Finance');

-- Insert demo users (password is 'password123' for all)
-- Hash: $2b$12$LioEPbbh3tSOF5x/gIBHT.L7pviNt5hvDx8ml.S/v.f6pctz9gYG2
INSERT INTO users (id, tenant_id, email, password_hash, first_name, last_name, role, department_id) VALUES
('770e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440000', 'admin@demo.com', '$2b$12$LioEPbbh3tSOF5x/gIBHT.L7pviNt5hvDx8ml.S/v.f6pctz9gYG2', 'Admin', 'User', 'hr_admin', '660e8400-e29b-41d4-a716-446655440004'),
('770e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440000', 'manager@demo.com', '$2b$12$LioEPbbh3tSOF5x/gIBHT.L7pviNt5hvDx8ml.S/v.f6pctz9gYG2', 'John', 'Manager', 'manager', '660e8400-e29b-41d4-a716-446655440001'),
('770e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440000', 'employee@demo.com', '$2b$12$LioEPbbh3tSOF5x/gIBHT.L7pviNt5hvDx8ml.S/v.f6pctz9gYG2', 'Jane', 'Employee', 'employee', '660e8400-e29b-41d4-a716-446655440001'),
('770e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440000', 'sarah@demo.com', '$2b$12$LioEPbbh3tSOF5x/gIBHT.L7pviNt5hvDx8ml.S/v.f6pctz9gYG2', 'Sarah', 'Wilson', 'employee', '660e8400-e29b-41d4-a716-446655440002'),
('770e8400-e29b-41d4-a716-446655440005', '550e8400-e29b-41d4-a716-446655440000', 'mike@demo.com', '$2b$12$LioEPbbh3tSOF5x/gIBHT.L7pviNt5hvDx8ml.S/v.f6pctz9gYG2', 'Mike', 'Johnson', 'manager', '660e8400-e29b-41d4-a716-446655440003');

-- Update manager relationships
UPDATE users SET manager_id = '770e8400-e29b-41d4-a716-446655440002' WHERE id = '770e8400-e29b-41d4-a716-446655440003';
UPDATE users SET manager_id = '770e8400-e29b-41d4-a716-446655440001' WHERE id IN ('770e8400-e29b-41d4-a716-446655440002', '770e8400-e29b-41d4-a716-446655440005');

-- Create wallets for demo users
INSERT INTO wallets (tenant_id, user_id, balance, lifetime_earned, lifetime_spent) VALUES
('550e8400-e29b-41d4-a716-446655440000', '770e8400-e29b-41d4-a716-446655440001', 500, 500, 0),
('550e8400-e29b-41d4-a716-446655440000', '770e8400-e29b-41d4-a716-446655440002', 1000, 1500, 500),
('550e8400-e29b-41d4-a716-446655440000', '770e8400-e29b-41d4-a716-446655440003', 750, 1000, 250),
('550e8400-e29b-41d4-a716-446655440000', '770e8400-e29b-41d4-a716-446655440004', 300, 400, 100),
('550e8400-e29b-41d4-a716-446655440000', '770e8400-e29b-41d4-a716-446655440005', 850, 1200, 350);

-- Create demo budget
INSERT INTO budgets (id, tenant_id, name, fiscal_year, total_points, allocated_points, status, created_by) VALUES
('880e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440000', 'FY 2026 Q1 Budget', 2026, 100000, 25000, 'active', '770e8400-e29b-41d4-a716-446655440001');

-- Create department budgets
INSERT INTO department_budgets (tenant_id, budget_id, department_id, allocated_points, spent_points, monthly_cap) VALUES
('550e8400-e29b-41d4-a716-446655440000', '880e8400-e29b-41d4-a716-446655440001', '660e8400-e29b-41d4-a716-446655440001', 10000, 2500, 5000),
('550e8400-e29b-41d4-a716-446655440000', '880e8400-e29b-41d4-a716-446655440001', '660e8400-e29b-41d4-a716-446655440002', 5000, 1000, 2500),
('550e8400-e29b-41d4-a716-446655440000', '880e8400-e29b-41d4-a716-446655440001', '660e8400-e29b-41d4-a716-446655440003', 6000, 1500, 3000),
('550e8400-e29b-41d4-a716-446655440000', '880e8400-e29b-41d4-a716-446655440001', '660e8400-e29b-41d4-a716-446655440004', 2000, 500, 1000),
('550e8400-e29b-41d4-a716-446655440000', '880e8400-e29b-41d4-a716-446655440001', '660e8400-e29b-41d4-a716-446655440005', 2000, 500, 1000);

-- Enable vouchers for demo tenant
INSERT INTO tenant_vouchers (tenant_id, voucher_id, is_active)
SELECT '550e8400-e29b-41d4-a716-446655440000', id, TRUE FROM vouchers;

-- Create some sample recognitions
INSERT INTO recognitions (tenant_id, from_user_id, to_user_id, badge_id, points, message, visibility, status) VALUES
('550e8400-e29b-41d4-a716-446655440000', '770e8400-e29b-41d4-a716-446655440002', '770e8400-e29b-41d4-a716-446655440003', (SELECT id FROM badges WHERE name = 'Star Performer'), 100, 'Amazing work on the Q4 project delivery! Your dedication and attention to detail made all the difference.', 'public', 'active'),
('550e8400-e29b-41d4-a716-446655440000', '770e8400-e29b-41d4-a716-446655440001', '770e8400-e29b-41d4-a716-446655440002', (SELECT id FROM badges WHERE name = 'Team Player'), 75, 'Thank you for stepping up and helping the new team members get onboarded smoothly.', 'public', 'active'),
('550e8400-e29b-41d4-a716-446655440000', '770e8400-e29b-41d4-a716-446655440005', '770e8400-e29b-41d4-a716-446655440004', (SELECT id FROM badges WHERE name = 'Innovation Champion'), 150, 'Your creative marketing campaign idea was brilliant! It exceeded our expectations.', 'public', 'active');

-- Create feed entries for recognitions
INSERT INTO feed (tenant_id, event_type, reference_type, reference_id, actor_id, target_id, visibility, metadata)
SELECT 
    tenant_id,
    'recognition',
    'recognition',
    id,
    from_user_id,
    to_user_id,
    visibility,
    jsonb_build_object('points', points, 'message', message)
FROM recognitions;

COMMIT;
