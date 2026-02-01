--
-- PostgreSQL database dump
--

\restrict rM8JVybakE3IWXOaTezYuhEZCQnh90NB3Os4XEfItYIqHxc0hZfUXNrbm7tcIed

-- Dumped from database version 15.15
-- Dumped by pg_dump version 15.15

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: activity_participants; Type: TABLE; Schema: public; Owner: sparknode
--

CREATE TABLE public.activity_participants (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    activity_id uuid NOT NULL,
    event_participant_id uuid NOT NULL,
    status character varying(50) DEFAULT 'registered'::character varying,
    checked_in_at timestamp with time zone,
    points_awarded numeric(15,2) DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT activity_participants_status_check CHECK (((status)::text = ANY ((ARRAY['registered'::character varying, 'attended'::character varying, 'no_show'::character varying])::text[])))
);


ALTER TABLE public.activity_participants OWNER TO sparknode;

--
-- Name: audit_log; Type: TABLE; Schema: public; Owner: sparknode
--

CREATE TABLE public.audit_log (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    actor_id uuid,
    actor_type character varying(20) DEFAULT 'user'::character varying,
    action character varying(100) NOT NULL,
    entity_type character varying(100),
    entity_id uuid,
    old_values jsonb,
    new_values jsonb,
    ip_address character varying(45),
    user_agent text,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.audit_log OWNER TO sparknode;

--
-- Name: badges; Type: TABLE; Schema: public; Owner: sparknode
--

CREATE TABLE public.badges (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    name character varying(100) NOT NULL,
    description text,
    icon_url character varying(500),
    points_value numeric(15,2) DEFAULT 0,
    is_system boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.badges OWNER TO sparknode;

--
-- Name: brands; Type: TABLE; Schema: public; Owner: sparknode
--

CREATE TABLE public.brands (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    logo_url character varying(500),
    category character varying(100),
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.brands OWNER TO sparknode;

--
-- Name: budgets; Type: TABLE; Schema: public; Owner: sparknode
--

CREATE TABLE public.budgets (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    fiscal_year integer NOT NULL,
    fiscal_quarter integer,
    total_points numeric(15,2) DEFAULT 0 NOT NULL,
    allocated_points numeric(15,2) DEFAULT 0 NOT NULL,
    remaining_points numeric(15,2) GENERATED ALWAYS AS ((total_points - allocated_points)) STORED,
    status character varying(50) DEFAULT 'active'::character varying,
    expiry_date date,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT budgets_fiscal_quarter_check CHECK ((fiscal_quarter = ANY (ARRAY[1, 2, 3, 4]))),
    CONSTRAINT budgets_status_check CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'active'::character varying, 'closed'::character varying])::text[])))
);


ALTER TABLE public.budgets OWNER TO sparknode;

--
-- Name: department_budgets; Type: TABLE; Schema: public; Owner: sparknode
--

CREATE TABLE public.department_budgets (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    budget_id uuid NOT NULL,
    department_id uuid NOT NULL,
    allocated_points numeric(15,2) DEFAULT 0 NOT NULL,
    spent_points numeric(15,2) DEFAULT 0 NOT NULL,
    remaining_points numeric(15,2) GENERATED ALWAYS AS ((allocated_points - spent_points)) STORED,
    monthly_cap numeric(15,2),
    expiry_date date,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.department_budgets OWNER TO sparknode;

--
-- Name: departments; Type: TABLE; Schema: public; Owner: sparknode
--

CREATE TABLE public.departments (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    parent_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT departments_name_check CHECK (((name)::text = ANY ((ARRAY['Human Resource (HR)'::character varying, 'Techology (IT)'::character varying, 'Sale & Marketting'::character varying, 'Business Unit -1'::character varying, 'Business Unit-2'::character varying, 'Business Unit-3'::character varying])::text[])))
);


ALTER TABLE public.departments OWNER TO sparknode;

--
-- Name: event_activities; Type: TABLE; Schema: public; Owner: sparknode
--

CREATE TABLE public.event_activities (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    event_id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    category character varying(50) NOT NULL,
    max_participants integer,
    max_teams integer,
    min_team_size integer DEFAULT 1,
    max_team_size integer,
    nomination_start timestamp with time zone,
    nomination_end timestamp with time zone,
    activity_start timestamp with time zone,
    activity_end timestamp with time zone,
    requires_approval boolean DEFAULT false,
    allow_multiple_teams boolean DEFAULT false,
    rules_text text,
    sequence integer,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.event_activities OWNER TO sparknode;

--
-- Name: event_budgets; Type: TABLE; Schema: public; Owner: sparknode
--

CREATE TABLE public.event_budgets (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    event_id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    planned_budget numeric(15,2) NOT NULL,
    actual_spend numeric(15,2) DEFAULT 0,
    committed_spend numeric(15,2) DEFAULT 0,
    budget_breakdown jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.event_budgets OWNER TO sparknode;

--
-- Name: event_gift_batches; Type: TABLE; Schema: public; Owner: sparknode
--

CREATE TABLE public.event_gift_batches (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    event_id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    gift_name character varying(255) NOT NULL,
    gift_type character varying(50) NOT NULL,
    description text,
    quantity integer NOT NULL,
    unit_value numeric(10,2) NOT NULL,
    eligible_criteria jsonb DEFAULT '{}'::jsonb,
    distribution_start timestamp with time zone,
    distribution_end timestamp with time zone,
    distribution_locations jsonb DEFAULT '[]'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.event_gift_batches OWNER TO sparknode;

--
-- Name: event_gift_redemptions; Type: TABLE; Schema: public; Owner: sparknode
--

CREATE TABLE public.event_gift_redemptions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    event_id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    gift_batch_id uuid NOT NULL,
    user_id uuid NOT NULL,
    redemption_date timestamp with time zone,
    location character varying(500),
    status character varying(50) DEFAULT 'pending'::character varying,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.event_gift_redemptions OWNER TO sparknode;

--
-- Name: event_metrics; Type: TABLE; Schema: public; Owner: sparknode
--

CREATE TABLE public.event_metrics (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    event_id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    total_invited integer DEFAULT 0,
    total_registered integer DEFAULT 0,
    total_participated integer DEFAULT 0,
    no_shows integer DEFAULT 0,
    activity_metrics jsonb DEFAULT '{}'::jsonb,
    gifts_eligible integer DEFAULT 0,
    gifts_issued integer DEFAULT 0,
    gifts_redeemed integer DEFAULT 0,
    department_metrics jsonb DEFAULT '{}'::jsonb,
    computed_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.event_metrics OWNER TO sparknode;

--
-- Name: event_nominations; Type: TABLE; Schema: public; Owner: sparknode
--

CREATE TABLE public.event_nominations (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    event_id uuid NOT NULL,
    activity_id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    nominee_user_id uuid NOT NULL,
    team_id uuid,
    created_by uuid,
    status character varying(50) DEFAULT 'pending'::character varying,
    performance_title character varying(255),
    notes text,
    preferred_slot character varying(100),
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.event_nominations OWNER TO sparknode;

--
-- Name: event_participants; Type: TABLE; Schema: public; Owner: sparknode
--

CREATE TABLE public.event_participants (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    event_id uuid NOT NULL,
    user_id uuid NOT NULL,
    status character varying(50) DEFAULT 'pending'::character varying,
    approved_by uuid,
    approved_at timestamp with time zone,
    rejection_reason text,
    checked_in_at timestamp with time zone,
    checked_in_by uuid,
    custom_field_responses jsonb DEFAULT '{}'::jsonb,
    registered_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT event_participants_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'approved'::character varying, 'rejected'::character varying, 'checked_in'::character varying, 'completed'::character varying])::text[])))
);


ALTER TABLE public.event_participants OWNER TO sparknode;

--
-- Name: event_team_members; Type: TABLE; Schema: public; Owner: sparknode
--

CREATE TABLE public.event_team_members (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    team_id uuid NOT NULL,
    user_id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.event_team_members OWNER TO sparknode;

--
-- Name: event_teams; Type: TABLE; Schema: public; Owner: sparknode
--

CREATE TABLE public.event_teams (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    event_id uuid NOT NULL,
    activity_id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    team_name character varying(255) NOT NULL,
    leader_user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.event_teams OWNER TO sparknode;

--
-- Name: events; Type: TABLE; Schema: public; Owner: sparknode
--

CREATE TABLE public.events (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    type character varying(50) NOT NULL,
    start_datetime timestamp with time zone NOT NULL,
    end_datetime timestamp with time zone NOT NULL,
    venue character varying(500),
    location character varying(500),
    format character varying(50) DEFAULT 'onsite'::character varying,
    status character varying(50) DEFAULT 'draft'::character varying,
    visibility character varying(50) DEFAULT 'all_employees'::character varying,
    visible_to_departments jsonb DEFAULT '[]'::jsonb,
    banner_url character varying(500),
    color_code character varying(20) DEFAULT '#3B82F6'::character varying,
    nomination_start timestamp with time zone,
    nomination_end timestamp with time zone,
    who_can_nominate character varying(50) DEFAULT 'all_employees'::character varying,
    max_activities_per_person integer DEFAULT 5,
    planned_budget numeric(15,2) DEFAULT 0,
    currency character varying(10) DEFAULT 'USD'::character varying,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.events OWNER TO sparknode;

--
-- Name: feed; Type: TABLE; Schema: public; Owner: sparknode
--

CREATE TABLE public.feed (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    event_type character varying(50) NOT NULL,
    reference_type character varying(50),
    reference_id uuid,
    actor_id uuid,
    target_id uuid,
    visibility character varying(20) DEFAULT 'public'::character varying,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT feed_event_type_check CHECK (((event_type)::text = ANY ((ARRAY['recognition'::character varying, 'redemption'::character varying, 'milestone'::character varying, 'birthday'::character varying, 'anniversary'::character varying, 'achievement'::character varying])::text[])))
);


ALTER TABLE public.feed OWNER TO sparknode;

--
-- Name: lead_budgets; Type: TABLE; Schema: public; Owner: sparknode
--

CREATE TABLE public.lead_budgets (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    department_budget_id uuid NOT NULL,
    user_id uuid NOT NULL,
    total_points numeric(15,2) DEFAULT 0 NOT NULL,
    spent_points numeric(15,2) DEFAULT 0 NOT NULL,
    remaining_points numeric(15,2) GENERATED ALWAYS AS ((total_points - spent_points)) STORED,
    status character varying(50) DEFAULT 'active'::character varying,
    expiry_date date,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT lead_budgets_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'inactive'::character varying, 'closed'::character varying])::text[])))
);


ALTER TABLE public.lead_budgets OWNER TO sparknode;

--
-- Name: master_budget_ledger; Type: TABLE; Schema: public; Owner: sparknode
--

CREATE TABLE public.master_budget_ledger (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    transaction_type character varying(20) NOT NULL,
    source character varying(50) NOT NULL,
    points numeric(15,2) NOT NULL,
    balance_after numeric(15,2) NOT NULL,
    reference_type character varying(50),
    reference_id uuid,
    description text,
    created_by uuid,
    created_by_type character varying(20) DEFAULT 'user'::character varying,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT master_budget_ledger_transaction_type_check CHECK (((transaction_type)::text = ANY ((ARRAY['credit'::character varying, 'debit'::character varying])::text[])))
);


ALTER TABLE public.master_budget_ledger OWNER TO sparknode;

--
-- Name: notifications; Type: TABLE; Schema: public; Owner: sparknode
--

CREATE TABLE public.notifications (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    user_id uuid NOT NULL,
    type character varying(50) NOT NULL,
    title character varying(255) NOT NULL,
    message text,
    reference_type character varying(50),
    reference_id uuid,
    is_read boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.notifications OWNER TO sparknode;

--
-- Name: otp_tokens; Type: TABLE; Schema: public; Owner: sparknode
--

CREATE TABLE public.otp_tokens (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    user_id uuid NOT NULL,
    channel character varying(20) NOT NULL,
    destination character varying(255) NOT NULL,
    token_hash character varying(255) NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT otp_tokens_channel_check CHECK (((channel)::text = ANY ((ARRAY['email'::character varying, 'sms'::character varying])::text[])))
);


ALTER TABLE public.otp_tokens OWNER TO sparknode;

--
-- Name: platform_metrics; Type: TABLE; Schema: public; Owner: sparknode
--

CREATE TABLE public.platform_metrics (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    period_type character varying(20) NOT NULL,
    period_start date NOT NULL,
    period_end date NOT NULL,
    total_tenants integer DEFAULT 0,
    active_tenants integer DEFAULT 0,
    new_tenants integer DEFAULT 0,
    churned_tenants integer DEFAULT 0,
    total_users integer DEFAULT 0,
    active_users integer DEFAULT 0,
    new_users integer DEFAULT 0,
    total_recognitions integer DEFAULT 0,
    total_points_distributed numeric(15,2) DEFAULT 0,
    total_redemptions integer DEFAULT 0,
    total_redemption_value numeric(15,2) DEFAULT 0,
    mrr numeric(15,2) DEFAULT 0,
    arr numeric(15,2) DEFAULT 0,
    tier_breakdown jsonb DEFAULT '{}'::jsonb,
    tenant_benchmarks jsonb DEFAULT '[]'::jsonb,
    computed_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.platform_metrics OWNER TO sparknode;

--
-- Name: recognition_comments; Type: TABLE; Schema: public; Owner: sparknode
--

CREATE TABLE public.recognition_comments (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    recognition_id uuid NOT NULL,
    user_id uuid NOT NULL,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.recognition_comments OWNER TO sparknode;

--
-- Name: recognition_reactions; Type: TABLE; Schema: public; Owner: sparknode
--

CREATE TABLE public.recognition_reactions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    recognition_id uuid NOT NULL,
    user_id uuid NOT NULL,
    reaction_type character varying(20) DEFAULT 'like'::character varying,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.recognition_reactions OWNER TO sparknode;

--
-- Name: recognitions; Type: TABLE; Schema: public; Owner: sparknode
--

CREATE TABLE public.recognitions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    from_user_id uuid NOT NULL,
    to_user_id uuid NOT NULL,
    badge_id uuid,
    points numeric(15,2) DEFAULT 0 NOT NULL,
    message text NOT NULL,
    visibility character varying(20) DEFAULT 'public'::character varying,
    status character varying(50) DEFAULT 'active'::character varying,
    department_budget_id uuid,
    lead_budget_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT recognitions_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'active'::character varying, 'rejected'::character varying, 'revoked'::character varying])::text[]))),
    CONSTRAINT recognitions_visibility_check CHECK (((visibility)::text = ANY ((ARRAY['public'::character varying, 'private'::character varying, 'department'::character varying])::text[])))
);


ALTER TABLE public.recognitions OWNER TO sparknode;

--
-- Name: redemptions; Type: TABLE; Schema: public; Owner: sparknode
--

CREATE TABLE public.redemptions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    user_id uuid NOT NULL,
    voucher_id uuid NOT NULL,
    points_used numeric(15,2) NOT NULL,
    copay_amount numeric(15,2) DEFAULT 0,
    voucher_code character varying(255),
    voucher_pin character varying(100),
    status character varying(50) DEFAULT 'pending'::character varying,
    provider_reference character varying(255),
    fulfilled_at timestamp with time zone,
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT redemptions_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'processing'::character varying, 'completed'::character varying, 'failed'::character varying, 'cancelled'::character varying, 'expired'::character varying])::text[])))
);


ALTER TABLE public.redemptions OWNER TO sparknode;

--
-- Name: system_admins; Type: TABLE; Schema: public; Owner: sparknode
--

CREATE TABLE public.system_admins (
    admin_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid,
    access_level character varying(20) DEFAULT 'PLATFORM_ADMIN'::character varying,
    mfa_enabled boolean DEFAULT true,
    last_login_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.system_admins OWNER TO sparknode;

--
-- Name: tenant_analytics; Type: TABLE; Schema: public; Owner: sparknode
--

CREATE TABLE public.tenant_analytics (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    period_type character varying(20) NOT NULL,
    period_start date NOT NULL,
    period_end date NOT NULL,
    active_users integer DEFAULT 0,
    recognitions_given integer DEFAULT 0,
    recognitions_received integer DEFAULT 0,
    points_distributed numeric(15,2) DEFAULT 0,
    points_redeemed numeric(15,2) DEFAULT 0,
    budget_utilization_rate numeric(5,2) DEFAULT 0,
    budget_burn_rate numeric(15,2) DEFAULT 0,
    engagement_score numeric(5,2) DEFAULT 0,
    participation_rate numeric(5,2) DEFAULT 0,
    department_metrics jsonb DEFAULT '{}'::jsonb,
    top_recognizers jsonb DEFAULT '[]'::jsonb,
    top_recipients jsonb DEFAULT '[]'::jsonb,
    computed_at timestamp with time zone DEFAULT now(),
    CONSTRAINT tenant_analytics_period_type_check CHECK (((period_type)::text = ANY ((ARRAY['daily'::character varying, 'weekly'::character varying, 'monthly'::character varying, 'quarterly'::character varying])::text[])))
);


ALTER TABLE public.tenant_analytics OWNER TO sparknode;

--
-- Name: tenant_vouchers; Type: TABLE; Schema: public; Owner: sparknode
--

CREATE TABLE public.tenant_vouchers (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    voucher_id uuid NOT NULL,
    is_active boolean DEFAULT true,
    custom_points_required numeric(15,2),
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.tenant_vouchers OWNER TO sparknode;

--
-- Name: tenants; Type: TABLE; Schema: public; Owner: sparknode
--

CREATE TABLE public.tenants (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(255) NOT NULL,
    slug character varying(255),
    domain character varying(255),
    logo_url character varying(500),
    favicon_url character varying(500),
    theme_config jsonb DEFAULT '{"font_family": "Inter", "primary_color": "#3B82F6", "secondary_color": "#8B5CF6"}'::jsonb,
    domain_whitelist jsonb DEFAULT '[]'::jsonb,
    auth_method character varying(50) DEFAULT 'PASSWORD_AND_OTP'::character varying,
    currency_label character varying(100) DEFAULT 'Points'::character varying,
    conversion_rate numeric(10,4) DEFAULT 1.0,
    auto_refill_threshold numeric(5,2) DEFAULT 20.0,
    award_tiers jsonb DEFAULT '{"Gold": 5000, "Bronze": 1000, "Silver": 2500}'::jsonb,
    peer_to_peer_enabled boolean DEFAULT true,
    expiry_policy character varying(50) DEFAULT 'NEVER'::character varying,
    status character varying(50) DEFAULT 'active'::character varying,
    subscription_tier character varying(50) DEFAULT 'starter'::character varying,
    subscription_status character varying(50) DEFAULT 'active'::character varying,
    subscription_started_at timestamp with time zone,
    subscription_ends_at timestamp with time zone,
    max_users integer DEFAULT 50,
    master_budget_balance numeric(15,2) DEFAULT 0 NOT NULL,
    settings jsonb DEFAULT '{"copay_enabled": false, "social_feed_enabled": true, "events_module_enabled": true, "peer_to_peer_recognition": true, "points_to_currency_ratio": 0.10}'::jsonb,
    feature_flags jsonb DEFAULT '{}'::jsonb,
    catalog_settings jsonb DEFAULT '{}'::jsonb,
    branding jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    branding_config jsonb DEFAULT '{}'::jsonb,
    CONSTRAINT tenants_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'inactive'::character varying, 'suspended'::character varying, 'trial'::character varying])::text[]))),
    CONSTRAINT tenants_subscription_status_check CHECK (((subscription_status)::text = ANY ((ARRAY['active'::character varying, 'past_due'::character varying, 'cancelled'::character varying])::text[]))),
    CONSTRAINT tenants_subscription_tier_check CHECK (((subscription_tier)::text = ANY ((ARRAY['free'::character varying, 'starter'::character varying, 'professional'::character varying, 'enterprise'::character varying, 'basic'::character varying, 'premium'::character varying])::text[])))
);


ALTER TABLE public.tenants OWNER TO sparknode;

--
-- Name: user_upload_staging; Type: TABLE; Schema: public; Owner: sparknode
--

CREATE TABLE public.user_upload_staging (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    batch_id uuid NOT NULL,
    full_name character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    department_name character varying(255),
    org_role character varying(50),
    manager_email character varying(255),
    first_name character varying(100),
    last_name character varying(100),
    department_id uuid,
    manager_id uuid,
    status character varying(50) DEFAULT 'pending'::character varying,
    errors jsonb DEFAULT '[]'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.user_upload_staging OWNER TO sparknode;

--
-- Name: users; Type: TABLE; Schema: public; Owner: sparknode
--

CREATE TABLE public.users (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    corporate_email character varying(255) NOT NULL,
    personal_email character varying(255),
    password_hash character varying(255) NOT NULL,
    first_name character varying(100) NOT NULL,
    last_name character varying(100) NOT NULL,
    org_role character varying(50) NOT NULL,
    department_id uuid NOT NULL,
    manager_id uuid,
    avatar_url character varying(500),
    phone_number character varying(20),
    mobile_number character varying(20),
    date_of_birth date,
    hire_date date,
    status character varying(50) DEFAULT 'ACTIVE'::character varying,
    is_super_admin boolean DEFAULT false,
    invitation_sent_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT users_org_role_check CHECK (((org_role)::text = ANY ((ARRAY['platform_admin'::character varying, 'tenant_admin'::character varying, 'hr_admin'::character varying, 'tenant_lead'::character varying, 'manager'::character varying, 'corporate_user'::character varying, 'employee'::character varying])::text[]))),
    CONSTRAINT users_status_check CHECK (((status)::text = ANY ((ARRAY['PENDING_INVITE'::character varying, 'ACTIVE'::character varying, 'DEACTIVATED'::character varying, 'pending_invite'::character varying, 'active'::character varying, 'deactivated'::character varying])::text[])))
);


ALTER TABLE public.users OWNER TO sparknode;

--
-- Name: vouchers; Type: TABLE; Schema: public; Owner: sparknode
--

CREATE TABLE public.vouchers (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    brand_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    denomination numeric(15,2) NOT NULL,
    points_required numeric(15,2) NOT NULL,
    copay_amount numeric(15,2) DEFAULT 0,
    image_url character varying(500),
    terms_conditions text,
    validity_days integer DEFAULT 365,
    is_active boolean DEFAULT true,
    stock_quantity integer,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.vouchers OWNER TO sparknode;

--
-- Name: wallet_ledger; Type: TABLE; Schema: public; Owner: sparknode
--

CREATE TABLE public.wallet_ledger (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    wallet_id uuid NOT NULL,
    transaction_type character varying(20) NOT NULL,
    source character varying(50) NOT NULL,
    points numeric(15,2) NOT NULL,
    balance_after numeric(15,2) NOT NULL,
    reference_type character varying(50),
    reference_id uuid,
    description text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT wallet_ledger_source_check CHECK (((source)::text = ANY ((ARRAY['hr_allocation'::character varying, 'recognition'::character varying, 'redemption'::character varying, 'adjustment'::character varying, 'expiry'::character varying, 'reversal'::character varying])::text[]))),
    CONSTRAINT wallet_ledger_transaction_type_check CHECK (((transaction_type)::text = ANY ((ARRAY['credit'::character varying, 'debit'::character varying])::text[])))
);


ALTER TABLE public.wallet_ledger OWNER TO sparknode;

--
-- Name: wallets; Type: TABLE; Schema: public; Owner: sparknode
--

CREATE TABLE public.wallets (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    user_id uuid NOT NULL,
    balance numeric(15,2) DEFAULT 0 NOT NULL,
    lifetime_earned numeric(15,2) DEFAULT 0 NOT NULL,
    lifetime_spent numeric(15,2) DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT wallets_balance_check CHECK ((balance >= (0)::numeric))
);


ALTER TABLE public.wallets OWNER TO sparknode;

--
-- Data for Name: activity_participants; Type: TABLE DATA; Schema: public; Owner: sparknode
--

COPY public.activity_participants (id, tenant_id, activity_id, event_participant_id, status, checked_in_at, points_awarded, created_at) FROM stdin;
\.


--
-- Data for Name: audit_log; Type: TABLE DATA; Schema: public; Owner: sparknode
--

COPY public.audit_log (id, tenant_id, actor_id, actor_type, action, entity_type, entity_id, old_values, new_values, ip_address, user_agent, created_at) FROM stdin;
\.


--
-- Data for Name: badges; Type: TABLE DATA; Schema: public; Owner: sparknode
--

COPY public.badges (id, tenant_id, name, description, icon_url, points_value, is_system, created_at) FROM stdin;
a9f10c6b-d7a1-474b-9bab-87ae0854aef2	\N	Star Performer	Outstanding performance recognition	⭐	100.00	t	2026-01-31 08:40:45.953242+00
6ab7df8b-5ea3-4cd2-899b-07efac7b4aa2	\N	Team Player	Excellent collaboration and teamwork	🤝	75.00	t	2026-01-31 08:40:45.953242+00
2779989a-8f36-4c9c-b1de-7950577c12a7	\N	Innovation Champion	Creative problem solving	💡	150.00	t	2026-01-31 08:40:45.953242+00
2b5a72ac-4722-43d4-9deb-4cfa2adf0efb	\N	Customer Hero	Exceptional customer service	🦸	100.00	t	2026-01-31 08:40:45.953242+00
02b98dcf-d258-4a1f-8b8b-8089e8abc582	\N	Quick Learner	Fast skill acquisition	📚	50.00	t	2026-01-31 08:40:45.953242+00
c06e6cb0-4684-42a9-bb3c-cd5d326a6d71	\N	Mentor	Helping others grow	🎓	100.00	t	2026-01-31 08:40:45.953242+00
33093ac3-bb84-4241-8d5e-30741294e2da	\N	Above & Beyond	Going the extra mile	🚀	125.00	t	2026-01-31 08:40:45.953242+00
a2097270-8e70-41b2-bbc5-9ba1f921268d	\N	Problem Solver	Finding solutions to challenges	🔧	75.00	t	2026-01-31 08:40:45.953242+00
\.


--
-- Data for Name: brands; Type: TABLE DATA; Schema: public; Owner: sparknode
--

COPY public.brands (id, name, description, logo_url, category, is_active, created_at) FROM stdin;
6d874804-5b28-4364-8334-ff79d2fcf444	Amazon	World's largest online retailer	📦	Shopping	t	2026-01-31 08:40:45.955624+00
c8d6a71e-542b-4e03-8a9d-5b73e4235d2e	Starbucks	Premium coffee and beverages	☕	Food & Beverage	t	2026-01-31 08:40:45.955624+00
bd893328-6ae9-4e59-9460-b99410a8b317	Netflix	Streaming entertainment service	🎬	Entertainment	t	2026-01-31 08:40:45.955624+00
5dcd02ae-9646-4682-b220-04292698a142	Uber	Ride-sharing and food delivery	🚗	Transportation	t	2026-01-31 08:40:45.955624+00
c14fd571-4198-4c97-81c2-2328ba4513ef	Spotify	Music streaming platform	🎵	Entertainment	t	2026-01-31 08:40:45.955624+00
3b0418e9-9d38-4950-94c6-0e8acba50009	Apple	Consumer electronics and services	🍎	Technology	t	2026-01-31 08:40:45.955624+00
e3f78166-2c9b-4c71-946d-14dd513169e3	Nike	Athletic footwear and apparel	👟	Sports & Fashion	t	2026-01-31 08:40:45.955624+00
b05b292b-c45a-41a8-9c59-237d4a4a7774	Target	Retail department store	🎯	Shopping	t	2026-01-31 08:40:45.955624+00
\.


--
-- Data for Name: budgets; Type: TABLE DATA; Schema: public; Owner: sparknode
--

COPY public.budgets (id, tenant_id, name, fiscal_year, fiscal_quarter, total_points, allocated_points, status, expiry_date, created_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: department_budgets; Type: TABLE DATA; Schema: public; Owner: sparknode
--

COPY public.department_budgets (id, tenant_id, budget_id, department_id, allocated_points, spent_points, monthly_cap, expiry_date, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: departments; Type: TABLE DATA; Schema: public; Owner: sparknode
--

COPY public.departments (id, tenant_id, name, parent_id, created_at, updated_at) FROM stdin;
010e8400-e29b-41d4-a716-446655440000	00000000-0000-0000-0000-000000000000	Human Resource (HR)	\N	2026-01-31 08:40:46.026978+00	2026-01-31 08:40:46.026978+00
110e8400-e29b-41d4-a716-446655440000	100e8400-e29b-41d4-a716-446655440000	Human Resource (HR)	\N	2026-01-31 08:40:46.026978+00	2026-01-31 08:40:46.026978+00
110e8400-e29b-41d4-a716-446655441000	100e8400-e29b-41d4-a716-446655440000	Techology (IT)	\N	2026-01-31 08:40:46.026978+00	2026-01-31 08:40:46.026978+00
110e8400-e29b-41d4-a716-446655442000	100e8400-e29b-41d4-a716-446655440000	Sale & Marketting	\N	2026-01-31 08:40:46.026978+00	2026-01-31 08:40:46.026978+00
110e8400-e29b-41d4-a716-446655443000	100e8400-e29b-41d4-a716-446655440000	Business Unit -1	\N	2026-01-31 08:40:46.026978+00	2026-01-31 08:40:46.026978+00
110e8400-e29b-41d4-a716-446655444000	100e8400-e29b-41d4-a716-446655440000	Business Unit-2	\N	2026-01-31 08:40:46.026978+00	2026-01-31 08:40:46.026978+00
110e8400-e29b-41d4-a716-446655445000	100e8400-e29b-41d4-a716-446655440000	Business Unit-3	\N	2026-01-31 08:40:46.026978+00	2026-01-31 08:40:46.026978+00
110e8400-e29b-41d4-a716-446655440010	100e8400-e29b-41d4-a716-446655440010	Human Resource (HR)	\N	2026-01-31 08:40:46.026978+00	2026-01-31 08:40:46.026978+00
110e8400-e29b-41d4-a716-446655441010	100e8400-e29b-41d4-a716-446655440010	Techology (IT)	\N	2026-01-31 08:40:46.026978+00	2026-01-31 08:40:46.026978+00
110e8400-e29b-41d4-a716-446655440011	100e8400-e29b-41d4-a716-446655440011	Human Resource (HR)	\N	2026-01-31 08:40:46.026978+00	2026-01-31 08:40:46.026978+00
110e8400-e29b-41d4-a716-446655441011	100e8400-e29b-41d4-a716-446655440011	Techology (IT)	\N	2026-01-31 08:40:46.026978+00	2026-01-31 08:40:46.026978+00
110e8400-e29b-41d4-a716-446655440012	100e8400-e29b-41d4-a716-446655440012	Human Resource (HR)	\N	2026-01-31 08:40:46.026978+00	2026-01-31 08:40:46.026978+00
110e8400-e29b-41d4-a716-446655441012	100e8400-e29b-41d4-a716-446655440012	Techology (IT)	\N	2026-01-31 08:40:46.026978+00	2026-01-31 08:40:46.026978+00
\.


--
-- Data for Name: event_activities; Type: TABLE DATA; Schema: public; Owner: sparknode
--

COPY public.event_activities (id, event_id, tenant_id, name, description, category, max_participants, max_teams, min_team_size, max_team_size, nomination_start, nomination_end, activity_start, activity_end, requires_approval, allow_multiple_teams, rules_text, sequence, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: event_budgets; Type: TABLE DATA; Schema: public; Owner: sparknode
--

COPY public.event_budgets (id, event_id, tenant_id, planned_budget, actual_spend, committed_spend, budget_breakdown, created_at, updated_at) FROM stdin;
6123d74c-be8f-4264-a746-5cdf4bda4ebd	ee28bc35-507e-472d-a44e-70d12bd9db9c	100e8400-e29b-41d4-a716-446655440000	5000.00	0.00	0.00	{}	2026-01-31 08:40:57.218337+00	2026-01-31 08:40:57.218337+00
f22e1d17-fd8b-466c-9e24-9e5642d9e522	371947be-54a6-4430-9e9a-8fbeedac709a	100e8400-e29b-41d4-a716-446655440000	0.00	0.00	0.00	{}	2026-01-31 08:40:57.262217+00	2026-01-31 08:40:57.262217+00
a46224f2-2698-488d-8889-38fa9e68914b	848d19c2-b727-4174-9394-d66ed50eb3cc	00000000-0000-0000-0000-000000000000	0.00	0.00	0.00	{}	2026-01-31 08:40:57.540055+00	2026-01-31 08:40:57.540055+00
c1fc3880-a022-4966-9ac0-56ddab9c9238	27dbce41-ddb2-474e-b44c-ff11c08ebdb9	100e8400-e29b-41d4-a716-446655440000	0.00	0.00	0.00	{}	2026-01-31 08:40:57.817382+00	2026-01-31 08:40:57.817382+00
4285e5ff-f8f6-4e50-aab4-959bdb662f4a	b3e0e133-6397-415c-8522-e0805fd7de3d	100e8400-e29b-41d4-a716-446655440000	0.00	0.00	0.00	{}	2026-01-31 08:40:57.893122+00	2026-01-31 08:40:57.893122+00
0f1376f7-ced9-48cb-8612-76cd419f99d8	ce4b886f-4c36-4acf-8390-8876ae15c0a3	100e8400-e29b-41d4-a716-446655440000	5000.00	0.00	0.00	{}	2026-01-31 08:41:12.433395+00	2026-01-31 08:41:12.433395+00
ba9fbe48-0a3b-4d07-99e6-9c11d681b187	531c7586-3f53-4a95-b33b-2076691bac1b	100e8400-e29b-41d4-a716-446655440000	0.00	0.00	0.00	{}	2026-01-31 08:41:12.459627+00	2026-01-31 08:41:12.459627+00
84daa4d2-7127-4169-9c51-9e94f6af2888	9db40c24-40f0-4d0e-a3b6-69ad20709257	00000000-0000-0000-0000-000000000000	0.00	0.00	0.00	{}	2026-01-31 08:41:12.76992+00	2026-01-31 08:41:12.76992+00
343b236c-b65f-42ac-ab75-c53a5a3192e7	e849cb6b-cb25-4576-b887-01b7edc6d2dc	100e8400-e29b-41d4-a716-446655440000	0.00	0.00	0.00	{}	2026-01-31 08:41:13.10519+00	2026-01-31 08:41:13.10519+00
25c9f428-f80e-4e9e-b0a5-66c8bba3c4fb	c0df428e-7fe7-44aa-93c6-9a0f8a5bb6ca	100e8400-e29b-41d4-a716-446655440000	0.00	0.00	0.00	{}	2026-01-31 08:41:13.184779+00	2026-01-31 08:41:13.184779+00
\.


--
-- Data for Name: event_gift_batches; Type: TABLE DATA; Schema: public; Owner: sparknode
--

COPY public.event_gift_batches (id, event_id, tenant_id, gift_name, gift_type, description, quantity, unit_value, eligible_criteria, distribution_start, distribution_end, distribution_locations, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: event_gift_redemptions; Type: TABLE DATA; Schema: public; Owner: sparknode
--

COPY public.event_gift_redemptions (id, event_id, tenant_id, gift_batch_id, user_id, redemption_date, location, status, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: event_metrics; Type: TABLE DATA; Schema: public; Owner: sparknode
--

COPY public.event_metrics (id, event_id, tenant_id, total_invited, total_registered, total_participated, no_shows, activity_metrics, gifts_eligible, gifts_issued, gifts_redeemed, department_metrics, computed_at, created_at, updated_at) FROM stdin;
e3ef601c-1cbd-40af-8a7d-074c07233242	ee28bc35-507e-472d-a44e-70d12bd9db9c	100e8400-e29b-41d4-a716-446655440000	0	0	0	0	{}	0	0	0	{}	2026-01-31 08:40:57.218337+00	2026-01-31 08:40:57.218337+00	2026-01-31 08:40:57.218337+00
072e3cdb-ec55-48b7-8d51-ab23e7859c93	371947be-54a6-4430-9e9a-8fbeedac709a	100e8400-e29b-41d4-a716-446655440000	0	0	0	0	{}	0	0	0	{}	2026-01-31 08:40:57.262217+00	2026-01-31 08:40:57.262217+00	2026-01-31 08:40:57.262217+00
cc1302b9-ee0e-496d-a785-f82ec04c7557	848d19c2-b727-4174-9394-d66ed50eb3cc	00000000-0000-0000-0000-000000000000	0	0	0	0	{}	0	0	0	{}	2026-01-31 08:40:57.540055+00	2026-01-31 08:40:57.540055+00	2026-01-31 08:40:57.540055+00
ffbc5144-eb2c-47cc-8b67-7f8c1d1391ff	27dbce41-ddb2-474e-b44c-ff11c08ebdb9	100e8400-e29b-41d4-a716-446655440000	0	0	0	0	{}	0	0	0	{}	2026-01-31 08:40:57.817382+00	2026-01-31 08:40:57.817382+00	2026-01-31 08:40:57.817382+00
0c3f1fc4-c156-40c9-aa8d-fd1172b04812	b3e0e133-6397-415c-8522-e0805fd7de3d	100e8400-e29b-41d4-a716-446655440000	0	0	0	0	{}	0	0	0	{}	2026-01-31 08:40:57.893122+00	2026-01-31 08:40:57.893122+00	2026-01-31 08:40:57.893122+00
c80d718a-1b98-4260-8d80-eace2bb4d297	ce4b886f-4c36-4acf-8390-8876ae15c0a3	100e8400-e29b-41d4-a716-446655440000	0	0	0	0	{}	0	0	0	{}	2026-01-31 08:41:12.433395+00	2026-01-31 08:41:12.433395+00	2026-01-31 08:41:12.433395+00
25106a6b-14ff-48dd-9e7d-0640a50767cf	531c7586-3f53-4a95-b33b-2076691bac1b	100e8400-e29b-41d4-a716-446655440000	0	0	0	0	{}	0	0	0	{}	2026-01-31 08:41:12.459627+00	2026-01-31 08:41:12.459627+00	2026-01-31 08:41:12.459627+00
46910797-7388-4438-8abf-ed5ee7eb9a2a	9db40c24-40f0-4d0e-a3b6-69ad20709257	00000000-0000-0000-0000-000000000000	0	0	0	0	{}	0	0	0	{}	2026-01-31 08:41:12.76992+00	2026-01-31 08:41:12.76992+00	2026-01-31 08:41:12.76992+00
b483c05b-46d9-4659-a2d1-5fa7532e458b	e849cb6b-cb25-4576-b887-01b7edc6d2dc	100e8400-e29b-41d4-a716-446655440000	0	0	0	0	{}	0	0	0	{}	2026-01-31 08:41:13.10519+00	2026-01-31 08:41:13.10519+00	2026-01-31 08:41:13.10519+00
cd61f266-800d-4da3-8eed-fccdac7aa586	c0df428e-7fe7-44aa-93c6-9a0f8a5bb6ca	100e8400-e29b-41d4-a716-446655440000	0	0	0	0	{}	0	0	0	{}	2026-01-31 08:41:13.184779+00	2026-01-31 08:41:13.184779+00	2026-01-31 08:41:13.184779+00
\.


--
-- Data for Name: event_nominations; Type: TABLE DATA; Schema: public; Owner: sparknode
--

COPY public.event_nominations (id, event_id, activity_id, tenant_id, nominee_user_id, team_id, created_by, status, performance_title, notes, preferred_slot, reviewed_by, reviewed_at, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: event_participants; Type: TABLE DATA; Schema: public; Owner: sparknode
--

COPY public.event_participants (id, tenant_id, event_id, user_id, status, approved_by, approved_at, rejection_reason, checked_in_at, checked_in_by, custom_field_responses, registered_at, updated_at) FROM stdin;
\.


--
-- Data for Name: event_team_members; Type: TABLE DATA; Schema: public; Owner: sparknode
--

COPY public.event_team_members (id, team_id, user_id, tenant_id, created_at) FROM stdin;
\.


--
-- Data for Name: event_teams; Type: TABLE DATA; Schema: public; Owner: sparknode
--

COPY public.event_teams (id, event_id, activity_id, tenant_id, team_name, leader_user_id, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: events; Type: TABLE DATA; Schema: public; Owner: sparknode
--

COPY public.events (id, tenant_id, title, description, type, start_datetime, end_datetime, venue, location, format, status, visibility, visible_to_departments, banner_url, color_code, nomination_start, nomination_end, who_can_nominate, max_activities_per_person, planned_budget, currency, created_by, created_at, updated_at) FROM stdin;
ee28bc35-507e-472d-a44e-70d12bd9db9c	100e8400-e29b-41d4-a716-446655440000	Test Event 2026-01-31T08:40:57.212016	Test event for API	celebration	2026-02-07 08:40:57.212027+00	2026-02-08 08:40:57.212032+00	Main Hall	Building A	hybrid	draft	all_employees	["110e8400-e29b-41d4-a716-446655440000"]	https://example.com/banner.jpg	#FF5733	2026-01-31 08:40:57.212036+00	2026-02-05 08:40:57.212038+00	all_employees	3	5000.00	USD	220e8400-e29b-41d4-a716-446655440001	2026-01-31 08:40:57.218337+00	2026-01-31 08:40:57.218337+00
371947be-54a6-4430-9e9a-8fbeedac709a	100e8400-e29b-41d4-a716-446655440000	Minimal Event 2026-01-31T08:40:57.258130	\N	celebration	2026-02-07 08:40:57.258141+00	2026-02-08 08:40:57.258149+00	\N	\N	onsite	draft	all_employees	[]	\N	#3B82F6	\N	\N	all_employees	5	0.00	USD	220e8400-e29b-41d4-a716-446655440001	2026-01-31 08:40:57.262217+00	2026-01-31 08:40:57.262217+00
848d19c2-b727-4174-9394-d66ed50eb3cc	00000000-0000-0000-0000-000000000000	Platform Admin Event 2026-01-31T08:40:57.535915	\N	celebration	2026-02-07 08:40:57.535925+00	2026-02-08 08:40:57.53593+00	\N	\N	onsite	draft	all_employees	[]	\N	#3B82F6	\N	\N	all_employees	5	0.00	USD	220e8400-e29b-41d4-a716-446655440000	2026-01-31 08:40:57.540055+00	2026-01-31 08:40:57.540055+00
27dbce41-ddb2-474e-b44c-ff11c08ebdb9	100e8400-e29b-41d4-a716-446655440000	Regular User Event 2026-01-31T08:40:57.814377	\N	celebration	2026-02-07 08:40:57.814387+00	2026-02-08 08:40:57.814392+00	\N	\N	onsite	draft	all_employees	[]	\N	#3B82F6	\N	\N	all_employees	5	0.00	USD	220e8400-e29b-41d4-a716-446655440003	2026-01-31 08:40:57.817382+00	2026-01-31 08:40:57.817382+00
b3e0e133-6397-415c-8522-e0805fd7de3d	100e8400-e29b-41d4-a716-446655440000	Tenant Test Event 2026-01-31T08:40:57.889412	\N	celebration	2026-02-07 08:40:57.889424+00	2026-02-08 08:40:57.889429+00	\N	\N	onsite	draft	all_employees	[]	\N	#3B82F6	\N	\N	all_employees	5	0.00	USD	220e8400-e29b-41d4-a716-446655440001	2026-01-31 08:40:57.893122+00	2026-01-31 08:40:57.893122+00
ce4b886f-4c36-4acf-8390-8876ae15c0a3	100e8400-e29b-41d4-a716-446655440000	Test Event 2026-01-31T08:41:12.428549	Test event for API	celebration	2026-02-07 08:41:12.428559+00	2026-02-08 08:41:12.428564+00	Main Hall	Building A	hybrid	draft	all_employees	["110e8400-e29b-41d4-a716-446655440000"]	https://example.com/banner.jpg	#FF5733	2026-01-31 08:41:12.428569+00	2026-02-05 08:41:12.42857+00	all_employees	3	5000.00	USD	220e8400-e29b-41d4-a716-446655440001	2026-01-31 08:41:12.433395+00	2026-01-31 08:41:12.433395+00
531c7586-3f53-4a95-b33b-2076691bac1b	100e8400-e29b-41d4-a716-446655440000	Minimal Event 2026-01-31T08:41:12.456195	\N	celebration	2026-02-07 08:41:12.456206+00	2026-02-08 08:41:12.45621+00	\N	\N	onsite	draft	all_employees	[]	\N	#3B82F6	\N	\N	all_employees	5	0.00	USD	220e8400-e29b-41d4-a716-446655440001	2026-01-31 08:41:12.459627+00	2026-01-31 08:41:12.459627+00
9db40c24-40f0-4d0e-a3b6-69ad20709257	00000000-0000-0000-0000-000000000000	Platform Admin Event 2026-01-31T08:41:12.764684	\N	celebration	2026-02-07 08:41:12.764701+00	2026-02-08 08:41:12.764709+00	\N	\N	onsite	draft	all_employees	[]	\N	#3B82F6	\N	\N	all_employees	5	0.00	USD	220e8400-e29b-41d4-a716-446655440000	2026-01-31 08:41:12.76992+00	2026-01-31 08:41:12.76992+00
e849cb6b-cb25-4576-b887-01b7edc6d2dc	100e8400-e29b-41d4-a716-446655440000	Regular User Event 2026-01-31T08:41:13.098692	\N	celebration	2026-02-07 08:41:13.098703+00	2026-02-08 08:41:13.098859+00	\N	\N	onsite	draft	all_employees	[]	\N	#3B82F6	\N	\N	all_employees	5	0.00	USD	220e8400-e29b-41d4-a716-446655440003	2026-01-31 08:41:13.10519+00	2026-01-31 08:41:13.10519+00
c0df428e-7fe7-44aa-93c6-9a0f8a5bb6ca	100e8400-e29b-41d4-a716-446655440000	Tenant Test Event 2026-01-31T08:41:13.179395	\N	celebration	2026-02-07 08:41:13.179407+00	2026-02-08 08:41:13.179417+00	\N	\N	onsite	draft	all_employees	[]	\N	#3B82F6	\N	\N	all_employees	5	0.00	USD	220e8400-e29b-41d4-a716-446655440001	2026-01-31 08:41:13.184779+00	2026-01-31 08:41:13.184779+00
\.


--
-- Data for Name: feed; Type: TABLE DATA; Schema: public; Owner: sparknode
--

COPY public.feed (id, tenant_id, event_type, reference_type, reference_id, actor_id, target_id, visibility, metadata, created_at) FROM stdin;
\.


--
-- Data for Name: lead_budgets; Type: TABLE DATA; Schema: public; Owner: sparknode
--

COPY public.lead_budgets (id, tenant_id, department_budget_id, user_id, total_points, spent_points, status, expiry_date, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: master_budget_ledger; Type: TABLE DATA; Schema: public; Owner: sparknode
--

COPY public.master_budget_ledger (id, tenant_id, transaction_type, source, points, balance_after, reference_type, reference_id, description, created_by, created_by_type, created_at) FROM stdin;
\.


--
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: sparknode
--

COPY public.notifications (id, tenant_id, user_id, type, title, message, reference_type, reference_id, is_read, created_at) FROM stdin;
\.


--
-- Data for Name: otp_tokens; Type: TABLE DATA; Schema: public; Owner: sparknode
--

COPY public.otp_tokens (id, tenant_id, user_id, channel, destination, token_hash, expires_at, used_at, created_at) FROM stdin;
\.


--
-- Data for Name: platform_metrics; Type: TABLE DATA; Schema: public; Owner: sparknode
--

COPY public.platform_metrics (id, period_type, period_start, period_end, total_tenants, active_tenants, new_tenants, churned_tenants, total_users, active_users, new_users, total_recognitions, total_points_distributed, total_redemptions, total_redemption_value, mrr, arr, tier_breakdown, tenant_benchmarks, computed_at) FROM stdin;
\.


--
-- Data for Name: recognition_comments; Type: TABLE DATA; Schema: public; Owner: sparknode
--

COPY public.recognition_comments (id, recognition_id, user_id, content, created_at) FROM stdin;
\.


--
-- Data for Name: recognition_reactions; Type: TABLE DATA; Schema: public; Owner: sparknode
--

COPY public.recognition_reactions (id, recognition_id, user_id, reaction_type, created_at) FROM stdin;
\.


--
-- Data for Name: recognitions; Type: TABLE DATA; Schema: public; Owner: sparknode
--

COPY public.recognitions (id, tenant_id, from_user_id, to_user_id, badge_id, points, message, visibility, status, department_budget_id, lead_budget_id, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: redemptions; Type: TABLE DATA; Schema: public; Owner: sparknode
--

COPY public.redemptions (id, tenant_id, user_id, voucher_id, points_used, copay_amount, voucher_code, voucher_pin, status, provider_reference, fulfilled_at, expires_at, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: system_admins; Type: TABLE DATA; Schema: public; Owner: sparknode
--

COPY public.system_admins (admin_id, user_id, access_level, mfa_enabled, last_login_at, created_at, updated_at) FROM stdin;
d8684f3e-1e79-4a8f-a505-750d8e19cdbb	220e8400-e29b-41d4-a716-446655440000	PLATFORM_ADMIN	t	\N	2026-01-31 08:40:46.040293+00	2026-01-31 08:40:46.040293+00
\.


--
-- Data for Name: tenant_analytics; Type: TABLE DATA; Schema: public; Owner: sparknode
--

COPY public.tenant_analytics (id, tenant_id, period_type, period_start, period_end, active_users, recognitions_given, recognitions_received, points_distributed, points_redeemed, budget_utilization_rate, budget_burn_rate, engagement_score, participation_rate, department_metrics, top_recognizers, top_recipients, computed_at) FROM stdin;
\.


--
-- Data for Name: tenant_vouchers; Type: TABLE DATA; Schema: public; Owner: sparknode
--

COPY public.tenant_vouchers (id, tenant_id, voucher_id, is_active, custom_points_required, created_at) FROM stdin;
\.


--
-- Data for Name: tenants; Type: TABLE DATA; Schema: public; Owner: sparknode
--

COPY public.tenants (id, name, slug, domain, logo_url, favicon_url, theme_config, domain_whitelist, auth_method, currency_label, conversion_rate, auto_refill_threshold, award_tiers, peer_to_peer_enabled, expiry_policy, status, subscription_tier, subscription_status, subscription_started_at, subscription_ends_at, max_users, master_budget_balance, settings, feature_flags, catalog_settings, branding, created_at, updated_at, branding_config) FROM stdin;
550e8400-e29b-41d4-a716-446655440000	Demo Company	\N	demo.sparknode.com	\N	\N	{"font_family": "Inter", "primary_color": "#3B82F6", "secondary_color": "#8B5CF6"}	[]	PASSWORD_AND_OTP	Points	1.0000	20.00	{"Gold": 5000, "Bronze": 1000, "Silver": 2500}	t	NEVER	active	starter	active	\N	\N	50	0.00	{"copay_enabled": false, "social_feed_enabled": true, "events_module_enabled": true, "peer_to_peer_recognition": true, "points_to_currency_ratio": 0.10}	{}	{}	{}	2026-01-31 08:40:45.960044+00	2026-01-31 08:40:45.960044+00	{}
100e8400-e29b-41d4-a716-446655440000	jSpark	jspark	jspark.sparknode.io	\N	\N	{"font_family": "Inter", "primary_color": "#3B82F6", "secondary_color": "#8B5CF6"}	[]	PASSWORD_AND_OTP	Points	1.0000	20.00	{"Gold": 5000, "Bronze": 1000, "Silver": 2500}	t	NEVER	active	enterprise	active	\N	\N	50	0.00	{"copay_enabled": false, "social_feed_enabled": true, "events_module_enabled": true, "peer_to_peer_recognition": true, "points_to_currency_ratio": 0.10}	{}	{}	{}	2026-01-31 08:40:45.961631+00	2026-01-31 08:40:45.961631+00	{}
100e8400-e29b-41d4-a716-446655440001	All Tenants	all-tenants	\N	\N	\N	{"font_family": "Inter", "primary_color": "#3B82F6", "secondary_color": "#8B5CF6"}	[]	PASSWORD_AND_OTP	Points	1.0000	20.00	{"Gold": 5000, "Bronze": 1000, "Silver": 2500}	t	NEVER	active	enterprise	active	\N	\N	50	0.00	{"copay_enabled": false, "social_feed_enabled": true, "events_module_enabled": true, "peer_to_peer_recognition": true, "points_to_currency_ratio": 0.10}	{}	{}	{}	2026-01-31 08:40:45.963868+00	2026-01-31 08:40:45.963868+00	{}
100e8400-e29b-41d4-a716-446655440010	Triton	triton	triton.sparknode.io	\N	\N	{"font_family": "Inter", "primary_color": "#3B82F6", "secondary_color": "#8B5CF6"}	[]	PASSWORD_AND_OTP	Points	1.0000	20.00	{"Gold": 5000, "Bronze": 1000, "Silver": 2500}	t	NEVER	active	professional	active	\N	\N	50	0.00	{"copay_enabled": false, "social_feed_enabled": true, "events_module_enabled": true, "peer_to_peer_recognition": true, "points_to_currency_ratio": 0.10}	{}	{}	{}	2026-01-31 08:40:45.965904+00	2026-01-31 08:40:45.965904+00	{}
100e8400-e29b-41d4-a716-446655440011	Uniplane	uniplane	uniplane.sparknode.io	\N	\N	{"font_family": "Inter", "primary_color": "#3B82F6", "secondary_color": "#8B5CF6"}	[]	PASSWORD_AND_OTP	Points	1.0000	20.00	{"Gold": 5000, "Bronze": 1000, "Silver": 2500}	t	NEVER	active	starter	active	\N	\N	50	0.00	{"copay_enabled": false, "social_feed_enabled": true, "events_module_enabled": true, "peer_to_peer_recognition": true, "points_to_currency_ratio": 0.10}	{}	{}	{}	2026-01-31 08:40:45.965904+00	2026-01-31 08:40:45.965904+00	{}
100e8400-e29b-41d4-a716-446655440012	Zebra	zebra	zebra.sparknode.io	\N	\N	{"font_family": "Inter", "primary_color": "#3B82F6", "secondary_color": "#8B5CF6"}	[]	PASSWORD_AND_OTP	Points	1.0000	20.00	{"Gold": 5000, "Bronze": 1000, "Silver": 2500}	t	NEVER	active	starter	active	\N	\N	50	0.00	{"copay_enabled": false, "social_feed_enabled": true, "events_module_enabled": true, "peer_to_peer_recognition": true, "points_to_currency_ratio": 0.10}	{}	{}	{}	2026-01-31 08:40:45.965904+00	2026-01-31 08:40:45.965904+00	{}
00000000-0000-0000-0000-000000000000	root_tenant_sparknode	admin	\N	\N	\N	{"font_family": "Inter", "primary_color": "#3B82F6", "secondary_color": "#8B5CF6"}	[]	PASSWORD_AND_OTP	Points	1.0000	20.00	{"Gold": 5000, "Bronze": 1000, "Silver": 2500}	t	NEVER	active	enterprise	active	\N	\N	50	0.00	{"copay_enabled": false, "social_feed_enabled": true, "events_module_enabled": true, "peer_to_peer_recognition": true, "points_to_currency_ratio": 0.10}	{}	{}	{}	2026-01-31 08:40:45.973564+00	2026-01-31 08:40:45.973564+00	{}
\.


--
-- Data for Name: user_upload_staging; Type: TABLE DATA; Schema: public; Owner: sparknode
--

COPY public.user_upload_staging (id, tenant_id, batch_id, full_name, email, department_name, org_role, manager_email, first_name, last_name, department_id, manager_id, status, errors, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: sparknode
--

COPY public.users (id, tenant_id, corporate_email, personal_email, password_hash, first_name, last_name, org_role, department_id, manager_id, avatar_url, phone_number, mobile_number, date_of_birth, hire_date, status, is_super_admin, invitation_sent_at, created_at, updated_at) FROM stdin;
220e8400-e29b-41d4-a716-446655440000	00000000-0000-0000-0000-000000000000	super_user@sparknode.io	\N	$2b$12$wUO54KkKhLF1ShGUklxUZ.F7rxZ5Vy.c5psXvulEaukdcvNuiZX3u	Platform	Admin	platform_admin	010e8400-e29b-41d4-a716-446655440000	\N	\N	\N	\N	\N	\N	ACTIVE	t	\N	2026-01-31 08:40:46.034656+00	2026-01-31 08:40:46.034656+00
220e8400-e29b-41d4-a716-446655440001	100e8400-e29b-41d4-a716-446655440000	tenant_admin@sparknode.io	\N	$2b$12$wUO54KkKhLF1ShGUklxUZ.F7rxZ5Vy.c5psXvulEaukdcvNuiZX3u	Tenant	Admin	tenant_admin	110e8400-e29b-41d4-a716-446655440000	\N	\N	\N	\N	\N	\N	ACTIVE	f	\N	2026-01-31 08:40:46.043006+00	2026-01-31 08:40:46.043006+00
220e8400-e29b-41d4-a716-446655440002	100e8400-e29b-41d4-a716-446655440000	tenant_lead@sparknode.io	\N	$2b$12$wUO54KkKhLF1ShGUklxUZ.F7rxZ5Vy.c5psXvulEaukdcvNuiZX3u	Tenant	Lead	tenant_lead	110e8400-e29b-41d4-a716-446655440000	\N	\N	\N	\N	\N	\N	ACTIVE	f	\N	2026-01-31 08:40:46.044459+00	2026-01-31 08:40:46.044459+00
220e8400-e29b-41d4-a716-446655440003	100e8400-e29b-41d4-a716-446655440000	user@sparknode.io	\N	$2b$12$wUO54KkKhLF1ShGUklxUZ.F7rxZ5Vy.c5psXvulEaukdcvNuiZX3u	Corporate	User	corporate_user	110e8400-e29b-41d4-a716-446655440000	\N	\N	\N	\N	\N	\N	ACTIVE	f	\N	2026-01-31 08:40:46.04589+00	2026-01-31 08:40:46.04589+00
\.


--
-- Data for Name: vouchers; Type: TABLE DATA; Schema: public; Owner: sparknode
--

COPY public.vouchers (id, brand_id, name, description, denomination, points_required, copay_amount, image_url, terms_conditions, validity_days, is_active, stock_quantity, created_at, updated_at) FROM stdin;
8cc70799-9015-4a28-a584-56e7f4569f5a	6d874804-5b28-4364-8334-ff79d2fcf444	Amazon Gift Card ₹25	Redeemable on Amazon.com	25.00	250.00	0.00	\N	\N	365	t	\N	2026-01-31 08:40:45.957133+00	2026-01-31 08:40:45.957133+00
e75adb9d-db88-4515-8c06-c33146249ff5	6d874804-5b28-4364-8334-ff79d2fcf444	Amazon Gift Card ₹50	Redeemable on Amazon.com	50.00	500.00	0.00	\N	\N	365	t	\N	2026-01-31 08:40:45.957133+00	2026-01-31 08:40:45.957133+00
1ee444ad-967e-4ee0-ad31-18faefb7df1a	6d874804-5b28-4364-8334-ff79d2fcf444	Amazon Gift Card ₹100	Redeemable on Amazon.com	100.00	1000.00	0.00	\N	\N	365	t	\N	2026-01-31 08:40:45.957133+00	2026-01-31 08:40:45.957133+00
4da67622-b8a3-4fe3-94aa-8f48a8da0254	c8d6a71e-542b-4e03-8a9d-5b73e4235d2e	Starbucks Card ₹10	Valid at all Starbucks locations	10.00	100.00	0.00	\N	\N	180	t	\N	2026-01-31 08:40:45.957133+00	2026-01-31 08:40:45.957133+00
c265a056-0619-44fc-818b-bedd1e347875	c8d6a71e-542b-4e03-8a9d-5b73e4235d2e	Starbucks Card ₹25	Valid at all Starbucks locations	25.00	250.00	0.00	\N	\N	180	t	\N	2026-01-31 08:40:45.957133+00	2026-01-31 08:40:45.957133+00
aa3f20c8-d2ec-4c0d-8983-17235f99898f	bd893328-6ae9-4e59-9460-b99410a8b317	Netflix 1 Month	One month standard subscription	15.99	160.00	0.00	\N	\N	90	t	\N	2026-01-31 08:40:45.957133+00	2026-01-31 08:40:45.957133+00
cb03caa6-fb41-43e7-8b88-24471747fe72	bd893328-6ae9-4e59-9460-b99410a8b317	Netflix 3 Months	Three months standard subscription	47.97	450.00	0.00	\N	\N	90	t	\N	2026-01-31 08:40:45.957133+00	2026-01-31 08:40:45.957133+00
acf07831-f498-4e59-ab98-844bba666ec3	5dcd02ae-9646-4682-b220-04292698a142	Uber Credit ₹15	Valid for rides or Uber Eats	15.00	150.00	0.00	\N	\N	180	t	\N	2026-01-31 08:40:45.957133+00	2026-01-31 08:40:45.957133+00
42effe10-ff47-47ee-a0c8-6ff4965b2e36	5dcd02ae-9646-4682-b220-04292698a142	Uber Credit ₹30	Valid for rides or Uber Eats	30.00	300.00	0.00	\N	\N	180	t	\N	2026-01-31 08:40:45.957133+00	2026-01-31 08:40:45.957133+00
9bb1d34c-c9a0-429d-9e8e-43b6d445bd6c	c14fd571-4198-4c97-81c2-2328ba4513ef	Spotify 1 Month Premium	Ad-free music streaming	10.99	110.00	0.00	\N	\N	60	t	\N	2026-01-31 08:40:45.957133+00	2026-01-31 08:40:45.957133+00
24d046f5-87cb-4a64-9987-695562479c89	3b0418e9-9d38-4950-94c6-0e8acba50009	Apple Gift Card ₹25	For App Store, iTunes, and more	25.00	250.00	0.00	\N	\N	365	t	\N	2026-01-31 08:40:45.957133+00	2026-01-31 08:40:45.957133+00
d4adde42-6fcb-43aa-9285-bbdbdb23a359	3b0418e9-9d38-4950-94c6-0e8acba50009	Apple Gift Card ₹50	For App Store, iTunes, and more	50.00	500.00	0.00	\N	\N	365	t	\N	2026-01-31 08:40:45.957133+00	2026-01-31 08:40:45.957133+00
93ce8440-fd55-4c82-b7fd-849468cd0776	e3f78166-2c9b-4c71-946d-14dd513169e3	Nike Gift Card ₹50	Valid online and in-store	50.00	500.00	0.00	\N	\N	365	t	\N	2026-01-31 08:40:45.957133+00	2026-01-31 08:40:45.957133+00
dc7cd5bb-b0aa-489f-9559-e0121906ad9b	b05b292b-c45a-41a8-9c59-237d4a4a7774	Target GiftCard ₹25	Valid at Target stores and Target.com	25.00	250.00	0.00	\N	\N	365	t	\N	2026-01-31 08:40:45.957133+00	2026-01-31 08:40:45.957133+00
1aee3d0e-c560-48df-8a3d-97446693be47	b05b292b-c45a-41a8-9c59-237d4a4a7774	Target GiftCard ₹50	Valid at Target stores and Target.com	50.00	500.00	0.00	\N	\N	365	t	\N	2026-01-31 08:40:45.957133+00	2026-01-31 08:40:45.957133+00
\.


--
-- Data for Name: wallet_ledger; Type: TABLE DATA; Schema: public; Owner: sparknode
--

COPY public.wallet_ledger (id, tenant_id, wallet_id, transaction_type, source, points, balance_after, reference_type, reference_id, description, created_by, created_at) FROM stdin;
\.


--
-- Data for Name: wallets; Type: TABLE DATA; Schema: public; Owner: sparknode
--

COPY public.wallets (id, tenant_id, user_id, balance, lifetime_earned, lifetime_spent, created_at, updated_at) FROM stdin;
e054765f-1d27-40ff-a396-c92a55a39a1d	00000000-0000-0000-0000-000000000000	220e8400-e29b-41d4-a716-446655440000	0.00	0.00	0.00	2026-01-31 08:40:46.048145+00	2026-01-31 08:40:46.048145+00
593f4d10-cf1e-4b13-89fc-ddaeabcc79b5	100e8400-e29b-41d4-a716-446655440000	220e8400-e29b-41d4-a716-446655440001	0.00	0.00	0.00	2026-01-31 08:40:46.048145+00	2026-01-31 08:40:46.048145+00
522bc88a-5af6-4631-95c0-be0fc9832f99	100e8400-e29b-41d4-a716-446655440000	220e8400-e29b-41d4-a716-446655440002	0.00	0.00	0.00	2026-01-31 08:40:46.048145+00	2026-01-31 08:40:46.048145+00
8e3d8c0b-5834-4f45-9a60-89b70d1631bf	100e8400-e29b-41d4-a716-446655440000	220e8400-e29b-41d4-a716-446655440003	0.00	0.00	0.00	2026-01-31 08:40:46.048145+00	2026-01-31 08:40:46.048145+00
\.


--
-- Name: activity_participants activity_participants_pkey; Type: CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.activity_participants
    ADD CONSTRAINT activity_participants_pkey PRIMARY KEY (id);


--
-- Name: audit_log audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_pkey PRIMARY KEY (id);


--
-- Name: badges badges_pkey; Type: CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.badges
    ADD CONSTRAINT badges_pkey PRIMARY KEY (id);


--
-- Name: brands brands_pkey; Type: CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.brands
    ADD CONSTRAINT brands_pkey PRIMARY KEY (id);


--
-- Name: budgets budgets_pkey; Type: CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.budgets
    ADD CONSTRAINT budgets_pkey PRIMARY KEY (id);


--
-- Name: department_budgets department_budgets_budget_id_department_id_key; Type: CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.department_budgets
    ADD CONSTRAINT department_budgets_budget_id_department_id_key UNIQUE (budget_id, department_id);


--
-- Name: department_budgets department_budgets_pkey; Type: CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.department_budgets
    ADD CONSTRAINT department_budgets_pkey PRIMARY KEY (id);


--
-- Name: departments departments_pkey; Type: CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_pkey PRIMARY KEY (id);


--
-- Name: departments departments_tenant_id_name_key; Type: CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_tenant_id_name_key UNIQUE (tenant_id, name);


--
-- Name: event_activities event_activities_pkey; Type: CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.event_activities
    ADD CONSTRAINT event_activities_pkey PRIMARY KEY (id);


--
-- Name: event_budgets event_budgets_event_id_key; Type: CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.event_budgets
    ADD CONSTRAINT event_budgets_event_id_key UNIQUE (event_id);


--
-- Name: event_budgets event_budgets_pkey; Type: CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.event_budgets
    ADD CONSTRAINT event_budgets_pkey PRIMARY KEY (id);


--
-- Name: event_gift_batches event_gift_batches_pkey; Type: CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.event_gift_batches
    ADD CONSTRAINT event_gift_batches_pkey PRIMARY KEY (id);


--
-- Name: event_gift_redemptions event_gift_redemptions_pkey; Type: CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.event_gift_redemptions
    ADD CONSTRAINT event_gift_redemptions_pkey PRIMARY KEY (id);


--
-- Name: event_metrics event_metrics_event_id_key; Type: CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.event_metrics
    ADD CONSTRAINT event_metrics_event_id_key UNIQUE (event_id);


--
-- Name: event_metrics event_metrics_pkey; Type: CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.event_metrics
    ADD CONSTRAINT event_metrics_pkey PRIMARY KEY (id);


--
-- Name: event_nominations event_nominations_pkey; Type: CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.event_nominations
    ADD CONSTRAINT event_nominations_pkey PRIMARY KEY (id);


--
-- Name: event_participants event_participants_event_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.event_participants
    ADD CONSTRAINT event_participants_event_id_user_id_key UNIQUE (event_id, user_id);


--
-- Name: event_participants event_participants_pkey; Type: CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.event_participants
    ADD CONSTRAINT event_participants_pkey PRIMARY KEY (id);


--
-- Name: event_team_members event_team_members_pkey; Type: CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.event_team_members
    ADD CONSTRAINT event_team_members_pkey PRIMARY KEY (id);


--
-- Name: event_teams event_teams_pkey; Type: CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.event_teams
    ADD CONSTRAINT event_teams_pkey PRIMARY KEY (id);


--
-- Name: events events_pkey; Type: CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_pkey PRIMARY KEY (id);


--
-- Name: feed feed_pkey; Type: CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.feed
    ADD CONSTRAINT feed_pkey PRIMARY KEY (id);


--
-- Name: lead_budgets lead_budgets_department_budget_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.lead_budgets
    ADD CONSTRAINT lead_budgets_department_budget_id_user_id_key UNIQUE (department_budget_id, user_id);


--
-- Name: lead_budgets lead_budgets_pkey; Type: CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.lead_budgets
    ADD CONSTRAINT lead_budgets_pkey PRIMARY KEY (id);


--
-- Name: master_budget_ledger master_budget_ledger_pkey; Type: CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.master_budget_ledger
    ADD CONSTRAINT master_budget_ledger_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: otp_tokens otp_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.otp_tokens
    ADD CONSTRAINT otp_tokens_pkey PRIMARY KEY (id);


--
-- Name: platform_metrics platform_metrics_pkey; Type: CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.platform_metrics
    ADD CONSTRAINT platform_metrics_pkey PRIMARY KEY (id);


--
-- Name: recognition_comments recognition_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.recognition_comments
    ADD CONSTRAINT recognition_comments_pkey PRIMARY KEY (id);


--
-- Name: recognition_reactions recognition_reactions_pkey; Type: CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.recognition_reactions
    ADD CONSTRAINT recognition_reactions_pkey PRIMARY KEY (id);


--
-- Name: recognition_reactions recognition_reactions_recognition_id_user_id_reaction_type_key; Type: CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.recognition_reactions
    ADD CONSTRAINT recognition_reactions_recognition_id_user_id_reaction_type_key UNIQUE (recognition_id, user_id, reaction_type);


--
-- Name: recognitions recognitions_pkey; Type: CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.recognitions
    ADD CONSTRAINT recognitions_pkey PRIMARY KEY (id);


--
-- Name: redemptions redemptions_pkey; Type: CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.redemptions
    ADD CONSTRAINT redemptions_pkey PRIMARY KEY (id);


--
-- Name: system_admins system_admins_pkey; Type: CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.system_admins
    ADD CONSTRAINT system_admins_pkey PRIMARY KEY (admin_id);


--
-- Name: system_admins system_admins_user_id_key; Type: CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.system_admins
    ADD CONSTRAINT system_admins_user_id_key UNIQUE (user_id);


--
-- Name: tenant_analytics tenant_analytics_pkey; Type: CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.tenant_analytics
    ADD CONSTRAINT tenant_analytics_pkey PRIMARY KEY (id);


--
-- Name: tenant_analytics tenant_analytics_tenant_id_period_type_period_start_key; Type: CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.tenant_analytics
    ADD CONSTRAINT tenant_analytics_tenant_id_period_type_period_start_key UNIQUE (tenant_id, period_type, period_start);


--
-- Name: tenant_vouchers tenant_vouchers_pkey; Type: CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.tenant_vouchers
    ADD CONSTRAINT tenant_vouchers_pkey PRIMARY KEY (id);


--
-- Name: tenant_vouchers tenant_vouchers_tenant_id_voucher_id_key; Type: CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.tenant_vouchers
    ADD CONSTRAINT tenant_vouchers_tenant_id_voucher_id_key UNIQUE (tenant_id, voucher_id);


--
-- Name: tenants tenants_domain_key; Type: CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_domain_key UNIQUE (domain);


--
-- Name: tenants tenants_pkey; Type: CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_pkey PRIMARY KEY (id);


--
-- Name: tenants tenants_slug_key; Type: CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_slug_key UNIQUE (slug);


--
-- Name: user_upload_staging user_upload_staging_pkey; Type: CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.user_upload_staging
    ADD CONSTRAINT user_upload_staging_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_tenant_id_corporate_email_key; Type: CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_tenant_id_corporate_email_key UNIQUE (tenant_id, corporate_email);


--
-- Name: vouchers vouchers_pkey; Type: CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.vouchers
    ADD CONSTRAINT vouchers_pkey PRIMARY KEY (id);


--
-- Name: wallet_ledger wallet_ledger_pkey; Type: CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.wallet_ledger
    ADD CONSTRAINT wallet_ledger_pkey PRIMARY KEY (id);


--
-- Name: wallets wallets_pkey; Type: CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.wallets
    ADD CONSTRAINT wallets_pkey PRIMARY KEY (id);


--
-- Name: wallets wallets_user_id_key; Type: CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.wallets
    ADD CONSTRAINT wallets_user_id_key UNIQUE (user_id);


--
-- Name: idx_audit_log_actor; Type: INDEX; Schema: public; Owner: sparknode
--

CREATE INDEX idx_audit_log_actor ON public.audit_log USING btree (actor_id, created_at DESC);


--
-- Name: idx_audit_log_tenant; Type: INDEX; Schema: public; Owner: sparknode
--

CREATE INDEX idx_audit_log_tenant ON public.audit_log USING btree (tenant_id, created_at DESC);


--
-- Name: idx_event_participants; Type: INDEX; Schema: public; Owner: sparknode
--

CREATE INDEX idx_event_participants ON public.event_participants USING btree (event_id, status);


--
-- Name: idx_events_tenant; Type: INDEX; Schema: public; Owner: sparknode
--

CREATE INDEX idx_events_tenant ON public.events USING btree (tenant_id, status, start_datetime);


--
-- Name: idx_feed_tenant_created; Type: INDEX; Schema: public; Owner: sparknode
--

CREATE INDEX idx_feed_tenant_created ON public.feed USING btree (tenant_id, created_at DESC);


--
-- Name: idx_notifications_user; Type: INDEX; Schema: public; Owner: sparknode
--

CREATE INDEX idx_notifications_user ON public.notifications USING btree (user_id, is_read, created_at DESC);


--
-- Name: idx_otp_tokens_user_channel; Type: INDEX; Schema: public; Owner: sparknode
--

CREATE INDEX idx_otp_tokens_user_channel ON public.otp_tokens USING btree (user_id, channel);


--
-- Name: idx_tenant_analytics; Type: INDEX; Schema: public; Owner: sparknode
--

CREATE INDEX idx_tenant_analytics ON public.tenant_analytics USING btree (tenant_id, period_type, period_start);


--
-- Name: idx_user_upload_staging_batch; Type: INDEX; Schema: public; Owner: sparknode
--

CREATE INDEX idx_user_upload_staging_batch ON public.user_upload_staging USING btree (batch_id);


--
-- Name: idx_users_tenant_corporate_email; Type: INDEX; Schema: public; Owner: sparknode
--

CREATE UNIQUE INDEX idx_users_tenant_corporate_email ON public.users USING btree (tenant_id, corporate_email);


--
-- Name: idx_wallet_ledger_created_at; Type: INDEX; Schema: public; Owner: sparknode
--

CREATE INDEX idx_wallet_ledger_created_at ON public.wallet_ledger USING btree (created_at);


--
-- Name: idx_wallet_ledger_wallet_id; Type: INDEX; Schema: public; Owner: sparknode
--

CREATE INDEX idx_wallet_ledger_wallet_id ON public.wallet_ledger USING btree (wallet_id);


--
-- Name: activity_participants activity_participants_activity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.activity_participants
    ADD CONSTRAINT activity_participants_activity_id_fkey FOREIGN KEY (activity_id) REFERENCES public.event_activities(id) ON DELETE CASCADE;


--
-- Name: activity_participants activity_participants_event_participant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.activity_participants
    ADD CONSTRAINT activity_participants_event_participant_id_fkey FOREIGN KEY (event_participant_id) REFERENCES public.event_participants(id) ON DELETE CASCADE;


--
-- Name: activity_participants activity_participants_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.activity_participants
    ADD CONSTRAINT activity_participants_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: audit_log audit_log_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: badges badges_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.badges
    ADD CONSTRAINT badges_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: budgets budgets_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.budgets
    ADD CONSTRAINT budgets_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: budgets budgets_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.budgets
    ADD CONSTRAINT budgets_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: department_budgets department_budgets_budget_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.department_budgets
    ADD CONSTRAINT department_budgets_budget_id_fkey FOREIGN KEY (budget_id) REFERENCES public.budgets(id) ON DELETE CASCADE;


--
-- Name: department_budgets department_budgets_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.department_budgets
    ADD CONSTRAINT department_budgets_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE CASCADE;


--
-- Name: department_budgets department_budgets_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.department_budgets
    ADD CONSTRAINT department_budgets_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: departments departments_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.departments(id);


--
-- Name: departments departments_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: event_activities event_activities_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.event_activities
    ADD CONSTRAINT event_activities_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;


--
-- Name: event_activities event_activities_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.event_activities
    ADD CONSTRAINT event_activities_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: event_budgets event_budgets_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.event_budgets
    ADD CONSTRAINT event_budgets_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;


--
-- Name: event_budgets event_budgets_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.event_budgets
    ADD CONSTRAINT event_budgets_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: event_gift_batches event_gift_batches_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.event_gift_batches
    ADD CONSTRAINT event_gift_batches_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;


--
-- Name: event_gift_batches event_gift_batches_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.event_gift_batches
    ADD CONSTRAINT event_gift_batches_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: event_gift_redemptions event_gift_redemptions_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.event_gift_redemptions
    ADD CONSTRAINT event_gift_redemptions_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;


--
-- Name: event_gift_redemptions event_gift_redemptions_gift_batch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.event_gift_redemptions
    ADD CONSTRAINT event_gift_redemptions_gift_batch_id_fkey FOREIGN KEY (gift_batch_id) REFERENCES public.event_gift_batches(id) ON DELETE CASCADE;


--
-- Name: event_gift_redemptions event_gift_redemptions_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.event_gift_redemptions
    ADD CONSTRAINT event_gift_redemptions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: event_gift_redemptions event_gift_redemptions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.event_gift_redemptions
    ADD CONSTRAINT event_gift_redemptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: event_metrics event_metrics_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.event_metrics
    ADD CONSTRAINT event_metrics_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;


--
-- Name: event_metrics event_metrics_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.event_metrics
    ADD CONSTRAINT event_metrics_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: event_nominations event_nominations_activity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.event_nominations
    ADD CONSTRAINT event_nominations_activity_id_fkey FOREIGN KEY (activity_id) REFERENCES public.event_activities(id) ON DELETE CASCADE;


--
-- Name: event_nominations event_nominations_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.event_nominations
    ADD CONSTRAINT event_nominations_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: event_nominations event_nominations_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.event_nominations
    ADD CONSTRAINT event_nominations_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;


--
-- Name: event_nominations event_nominations_nominee_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.event_nominations
    ADD CONSTRAINT event_nominations_nominee_user_id_fkey FOREIGN KEY (nominee_user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: event_nominations event_nominations_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.event_nominations
    ADD CONSTRAINT event_nominations_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id);


--
-- Name: event_nominations event_nominations_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.event_nominations
    ADD CONSTRAINT event_nominations_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.event_teams(id) ON DELETE SET NULL;


--
-- Name: event_nominations event_nominations_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.event_nominations
    ADD CONSTRAINT event_nominations_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: event_participants event_participants_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.event_participants
    ADD CONSTRAINT event_participants_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id);


--
-- Name: event_participants event_participants_checked_in_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.event_participants
    ADD CONSTRAINT event_participants_checked_in_by_fkey FOREIGN KEY (checked_in_by) REFERENCES public.users(id);


--
-- Name: event_participants event_participants_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.event_participants
    ADD CONSTRAINT event_participants_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;


--
-- Name: event_participants event_participants_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.event_participants
    ADD CONSTRAINT event_participants_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: event_participants event_participants_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.event_participants
    ADD CONSTRAINT event_participants_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: event_team_members event_team_members_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.event_team_members
    ADD CONSTRAINT event_team_members_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.event_teams(id) ON DELETE CASCADE;


--
-- Name: event_team_members event_team_members_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.event_team_members
    ADD CONSTRAINT event_team_members_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: event_team_members event_team_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.event_team_members
    ADD CONSTRAINT event_team_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: event_teams event_teams_activity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.event_teams
    ADD CONSTRAINT event_teams_activity_id_fkey FOREIGN KEY (activity_id) REFERENCES public.event_activities(id) ON DELETE CASCADE;


--
-- Name: event_teams event_teams_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.event_teams
    ADD CONSTRAINT event_teams_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;


--
-- Name: event_teams event_teams_leader_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.event_teams
    ADD CONSTRAINT event_teams_leader_user_id_fkey FOREIGN KEY (leader_user_id) REFERENCES public.users(id);


--
-- Name: event_teams event_teams_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.event_teams
    ADD CONSTRAINT event_teams_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: events events_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: events events_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: feed feed_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.feed
    ADD CONSTRAINT feed_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.users(id);


--
-- Name: feed feed_target_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.feed
    ADD CONSTRAINT feed_target_id_fkey FOREIGN KEY (target_id) REFERENCES public.users(id);


--
-- Name: feed feed_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.feed
    ADD CONSTRAINT feed_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: lead_budgets lead_budgets_department_budget_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.lead_budgets
    ADD CONSTRAINT lead_budgets_department_budget_id_fkey FOREIGN KEY (department_budget_id) REFERENCES public.department_budgets(id) ON DELETE CASCADE;


--
-- Name: lead_budgets lead_budgets_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.lead_budgets
    ADD CONSTRAINT lead_budgets_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: lead_budgets lead_budgets_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.lead_budgets
    ADD CONSTRAINT lead_budgets_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: master_budget_ledger master_budget_ledger_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.master_budget_ledger
    ADD CONSTRAINT master_budget_ledger_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: master_budget_ledger master_budget_ledger_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.master_budget_ledger
    ADD CONSTRAINT master_budget_ledger_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: otp_tokens otp_tokens_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.otp_tokens
    ADD CONSTRAINT otp_tokens_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: otp_tokens otp_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.otp_tokens
    ADD CONSTRAINT otp_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: recognition_comments recognition_comments_recognition_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.recognition_comments
    ADD CONSTRAINT recognition_comments_recognition_id_fkey FOREIGN KEY (recognition_id) REFERENCES public.recognitions(id) ON DELETE CASCADE;


--
-- Name: recognition_comments recognition_comments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.recognition_comments
    ADD CONSTRAINT recognition_comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: recognition_reactions recognition_reactions_recognition_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.recognition_reactions
    ADD CONSTRAINT recognition_reactions_recognition_id_fkey FOREIGN KEY (recognition_id) REFERENCES public.recognitions(id) ON DELETE CASCADE;


--
-- Name: recognition_reactions recognition_reactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.recognition_reactions
    ADD CONSTRAINT recognition_reactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: recognitions recognitions_badge_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.recognitions
    ADD CONSTRAINT recognitions_badge_id_fkey FOREIGN KEY (badge_id) REFERENCES public.badges(id);


--
-- Name: recognitions recognitions_department_budget_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.recognitions
    ADD CONSTRAINT recognitions_department_budget_id_fkey FOREIGN KEY (department_budget_id) REFERENCES public.department_budgets(id);


--
-- Name: recognitions recognitions_from_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.recognitions
    ADD CONSTRAINT recognitions_from_user_id_fkey FOREIGN KEY (from_user_id) REFERENCES public.users(id);


--
-- Name: recognitions recognitions_lead_budget_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.recognitions
    ADD CONSTRAINT recognitions_lead_budget_id_fkey FOREIGN KEY (lead_budget_id) REFERENCES public.lead_budgets(id);


--
-- Name: recognitions recognitions_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.recognitions
    ADD CONSTRAINT recognitions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: recognitions recognitions_to_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.recognitions
    ADD CONSTRAINT recognitions_to_user_id_fkey FOREIGN KEY (to_user_id) REFERENCES public.users(id);


--
-- Name: redemptions redemptions_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.redemptions
    ADD CONSTRAINT redemptions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: redemptions redemptions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.redemptions
    ADD CONSTRAINT redemptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: redemptions redemptions_voucher_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.redemptions
    ADD CONSTRAINT redemptions_voucher_id_fkey FOREIGN KEY (voucher_id) REFERENCES public.vouchers(id);


--
-- Name: system_admins system_admins_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.system_admins
    ADD CONSTRAINT system_admins_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: tenant_analytics tenant_analytics_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.tenant_analytics
    ADD CONSTRAINT tenant_analytics_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: tenant_vouchers tenant_vouchers_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.tenant_vouchers
    ADD CONSTRAINT tenant_vouchers_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: tenant_vouchers tenant_vouchers_voucher_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.tenant_vouchers
    ADD CONSTRAINT tenant_vouchers_voucher_id_fkey FOREIGN KEY (voucher_id) REFERENCES public.vouchers(id) ON DELETE CASCADE;


--
-- Name: user_upload_staging user_upload_staging_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.user_upload_staging
    ADD CONSTRAINT user_upload_staging_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: users users_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: users users_manager_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES public.users(id);


--
-- Name: users users_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: vouchers vouchers_brand_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.vouchers
    ADD CONSTRAINT vouchers_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES public.brands(id) ON DELETE CASCADE;


--
-- Name: wallet_ledger wallet_ledger_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.wallet_ledger
    ADD CONSTRAINT wallet_ledger_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: wallet_ledger wallet_ledger_wallet_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.wallet_ledger
    ADD CONSTRAINT wallet_ledger_wallet_id_fkey FOREIGN KEY (wallet_id) REFERENCES public.wallets(id) ON DELETE CASCADE;


--
-- Name: wallets wallets_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.wallets
    ADD CONSTRAINT wallets_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: wallets wallets_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sparknode
--

ALTER TABLE ONLY public.wallets
    ADD CONSTRAINT wallets_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict rM8JVybakE3IWXOaTezYuhEZCQnh90NB3Os4XEfItYIqHxc0hZfUXNrbm7tcIed

