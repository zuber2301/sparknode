# NodeSpark — Full Feature Catalog & Implementation Details

This document is a **complete, module-by-module implementation reference** for NodeSpark. Each feature includes:
- **Frontend** implementation (React components/pages/hooks/services)
- **Backend** implementation (FastAPI routers, schemas, services)
- **Database schema** (tables, columns, relationships, constraints)

> Scope: based on current repository state and phase documentation (Phase 1–6).

---

## 0) System Foundations

### 0.1 Architecture Overview
- **Frontend**: React + Vite, TailwindCSS, CSS variables for theming.
- **Backend**: FastAPI, SQLAlchemy ORM, Alembic migrations.
- **Database**: PostgreSQL (prod/dev via Docker), SQLite (tests).
- **Multi-tenancy**: Enforced via `tenant_id` on most domain tables (see TenantMixin).

### 0.2 Shared Database Mixins
**File**: `backend/app/db/base.py`

- **TenantMixin**
  - `tenant_id` (String(36), indexed, required)
  - Used across most feature tables to enforce tenant isolation.

- **TimestampMixin**
  - `created_at` (DateTime, server_default=now)
  - `created_by` (String(36), nullable)

- **SoftDeleteMixin**
  - `deleted` (Boolean, server_default=false)

---

## 1) Authentication & Session Management

### 1.1 Overview
Provides JWT-based authentication, Google OAuth, dev login and user impersonation.

### 1.2 Frontend
- Login and OAuth entry points are wired through app routes and API client.
- Dev persona switching helper:
  - `frontend/src/components/DevPersonaSwitcher.jsx`

### 1.3 Backend
**Router**: `backend/app/api/auth.py`

Key endpoints (see `ENDPOINTS_NodeSpark.md`):
- `GET /auth/health` — health check
- `POST /auth/login` — username/password login
- `GET /auth/google` — OAuth redirect
- `GET /auth/callback` — OAuth callback
- `POST /auth/dev-login` — dev login
- `GET /auth/dev-token` — dev JWT
- `POST /auth/impersonate/{user_id}` — admin impersonation

**Config**: `backend/app/core/config.py`
- JWT secret, algorithm, token lifetime
- Google OAuth client settings
- Frontend redirect URL

### 1.4 Database
Auth relies on `users` table (see User Management). OAuth users store `hashed_password = NULL`.

---

## 2) Multi-Tenancy & Roles

### 2.1 Overview
Every tenant (company) is isolated by `tenant_id`. Roles gate access:
- `SUPER_ADMIN`, `PLATFORM_OWNER`, `TENANT_ADMIN`, `TENANT_LEAD`, `CORPORATE_USER`

### 2.2 Frontend
Role-gated views and dashboards:
- Platform admin: `frontend/src/features/admin/PlatformAdminPage.jsx`
- Tenant admin: `frontend/src/features/admin/TenantAdminBudget.jsx`, `TenantManagerPage.jsx`
- Tenant lead: `frontend/src/features/admin/TenantLeadDashboard.jsx`
- Corporate user: `frontend/src/features/admin/CorporateUserDashboard.jsx`

### 2.3 Backend
Role checks enforced in route dependencies and service methods across routers:
- `platform_admin.py`, `tenant_admin.py`, `tenant_lead.py`, `corporate_user.py`

### 2.4 Database
Role stored in `users.role` (ENUM `userrole`).

---

## 3) User Management

### 3.1 Overview
User records include role, department, job info, budgets and points balance.

### 3.2 Frontend
- Tenant user management and admin actions:
  - `frontend/src/features/admin/TenantManagerPage.jsx`
  - `frontend/src/components/TenantManager.jsx`
- User search/selection:
  - `frontend/src/components/TenantSelector.jsx`

### 3.3 Backend
**Router**: `backend/app/api/tenant_admin.py` and `backend/app/api/corporate_user.py`

Key endpoints (from `ENDPOINTS_NodeSpark.md`):
- `GET /user/search`
- `GET /user/points`
- `GET /tenant/users`
- `PATCH /tenant/users/{user_id}/role`

### 3.4 Database
**Table**: `users`
- `id` (PK)
- `tenant_id` (FK → tenants.id, nullable for platform admins, indexed)
- `email` (unique, indexed)
- `hashed_password` (nullable)
- `full_name`
- `role` (ENUM userrole)
- `department`, `job_title`, `date_of_birth`, `hire_date`
- `avatar_url`
- `points_balance` (int, default 0)
- `lead_budget_balance` (bigint, default 0)
- `is_active` (bool)

---

## 4) Tenant Management

### 4.1 Overview
Tenants (companies) are onboarded by platform admins. Each tenant has branding, feature flags, and a master budget balance.

### 4.2 Frontend
- Tenant onboarding UI:
  - `frontend/src/components/OnboardTenantModal.jsx`
  - `frontend/src/components/OnboardTenantDrawer.jsx`
  - `frontend/src/features/admin/CreateTenantForm.jsx`
- Tenant listing/management:
  - `frontend/src/features/admin/TenantManagerPage.jsx`
  - `frontend/src/features/tenant/TenantsPage.jsx`

### 4.3 Backend
**Router**: `backend/app/api/platform_admin.py`, `backend/app/api/tenant_admin.py`

Key endpoints (from `ENDPOINTS_NodeSpark.md`):
- `GET /platform/tenants`
- `POST /platform/tenants`
- `POST /platform/tenants/{tenant_id}/suspend`
- `POST /platform/tenants/{tenant_id}/unsuspend`
- `GET /platform/tenants/{tenant_id}/feature_flags`
- `PATCH /platform/tenants/{tenant_id}/feature_flags`

### 4.4 Database
**Table**: `tenants`
- `id` (PK)
- `name`
- `subdomain` (unique)
- `master_budget_balance` (bigint)
- `logo_url`
- `status` (string)
- `suspended` (bool), `suspended_at`, `suspended_reason`
- `industry`, `credit_limit`, `last_billing_date`
- `feature_flags` (JSON)

---

## 5) Recognition System (Core)

### 5.1 Overview
Core peer recognition: nominate, approve, and publish recognitions to a social feed. Supports badges, e-cards, and media.

### 5.2 Frontend
Feature folder: `frontend/src/features/recognition/`
- `RecognitionPage.jsx`, `RecognitionList.jsx`
- `NominateModal.jsx`, `GroupAwardModal.jsx`, `GroupAwardWizard.jsx`
- Supporting UI in `RecognitionFeed.jsx` (components)
- API helper: `frontend/src/features/recognition/api.js`

Feed widgets:
- `frontend/src/components/RecognitionFeed.jsx`
- `frontend/src/components/LiveAnnouncer.jsx`

### 5.3 Backend
**Router**: `backend/app/api/recognition.py`

Key endpoints (from `ENDPOINTS_NodeSpark.md`):
- `GET /recognition/`
- `POST /recognition/`
- `GET /recognition/feed`
- `POST /recognition/give-check`
- `POST /recognition/{rec_id}/approve`
- `POST /recognition/{recognition_id}/high-five`
- `POST /recognition/uploads`
- `POST /recognition/coach`

### 5.4 Database
**Table**: `recognitions`
- `id` (PK)
- `tenant_id` (TenantMixin)
- `nominator_id` (FK → users.id)
- `nominee_id` (FK → users.id)
- `badge_id` (FK → badges.id, nullable)
- `value_tag`, `area_of_focus`, `message`, `media_url`
- `points`, `points_awarded`
- `is_public` (bool)
- `status` (ENUM recognitionstatus: PENDING, APPROVED)
- `award_category` (ENUM awardcategory: GOLD/SILVER/BRONZE/ECARD)
- `high_five_count`
- `ecard_design`, `ecard_url`

---

## 6) Rewards & Redemptions

### 6.1 Overview
Users redeem points for rewards. Rewards can be tenant-specific or from a global catalog.

### 6.2 Frontend
Feature folder: `frontend/src/features/rewards/`
- `RewardsPage.jsx`
- `RedemptionModal.jsx`

Global catalog UI:
- `frontend/src/components/GlobalCatalog.jsx`
- `frontend/src/components/RedemptionWorkflow.jsx`
- `frontend/src/components/MyWallet.jsx`

### 6.3 Backend
**Router**: `backend/app/api/rewards.py`

Key endpoints (from `ENDPOINTS_NodeSpark.md`):
- `GET /rewards/`
- `POST /rewards/`
- `POST /rewards/{reward_id}/redeem`
- `POST /rewards/verify-redeem`
- `GET /user/rewards`
- `GET /user/redemptions`

### 6.4 Database
**Table**: `rewards`
- `id` (PK)
- `tenant_id` (TenantMixin)
- `name`, `description`
- `cost_points`
- `provider`
- `metadata_json` (JSON)
- `is_active` (bool)

**Table**: `global_rewards`
- `id` (PK)
- `title`
- `provider`
- `points_cost`
- `is_enabled`

**Table**: `redemptions`
- `id` (PK)
- `tenant_id` (TenantMixin)
- `user_id` (FK → users.id)
- `reward_id` (FK → global_rewards.id)
- `points_used`
- `status` (ENUM redemptionstatus: PENDING/COMPLETED/FAILED)
- `completed_at`
- `gross_value_paise`, `margin_paise`, `vendor_cost_paise`
- `provider_name`

**Table**: `global_providers`
- `id` (PK)
- `name` (unique)
- `enabled`
- `min_plan` (minimum subscription tier)
- `margin_paise`

---

## 7) Badges

### 7.1 Overview
Badges are digital awards associated with recognitions. They can be global or tenant-specific.

### 7.2 Frontend
- `frontend/src/components/RecognitionFeed.jsx` (badge display)
- Badge management is typically tenant admin UI.

### 7.3 Backend
**Router**: `backend/app/api/badges.py`

Key endpoints:
- `GET /badges/`
- `POST /badges/`
- `GET /badges/{badge_id}`
- `PATCH /badges/{badge_id}`
- `DELETE /badges/{badge_id}`

### 7.4 Database
**Table**: `badges`
- `id` (PK)
- `tenant_id` (nullable for global badge)
- `name`
- `icon_url`
- `points_value`
- `category`

---

## 8) Milestones & Anniversaries

### 8.1 Overview
Tracks user milestones (e.g., birthdays, anniversaries) for automated recognition.

### 8.2 Frontend
- `frontend/src/components/MilestoneBanner.jsx`

### 8.3 Backend
**Router**: `backend/app/api/milestones.py`

### 8.4 Database
**Table**: `milestones`
- `id` (PK)
- `tenant_id` (TenantMixin)
- `user_id` (indexed)
- `type` (string)
- `occurrence_date` (date)
- `points_processed` (bool)

---

## 9) Budgeting & Points System

### 9.1 Overview
Budget flow across platform, tenant, lead, and user levels. Supports allocations, audit logs, and points ledger.

### 9.2 Frontend
Admin and lead budget management:
- `frontend/src/features/admin/BudgetsPage.jsx`
- `frontend/src/components/LoadBudgetModal.jsx`
- `frontend/src/components/BudgetLoadLogs.jsx`
- `frontend/src/components/LeadBudgetTable.jsx`
- `frontend/src/components/LeadAllocationTable.jsx`
- `frontend/src/components/CompactBudgetCard.jsx`

User wallet and points:
- `frontend/src/components/MyWallet.jsx`
- `frontend/src/features/dashboard/PointsBalance.jsx`

### 9.3 Backend
**Routers**: `backend/app/api/tenant_admin.py`, `backend/app/api/tenant_lead.py`, `backend/app/api/platform_admin.py`

Key endpoints (from `ENDPOINTS_NodeSpark.md`):
- `GET /tenant/budget`
- `POST /tenant/budget/load`
- `POST /tenant/budget/allocate`
- `GET /tenant/budget/logs`
- `GET /tenant/budget/logs/{log_id}`
- `GET /lead/budget`
- `POST /lead/recognize`

### 9.4 Database
**Table**: `budget_pools`
- `id` (PK)
- `tenant_id` (TenantMixin)
- `period`
- `total_amount`
- `created_by` (FK → users.id)

**Table**: `department_budgets`
- `id` (PK)
- `tenant_id` (TenantMixin)
- `budget_pool_id` (FK → budget_pools.id)
- `department_id`
- `allocated_amount`
- `used_amount`

**Table**: `budget_ledger`
- `id` (PK)
- `tenant_id` (TenantMixin)
- `department_id`
- `delta_amount` (positive allocation, negative usage)
- `reason` (ALLOCATION / RECOGNITION)
- `reference_id`

**Table**: `tenant_budgets`
- `id` (PK)
- `tenant_id` (FK → tenants.id, unique)
- `total_loaded_paise`
- `total_consumed_paise`
- Derived: `balance_paise = total_loaded_paise - total_consumed_paise`

**Table**: `budget_load_logs`
- `id` (PK)
- `platform_owner_id` (FK → users.id)
- `tenant_id` (FK → tenants.id)
- `amount` (Numeric(15,2))
- `transaction_type` (default DEPOSIT)

**Table**: `transactions`
- `id` (PK)
- `tenant_id` (FK → tenants.id)
- `sender_id`, `receiver_id` (FK → users.id)
- `amount` (bigint)
- `type` (ENUM transactiontype: LOAD/ALLOCATE/RECOGNITION/REDEMPTION)
- `note` (text)

**Table**: `points_ledger`
- `id` (PK)
- `tenant_id` (TenantMixin)
- `user_id` (FK → users.id)
- `delta` (int)
- `reason` (text)
- `reference_id`

---

## 10) Subscriptions & Plans

### 10.1 Overview
Platform supports subscription plans that control access to providers and features.

### 10.2 Frontend
- `frontend/src/features/admin/SubscriptionEngine.jsx`
- `frontend/src/features/admin/PlatformCatalog.jsx`

### 10.3 Backend
**Router**: `backend/app/api/platform_admin.py`

### 10.4 Database
**Table**: `subscription_plans`
- `id` (PK, autoincrement)
- `name`
- `monthly_price_in_paise`
- `features` (JSON)

**Table**: `tenant_subscriptions`
- `tenant_id` (PK, FK → tenants.id)
- `plan_id` (PK, FK → subscription_plans.id)
- `start_date`, `expiry_date`
- `is_active`

---

## 11) Platform Administration & Audit

### 11.1 Overview
Platform-level dashboards, tenant insights analytics, and audit logs.

### 11.2 Frontend
Platform admin pages:
- `frontend/src/features/admin/PlatformAdminPage.jsx`
- `frontend/src/components/TenantActivityDashboard.jsx`
- `frontend/src/components/TenantSelector.jsx`

### 11.3 Backend
**Router**: `backend/app/api/platform_admin.py`

Notable endpoint:
- `GET /platform/tenant-insights/{tenant_id}` (see `API_ENDPOINT_REFERENCE.md`)

### 11.4 Database
**Table**: `platform_audit_logs`
- `id` (PK, autoincrement)
- `admin_id`
- `action`
- `target_tenant_id`
- `details` (JSON)
- `created_at`

**Table**: `platform_settings`
- `id` (PK)
- `policies` (JSON)

---

## 12) Dashboards & Analytics (Tenant)

### 12.1 Overview
Tenant admins and leads view recognition activity, budgets, and engagement KPIs.

### 12.2 Frontend
Feature folder: `frontend/src/features/dashboard/`
- `DashboardPage.jsx`
- `RecognitionFeed.jsx`, `RecentRecognitions.jsx`
- `PointsBalance.jsx`
- `TenantMicroView.jsx`

Additional visual analytics components:
- `frontend/src/components/AnalyticsDashboard.jsx`
- `frontend/src/components/RecognitionChart.jsx`
- `frontend/src/components/BudgetBurnChart.jsx`
- `frontend/src/components/DepartmentHeatmap.jsx`

### 12.3 Backend
**Routers**: `backend/app/api/dashboard.py`, `backend/app/api/admin_dashboard.py`, `backend/app/api/analytics.py`

### 12.4 Database
Analytics derived from:
- `recognitions`, `users`, `tenants`, `transactions`, `budget_*` tables

---

## 13) Event Management (Phase 1: Event Budget System)

### 13.1 Overview
Event creation, options/inventory, registrations, and budget variance tracking.

### 13.2 Frontend
Event management UI is provided through Event Studio (Phase 2) and event-focused dashboards.

### 13.3 Backend
**Router**: `backend/app/api/events.py`

Key endpoints (Phase 1):
- Event CRUD (POST/GET/PUT/DELETE)
- Options (create/list)
- Registrations (create/list/update)
- Analytics (budget variance, conflict checks)

**Service**: `backend/app/services/event_service.py`
- Budget variance calculations
- Conflict detection
- Budget and inventory commitment updates

### 13.4 Database
**Table**: `events`
- `id` (PK)
- `tenant_id` (TenantMixin)
- `name`, `description`
- `event_type` (ENUM event_type: ANNUAL_DAY/GIFTING)
- `event_budget_amount` (Numeric(12,2))
- `budget_committed` (Numeric(12,2))
- `event_date`, `registration_start_date`, `registration_end_date`
- `is_active` (int)
- `created_by` (FK → users.id)

**Table**: `event_options`
- `id` (PK)
- `tenant_id` (TenantMixin)
- `event_id` (FK → events.id)
- `option_name`, `option_type`, `description`
- `total_available`, `committed_count`
- `cost_per_unit` (Numeric(10,2))
- `gift_image_url` (string, Phase 2)
- `is_active` (int)

**Table**: `event_registrations`
- `id` (PK)
- `tenant_id` (TenantMixin)
- `event_id` (FK → events.id)
- `user_id` (FK → users.id)
- `event_option_id` (FK → event_options.id)
- `status` (ENUM registration_status: PENDING/APPROVED/REJECTED/CANCELLED)
- `qr_token` (unique)
- `preferred_pickup_slot`, `assigned_pickup_slot`
- `amount_committed` (Numeric(12,2))
- `notes`
- `approved_at`, `approved_by` (FK → users.id)

---

## 14) Event Studio Wizard (Phase 2)

### 14.1 Overview
Multi-step event creation wizard supporting two modes:
- **Annual Day** (performance tracks + volunteer tasks)
- **Gifting** (gift catalog + pickup scheduling)

### 14.2 Frontend
Main wizard:
- `frontend/src/components/EventStudio/EventStudioWizard.jsx`

Steps:
- `EventStudio/steps/BudgetStep.jsx`
- `EventStudio/steps/BasicInfoStep.jsx`
- `EventStudio/steps/OptionsStep.jsx`
- `EventStudio/steps/SchedulingStep.jsx` (Gifting only)
- `EventStudio/steps/ReviewStep.jsx`

State & API:
- `frontend/src/hooks/useEventWizardForm.js`
- `frontend/src/services/eventWizardAPI.js`

### 14.3 Backend
**Router**: `backend/app/api/event_studio.py`

**Schemas**: `backend/app/schemas/event_wizard.py` (25+ models)
- Validates each step separately

**Service**: `backend/app/services/scheduling_engine.py`
- Generates pickup time slots

### 14.4 Database
Uses Phase 1 tables plus **Phase 2 additions**:

**Table**: `event_pickup_locations`
- `id` (PK)
- `tenant_id` (TenantMixin)
- `event_id` (FK → events.id)
- `location_name`, `location_code`, `description`
- `floor_number`, `building`
- `capacity`
- `is_active`

**Table**: `event_time_slots`
- `id` (PK)
- `tenant_id` (TenantMixin)
- `event_id` (FK → events.id)
- `location_id` (FK → event_pickup_locations.id)
- `start_time`, `end_time`
- `slot_label`
- `capacity`, `registered_count`
- `is_active`

---

## 15) Governance Loop: Approval Requests (Phase 4)

### 15.1 Overview
Leads approve or decline event participation requests. Approval commits budget and generates QR codes.

### 15.2 Frontend
- Lead inbox UI:
  - `frontend/src/components/RequestsTab.jsx`
  - Detailed patterns documented in `REQUESTSTAB_*` docs

### 15.3 Backend
**Router**: `backend/app/api/approvals.py`

Endpoints:
- `POST /approvals/create`
- `GET /approvals/pending`
- `GET /approvals/{id}`
- `POST /approvals/{id}/approve`
- `POST /approvals/{id}/decline`
- `POST /approvals/qr/{token}/activate`

**Service**: `backend/app/services/approval_service.py`
- Creates requests, computes impact hours
- Approve/decline flow
- QR token generation

**Notifications**: `backend/app/services/notification_service.py`

### 15.4 Database
**Table**: `approval_requests`
- `id` (PK)
- `tenant_id` (TenantMixin)
- `event_id` (FK → events.id)
- `user_id` (FK → users.id)
- `event_option_id` (FK → event_options.id)
- `lead_id` (FK → users.id)
- `impact_hours_per_week`, `impact_duration_weeks`, `total_impact_hours`
- `estimated_cost`
- `status` (ENUM approval_status: PENDING/APPROVED/DECLINED/CANCELLED)
- `approved_at`, `approved_by`
- `declined_at`, `declined_by`, `decline_reason`
- `qr_token` (unique), `qr_code_url`, `qr_activated_at`
- `budget_committed` (int), `committed_at`
- `notification_sent`
- `is_collected`, `collected_at`, `collected_by`
- `request_notes`, `approval_notes`

---

## 16) Day-of-Event Scanner (Phase 5)

### 16.1 Overview
QR scanning verifies approved attendees, prevents double-collection, and tracks inventory.

### 16.2 Frontend
- `frontend/src/components/Scanner.jsx`

### 16.3 Backend
**Router**: `backend/app/api/scanner.py`

Endpoints:
- `POST /scanner/verify`
- `GET /scanner/event/{event_id}/inventory`
- `GET /scanner/event/{event_id}/collections`
- `GET /scanner/event/{event_id}/dashboard`
- WebSocket: `/scanner/ws/event/{event_id}/live` (optional)

**Service**: `backend/app/services/scanner_service.py`
- `verify_and_collect_qr()`
- inventory and history aggregation

### 16.4 Database
Reuses `approval_requests` table with Phase 5 fields:
- `is_collected` (0/1)
- `collected_at`
- `collected_by` (FK → users.id)

---

## 17) Post‑Event Analytics (Phase 6)

### 17.1 Overview
Provides ROI, attendance, budget reconciliation, and exportable reports for events.

### 17.2 Frontend
- `frontend/src/components/AnalyticsDashboard.jsx`

### 17.3 Backend
**Router**: `backend/app/api/event_analytics.py`

Endpoints:
- `GET /analytics/event/{id}/summary`
- `GET /analytics/event/{id}/timeline`
- `GET /analytics/event/{id}/roi`
- `POST /analytics/event/{id}/export`
- `GET /analytics/event/{id}/insights`

**Services**:
- `backend/app/services/analytics_service.py`
- `backend/app/services/report_service.py`

### 17.4 Database
No new tables; relies on:
- `events`, `event_options`, `approval_requests`, `users`
- Indices added in migration `0020_add_analytics_indices.py`

---

## 18) Platform Insights Analytics (Tenant Insights)

### 18.1 Overview
Platform owners can fetch deep tenant culture insights from recognition and budget data.

### 18.2 Frontend
- `frontend/src/components/TenantActivityDashboard.jsx`

### 18.3 Backend
**Router**: `backend/app/api/platform_admin.py`

Endpoint:
- `GET /platform/tenant-insights/{tenant_id}`

Implements 6+ analytics queries:
- Recognition velocity
- Dark zone detection
- Budget burn rate
- Cross-department collaboration
- Top recognition champions
- Participation rate

### 18.4 Database
Uses:
- `recognitions`, `users`, `tenants`

---

## 19) Theme System (Light Theme)

### 19.1 Overview
Theme is driven by CSS variables with Tailwind class mapping. Fully applied in RequestsTab and other components.

### 19.2 Frontend
Theme system:
- `frontend/src/index.css`
- `frontend/src/themes/`
- `frontend/src/lib/theme.js`

RequestsTab polish references:
- `REQUESTSTAB_CODE_PATTERNS.md`
- `REQUESTSTAB_REVIEW_POLISH.md`

### 19.3 Backend
No backend required.

### 19.4 Database
No database schema.

---

## 20) Testing & Quality

### 20.1 Frontend
- Unit tests in `frontend/src/**/__tests__`
- Examples: `CreateTenantForm.test.jsx`, `NominateModal.test.jsx`

### 20.2 Backend
- `backend/tests/` covers models, APIs, and tenancy
- `backend/tests/conftest.py` defines fixtures and SQLite DB

---

## 21) Feature-to-File Map (Quick Index)

### Frontend Highlights
- Recognition: `frontend/src/features/recognition/`
- Rewards: `frontend/src/features/rewards/`
- Admin: `frontend/src/features/admin/`
- Dashboard: `frontend/src/features/dashboard/`
- Analytics UI: `frontend/src/components/AnalyticsDashboard.jsx`
- Event Studio: `frontend/src/components/EventStudio/`
- Requests / Approvals: `frontend/src/components/RequestsTab.jsx`
- Scanner: `frontend/src/components/Scanner.jsx`

### Backend Highlights
- Auth: `backend/app/api/auth.py`
- Recognition: `backend/app/api/recognition.py`
- Rewards: `backend/app/api/rewards.py`
- Badges: `backend/app/api/badges.py`
- Tenant Admin: `backend/app/api/tenant_admin.py`
- Tenant Lead: `backend/app/api/tenant_lead.py`
- Platform Admin: `backend/app/api/platform_admin.py`
- Events: `backend/app/api/events.py`
- Event Studio: `backend/app/api/event_studio.py`
- Approvals: `backend/app/api/approvals.py`
- Scanner: `backend/app/api/scanner.py`
- Event Analytics: `backend/app/api/event_analytics.py`

---

## 22) Cross‑Module Data Relationships (Summary)

- **Tenants** ⟶ Users, Recognitions, Rewards, Budgets, Events, Approvals, Redemptions
- **Users** ⟶ Recognitions (nominator/nominee), Approvals (requester/lead), Redemptions, Points Ledger
- **Events** ⟶ EventOptions, EventRegistrations, PickupLocations, TimeSlots, ApprovalRequests
- **Approvals** ⟶ Scanner collection, Event Analytics metrics
- **Budgets** ⟶ Allocations (tenant → lead), Recognitions, Redemptions

---

## 23) Suggested Reading (Deep Dives)

- `ENDPOINTS_NodeSpark.md`
- `PHASE1_INDEX.md`, `PHASE_2_EVENT_STUDIO.md`, `PHASE_4_GOVERNANCE_LOOP.md`
- `PHASE_5_DAY_OF_EVENT_LOGISTICS.md`, `PHASE_6_INDEX.md`
- `ANALYTICS_ENDPOINT_SPEC.md`, `API_ENDPOINT_REFERENCE.md`, `COMPLETE_FASTAPI_IMPLEMENTATION.md`

---

## 24) Notes & Gaps

This file reflects code and documentation present in the repository. If any feature is not mentioned here but exists in code, add a new section following the same **Frontend / Backend / Database** template.
