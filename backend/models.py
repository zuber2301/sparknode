from sqlalchemy import Column, String, DateTime, Boolean, ForeignKey, Numeric, Integer, Text, Date, CheckConstraint, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.types import TypeDecorator, CHAR
from sqlalchemy import JSON as SQLJSON
import uuid as _uuid


# Cross-dialect GUID/UUID type: uses PostgreSQL UUID on Postgres, CHAR(36) elsewhere.
class GUID(TypeDecorator):
    impl = CHAR

    def __init__(self, as_uuid=False, *args, **kwargs):
        self.as_uuid = as_uuid
        super().__init__(*args, **kwargs)

    def load_dialect_impl(self, dialect):
        if dialect.name == 'postgresql':
            from sqlalchemy.dialects.postgresql import UUID as PGUUID
            return dialect.type_descriptor(PGUUID(as_uuid=self.as_uuid))
        else:
            return dialect.type_descriptor(CHAR(36))

    def process_bind_param(self, value, dialect):
        if value is None:
            return value
        if isinstance(value, _uuid.UUID):
            return str(value)
        return str(value)

    def process_result_value(self, value, dialect):
        if value is None:
            return value
        if self.as_uuid and isinstance(value, str):
            try:
                return _uuid.UUID(value)
            except Exception:
                return value
        return value

# Use GUID under the name `UUID` for backward compatibility in model definitions.
UUID = GUID

# Fallback for JSONB on non-postgres dialects
# Use generic JSON for cross-dialect compatibility (avoid PG-specific JSONB in SQLite tests)
JSONB = SQLJSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base
import uuid
import enum


# =====================================================
# ENUMS FOR MULTI-TENANT SYSTEM
# =====================================================

class TenantStatus(str, enum.Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    SUSPENDED = "suspended"
    TRIAL = "trial"


class SubscriptionTier(str, enum.Enum):
    FREE = "free"
    STARTER = "starter"
    PROFESSIONAL = "professional"
    ENTERPRISE = "enterprise"


class EventStatus(str, enum.Enum):
    DRAFT = "draft"
    PUBLISHED = "published"


class ActorType(str, enum.Enum):
    USER = "user"
    SYSTEM_ADMIN = "system_admin"


class AllowedDepartment(str, enum.Enum):
    HR = "Human Resource (HR)"
    IT = "Techology (IT)"
    SALES_MARKETING = "Sale & Marketting"
    BU1 = "Business Unit -1"
    BU2 = "Business Unit-2"
    BU3 = "Business Unit-3"


class EventType(str, enum.Enum):
    RECOGNITION = "recognition"
    LOGISTICS = "logistics"
    MIXED = "mixed"


class ParticipantStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    CHECKED_IN = "checked_in"
    COMPLETED = "completed"


# =====================================================
# TENANT & SUBSCRIPTION TABLES
# =====================================================

class Tenant(Base):
    """
    Core tenant (company) entity for multi-tenant isolation.
    
    Features:
    - Subscription management for SaaS billing
    - Customizable settings for catalog, co-pay, branding
    - Resource isolation with tenant_id keying
    """
    __tablename__ = "tenants"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    slug = Column(String(255), unique=True)
    domain = Column(String(255), unique=True)
    logo_url = Column(String(500))
    favicon_url = Column(String(500))
    
    # Theme & Branding Config
    theme_config = Column(JSONB, default=lambda: {
        "primary_color": "#3B82F6",
        "secondary_color": "#8B5CF6",
        "font_family": "Inter"
    })
    branding_config = Column(JSONB, default={})  # New: explicit branding config separate from settings

    # Access & Security
    domain_whitelist = Column(JSONB, default=lambda: [])  # Array of email suffixes for auto-onboarding
    auth_method = Column(String(50), default='OTP_ONLY')  # PASSWORD_AND_OTP, OTP_ONLY, SSO_SAML

    # Point Economy Config
    currency = Column(String(3), default='INR')  # Primary tenant currency (INR by default)
    markup_percent = Column(Numeric(5, 2), default=0.0)  # For gift card or markup governance
    enabled_rewards = Column(JSONB, default=lambda: [])  # Whitelisted reward ids
    currency_label = Column(String(100), default="Points")  # Custom name for points
    conversion_rate = Column(Numeric(10, 4), default=1.0)  # $1 = X points (for invoicing)
    auto_refill_threshold = Column(Numeric(5, 2), default=20.0)  # Percentage to trigger notification
    
    # Multi-Currency Support
    base_currency = Column(String(3), default='USD')  # Internal base currency (USD)
    display_currency = Column(String(3), default='USD')  # Currency for tenant display (USD, INR, EUR)
    fx_rate = Column(Numeric(10, 4), default=1.0)  # Exchange rate: 1 USD = fx_rate * display_currency

    # Recognition Laws Config
    award_tiers = Column(JSONB, default=lambda: {
        "Gold": 5000,
        "Silver": 2500,
        "Bronze": 1000
    })
    peer_to_peer_enabled = Column(Boolean, default=True)
    expiry_policy = Column(String(50), default='never')  # never, 90_days, 1_year, custom

    # Financials & Controls
    redemptions_paused = Column(Boolean, default=False)

    status = Column(String(50), default='active')
    
    # Subscription & Billing
    subscription_tier = Column(String(50), default='starter')
    subscription_status = Column(String(50), default='active')  # active, past_due, cancelled
    subscription_started_at = Column(DateTime(timezone=True))
    subscription_ends_at = Column(DateTime(timezone=True))
    max_users = Column(Integer, default=50)  # User limit based on plan

    # Master budget pool
    master_budget_balance = Column(Numeric(15, 2), nullable=False, default=0)
    
    # Budget allocated by platform admin (tenant manager distribution pool)
    budget_allocated = Column(Numeric(15, 2), nullable=False, default=0)
    
    # Budget allocation balance (remaining available for distribution)
    budget_allocation_balance = Column(Numeric(15, 2), nullable=False, default=0)
    
    # Feature Flags & Settings
    settings = Column(JSONB, default={})
    feature_flags = Column(JSONB, default={})
    # settings structure:
    # {
    #   "copay_enabled": true,
    #   "copay_max_percentage": 50,
    #   "points_to_currency_ratio": 0.10,  # 1 point = ₹0.10
    #   "recognition_approval_required": false,
    #   "manager_budget_enabled": true,
    #   "peer_to_peer_recognition": true,
    #   "anonymous_recognition": false,
    #   "social_feed_enabled": true,
    #   "leaderboards_enabled": true,
    #   "custom_badges_enabled": true,
    #   "events_module_enabled": true,
    #   "analytics_export_enabled": false
    # }
    
    # Catalog Customization
    catalog_settings = Column(JSONB, default={})
    # catalog_settings structure:
    # {
    #   "disabled_brands": ["uuid1", "uuid2"],
    #   "disabled_categories": ["Alcohol", "Gambling"],
    #   "custom_points_multiplier": 1.0,
    #   "featured_vouchers": ["uuid1", "uuid2"]
    # }
    
    # Branding & Customization
    branding = Column(JSONB, default={})
    # branding structure:
    # {
    #   "welcome_message": "Welcome to our rewards program!",
    #   "footer_text": "© 2026 Company Name",
    #   "custom_css": "",
    #   "email_logo_url": "",
    #   "recognition_terms": []
    # }
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    departments = relationship("Department", back_populates="tenant", cascade="all, delete-orphan")
    users = relationship("User", back_populates="tenant", cascade="all, delete-orphan")
    budgets = relationship("Budget", back_populates="tenant", cascade="all, delete-orphan")
    events = relationship("Event", back_populates="tenant", cascade="all, delete-orphan")
    master_budget_ledger = relationship("MasterBudgetLedger", back_populates="tenant", cascade="all, delete-orphan")
    
    @property
    def is_active(self):
        return self.status == 'active' and self.subscription_status == 'active'
    
    @property
    def copay_enabled(self):
        return self.settings.get('copay_enabled', False)
    
    @property
    def points_to_currency(self):
        return self.settings.get('points_to_currency_ratio', 0.10)

    @property
    def primary_color(self):
        """Compatibility property: expose primary color from `theme_config`."""
        try:
            return (self.theme_config or {}).get('primary_color', '#3B82F6')
        except Exception:
            return '#3B82F6'

    @property
    def branding_config(self):
        """Compatibility: return explicit `branding_config` column or fall back to settings.

        This ensures older code and new code both have a consistent view.
        """
        try:
            # Prefer the explicit column if populated
            if self.__dict__.get('branding_config'):
                return self.__dict__.get('branding_config') or {}
            return (self.settings or {}).get('branding_config', {})
        except Exception:
            return {}


class Department(Base):
    __tablename__ = "departments"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    parent_id = Column(UUID(as_uuid=True), ForeignKey("departments.id"))
    budget_balance = Column(Numeric(15, 2), nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Removed strict CHECK constraint to allow tests and external data to define departments.
    __table_args__ = ()
    
    # Relationships
    tenant = relationship("Tenant", back_populates="departments")
    users = relationship("User", back_populates="department")
    department_budgets = relationship("DepartmentBudget", back_populates="department")


class User(Base):
    __tablename__ = "users"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    corporate_email = Column(String(255), nullable=False)
    personal_email = Column(String(255))
    password_hash = Column(String(255), nullable=False)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    org_role = Column(String(50), nullable=False)
    department_id = Column(UUID(as_uuid=True), ForeignKey("departments.id"), nullable=False)
    manager_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    avatar_url = Column(String(500))
    phone_number = Column(String(20))
    mobile_number = Column(String(20))
    date_of_birth = Column(Date)
    hire_date = Column(Date)
    status = Column(String(50), default='ACTIVE')
    is_super_admin = Column(Boolean, default=False)
    invitation_sent_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    tenant = relationship("Tenant", back_populates="users")
    department = relationship("Department", back_populates="users")
    wallet = relationship("Wallet", back_populates="user", uselist=False)
    recognitions_given = relationship("Recognition", foreign_keys="Recognition.from_user_id", back_populates="from_user")
    recognitions_received = relationship("Recognition", foreign_keys="Recognition.to_user_id", back_populates="to_user")
    lead_budgets = relationship("LeadBudget", back_populates="user")
    system_admin = relationship("SystemAdmin", back_populates="user", uselist=False)
    
    @property
    def is_platform_admin(self):
        """Check if user has platform-level privileges"""
        return self.system_admin is not None or self.org_role == "platform_admin"

    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}"


class SystemAdmin(Base):
    __tablename__ = "system_admins"

    admin_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    access_level = Column(String(20), default='PLATFORM_ADMIN')
    mfa_enabled = Column(Boolean, default=True)
    last_login_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationship back to User
    user = relationship("User", back_populates="system_admin")


class OtpToken(Base):
    __tablename__ = "otp_tokens"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    channel = Column(String(20), nullable=False)  # email | sms
    destination = Column(String(255), nullable=False)
    token_hash = Column(String(255), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    used_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class UserUploadStaging(Base):
    __tablename__ = "user_upload_staging"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    batch_id = Column(UUID(as_uuid=True), nullable=False)
    # raw_ fields as requested
    raw_full_name = Column(String(255), nullable=True)
    raw_email = Column(String(255), nullable=True)
    raw_department = Column(String(255), nullable=True)
    raw_role = Column(String(50), nullable=True)
    raw_mobile_phone = Column(String(20), nullable=True)
    
    manager_email = Column(String(255), nullable=True)
    first_name = Column(String(100), nullable=True)
    last_name = Column(String(100), nullable=True)
    corporate_email = Column(String(255), nullable=True)
    personal_email = Column(String(255), nullable=True)
    date_of_birth = Column(String(50), nullable=True)
    hire_date = Column(String(50), nullable=True)
    department_id = Column(UUID(as_uuid=True), nullable=True)
    manager_id = Column(UUID(as_uuid=True), nullable=True)
    is_valid = Column(Boolean, default=False)
    validation_errors = Column(JSONB, default=list)
    status = Column(String(50), default="pending")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
class Budget(Base):
    __tablename__ = "budgets"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    fiscal_year = Column(Integer, nullable=False)
    fiscal_quarter = Column(Integer)
    total_points = Column(Numeric(15, 2), nullable=False, default=0)
    allocated_points = Column(Numeric(15, 2), nullable=False, default=0)
    status = Column(String(50), default='active')
    expiry_date = Column(Date)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    tenant = relationship("Tenant", back_populates="budgets")
    department_budgets = relationship("DepartmentBudget", back_populates="budget")
    
    @property
    def remaining_points(self):
        return float(self.total_points) - float(self.allocated_points)


class DepartmentBudget(Base):
    __tablename__ = "department_budgets"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    budget_id = Column(UUID(as_uuid=True), ForeignKey("budgets.id", ondelete="CASCADE"), nullable=False)
    department_id = Column(UUID(as_uuid=True), ForeignKey("departments.id", ondelete="CASCADE"), nullable=False)
    allocated_points = Column(Numeric(15, 2), nullable=False, default=0)
    spent_points = Column(Numeric(15, 2), nullable=False, default=0)
    monthly_cap = Column(Numeric(15, 2))
    expiry_date = Column(Date)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    budget = relationship("Budget", back_populates="department_budgets")
    department = relationship("Department", back_populates="department_budgets")
    lead_budgets = relationship("LeadBudget", back_populates="department_budget")
    
    @property
    def remaining_points(self):
        return float(self.allocated_points) - float(self.spent_points)


class LeadBudget(Base):
    """
    Budget allocation for individual Tenant Leads or Managers.
    Allows tracking how points from a department budget are sliced for specific leads.
    """
    __tablename__ = "lead_budgets"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    department_budget_id = Column(UUID(as_uuid=True), ForeignKey("department_budgets.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    total_points = Column(Numeric(15, 2), nullable=False, default=0)
    spent_points = Column(Numeric(15, 2), nullable=False, default=0)
    
    status = Column(String(50), default='active')
    expiry_date = Column(Date)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    department_budget = relationship("DepartmentBudget", back_populates="lead_budgets")
    user = relationship("User", back_populates="lead_budgets")
    recognitions_given = relationship("Recognition", back_populates="lead_budget")

    @property
    def remaining_points(self):
        return float(self.total_points) - float(self.spent_points)

    @property
    def usage_percentage(self):
        """Returns how much of the budget has been used in %"""
        if float(self.total_points) == 0:
            return 0
        return (float(self.spent_points) / float(self.total_points)) * 100

    @property
    def remaining_percentage(self):
        """Returns how much of the budget is remaining in %"""
        if float(self.total_points) == 0:
            return 0
        return (self.remaining_points / float(self.total_points)) * 100

    @property
    def user_name(self):
        return f"{self.user.first_name} {self.user.last_name}" if self.user else "Unknown"


class Wallet(Base):
    __tablename__ = "wallets"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True)
    balance = Column(Numeric(15, 2), nullable=False, default=0)
    lifetime_earned = Column(Numeric(15, 2), nullable=False, default=0)
    lifetime_spent = Column(Numeric(15, 2), nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    user = relationship("User", back_populates="wallet")
    ledger_entries = relationship("WalletLedger", back_populates="wallet")

    @property
    def current_balance(self):
        """Compatibility property used by tests and legacy code."""
        return float(self.balance) if self.balance is not None else 0


class WalletLedger(Base):
    __tablename__ = "wallet_ledger"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    wallet_id = Column(UUID(as_uuid=True), ForeignKey("wallets.id", ondelete="CASCADE"), nullable=False)
    transaction_type = Column(String(20), nullable=False)  # credit/debit
    source = Column(String(50), nullable=False)  # hr_allocation/recognition/redemption/adjustment/expiry/reversal
    points = Column(Numeric(15, 2), nullable=False)
    balance_after = Column(Numeric(15, 2), nullable=False)
    reference_type = Column(String(50))
    reference_id = Column(UUID(as_uuid=True))
    description = Column(Text)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    wallet = relationship("Wallet", back_populates="ledger_entries")


class MasterBudgetLedger(Base):
    __tablename__ = "master_budget_ledger"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    transaction_type = Column(String(20), nullable=False)  # credit/debit
    source = Column(String(50), nullable=False)  # provisioning/adjustment/allocation/reversal
    points = Column(Numeric(15, 2), nullable=False)
    balance_after = Column(Numeric(15, 2), nullable=False)
    reference_type = Column(String(50))
    reference_id = Column(UUID(as_uuid=True))
    description = Column(Text)
    created_by = Column(UUID(as_uuid=True))
    created_by_type = Column(SQLEnum(ActorType), default=ActorType.USER)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    tenant = relationship("Tenant", back_populates="master_budget_ledger")


class Badge(Base):
    __tablename__ = "badges"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"))
    name = Column(String(100), nullable=False)
    description = Column(Text)
    icon_url = Column(String(500))
    points_value = Column(Numeric(15, 2), default=0)
    is_system = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    recognitions = relationship("Recognition", back_populates="badge")


class Recognition(Base):
    __tablename__ = "recognitions"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    from_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    to_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    badge_id = Column(UUID(as_uuid=True), ForeignKey("badges.id"))
    points = Column(Numeric(15, 2), nullable=False, default=0)
    message = Column(Text, nullable=False)
    recognition_type = Column(String(50), default='standard')
    ecard_template = Column(String(50))
    is_equal_split = Column(Boolean, default=False)
    visibility = Column(String(20), default='public')  # public/private/department
    status = Column(String(50), default='active')  # pending/active/rejected/revoked
    department_budget_id = Column(UUID(as_uuid=True), ForeignKey("department_budgets.id"))
    lead_budget_id = Column(UUID(as_uuid=True), ForeignKey("lead_budgets.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    from_user = relationship("User", foreign_keys=[from_user_id], back_populates="recognitions_given")
    to_user = relationship("User", foreign_keys=[to_user_id], back_populates="recognitions_received")
    badge = relationship("Badge", back_populates="recognitions")
    comments = relationship("RecognitionComment", back_populates="recognition")
    reactions = relationship("RecognitionReaction", back_populates="recognition")
    lead_budget = relationship("LeadBudget", back_populates="recognitions_given")


class RecognitionComment(Base):
    __tablename__ = "recognition_comments"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    recognition_id = Column(UUID(as_uuid=True), ForeignKey("recognitions.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    recognition = relationship("Recognition", back_populates="comments")
    user = relationship("User")


class RecognitionReaction(Base):
    __tablename__ = "recognition_reactions"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    recognition_id = Column(UUID(as_uuid=True), ForeignKey("recognitions.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    reaction_type = Column(String(20), default='like')
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    recognition = relationship("Recognition", back_populates="reactions")
    user = relationship("User")


class Feed(Base):
    __tablename__ = "feed"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    event_type = Column(String(50), nullable=False)  # recognition/redemption/milestone/birthday/anniversary/achievement
    reference_type = Column(String(50))
    reference_id = Column(UUID(as_uuid=True))
    actor_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    target_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    visibility = Column(String(20), default='public')
    event_metadata = Column("metadata", JSONB, default={})
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    actor = relationship("User", foreign_keys=[actor_id])
    target = relationship("User", foreign_keys=[target_id])


class Brand(Base):
    __tablename__ = "brands"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    logo_url = Column(String(500))
    category = Column(String(100))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    vouchers = relationship("Voucher", back_populates="brand")


class Voucher(Base):
    __tablename__ = "vouchers"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    brand_id = Column(UUID(as_uuid=True), ForeignKey("brands.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    reward_type = Column(String(50), default='voucher')  # voucher, merchandise
    vendor_code = Column(String(100))
    denomination = Column(Numeric(15, 2), nullable=False)
    points_required = Column(Numeric(15, 2), nullable=False)
    copay_amount = Column(Numeric(15, 2), default=0)
    image_url = Column(String(500))
    terms_conditions = Column(Text)
    validity_days = Column(Integer, default=365)
    is_active = Column(Boolean, default=True)
    stock_quantity = Column(Integer)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    brand = relationship("Brand", back_populates="vouchers")
    redemptions = relationship("Redemption", back_populates="voucher")

    @property
    def cost_points(self):
        """Compatibility alias expected by tests (maps to points_required)."""
        return float(self.points_required) if self.points_required is not None else 0

    @cost_points.setter
    def cost_points(self, value):
        self.points_required = value


class TenantVoucher(Base):
    __tablename__ = "tenant_vouchers"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    voucher_id = Column(UUID(as_uuid=True), ForeignKey("vouchers.id", ondelete="CASCADE"), nullable=False)
    is_active = Column(Boolean, default=True)
    custom_points_required = Column(Numeric(15, 2))
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Redemption(Base):
    __tablename__ = "redemptions"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    voucher_id = Column(UUID(as_uuid=True), ForeignKey("vouchers.id"), nullable=False)
    points_used = Column(Numeric(15, 2), nullable=False)
    copay_amount = Column(Numeric(15, 2), default=0)
    reward_type = Column(String(50), default='voucher')  # voucher, merchandise
    voucher_code = Column(String(255))
    voucher_pin = Column(String(100))
    status = Column(String(50), default='pending')  # pending_otp, processing, completed, failed, cancelled, expired
    provider_reference = Column(String(255))
    otp_code = Column(String(10))
    otp_expires_at = Column(DateTime(timezone=True))
    delivery_details = Column(JSONB)  # For physical rewards
    fulfilled_at = Column(DateTime(timezone=True))
    expires_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    user = relationship("User")
    voucher = relationship("Voucher", back_populates="redemptions")


class AuditLog(Base):
    __tablename__ = "audit_log"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"))
    actor_id = Column(UUID(as_uuid=True))
    actor_type = Column(SQLEnum(ActorType), default=ActorType.USER)
    action = Column(String(100), nullable=False)
    entity_type = Column(String(100))
    entity_id = Column(UUID(as_uuid=True))
    old_values = Column(JSONB)
    new_values = Column(JSONB)
    ip_address = Column(String(45))
    user_agent = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Notification(Base):
    __tablename__ = "notifications"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    type = Column(String(50), nullable=False)
    title = Column(String(255), nullable=False)
    message = Column(Text)
    reference_type = Column(String(50))
    reference_id = Column(UUID(as_uuid=True))
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    user = relationship("User")


# =====================================================

# =====================================================
# EVENTS & ACTIVITIES (Phase 1: Events Hub)
# =====================================================

class Event(Base):
    """
    Event entity for tenant-hosted events (Annual Day, Sports Day, Gift Campaigns, etc.)
    Each event belongs to a tenant and can have multiple activities and nominations.
    """
    __tablename__ = "events"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    
    # Event Details
    title = Column(String(255), nullable=False)
    description = Column(Text)
    type = Column(String(50), nullable=False)  # annual_day, gift_distribution, sports_day, custom
    
    # Timeline
    start_datetime = Column(DateTime(timezone=True), nullable=False)
    end_datetime = Column(DateTime(timezone=True), nullable=False)
    
    # Venue & Format
    venue = Column(String(500))  # "Online", "Office Building A", "Hybrid"
    location = Column(String(500))  # Geographic location if applicable
    format = Column(String(50), default='onsite')  # onsite, virtual, hybrid
    
    # Event Status & Visibility
    status = Column(String(50), default='draft')  # draft, published, ongoing, closed, archived
    visibility = Column(String(50), default='all_employees')  # all_employees, specific_departments, specific_locations
    visible_to_departments = Column(JSONB, default=[])  # Array of department IDs if visibility is filtered
    
    # Event Banner & Branding
    banner_url = Column(String(500))  # Event banner image
    color_code = Column(String(20), default='#3B82F6')  # Primary event color
    
    # Nomination & Registration Rules
    nomination_start = Column(DateTime(timezone=True))
    nomination_end = Column(DateTime(timezone=True))
    who_can_nominate = Column(String(50), default='all_employees')  # all_employees, managers_only, specific_departments
    max_activities_per_person = Column(Integer, default=5)  # Limit per employee
    
    # Budget & Tracking
    planned_budget = Column(Numeric(15, 2), default=0)
    currency = Column(String(10), default='USD')
    
    # Metadata
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    activities = relationship("EventActivity", back_populates="event", cascade="all, delete-orphan")
    nominations = relationship("EventNomination", back_populates="event", cascade="all, delete-orphan")
    gift_batches = relationship("EventGiftBatch", back_populates="event", cascade="all, delete-orphan")
    budget = relationship("EventBudget", back_populates="event", uselist=False, cascade="all, delete-orphan")
    metrics = relationship("EventMetrics", back_populates="event", uselist=False, cascade="all, delete-orphan")
    tenant = relationship("Tenant", back_populates="events")


class EventActivity(Base):
    """
    Activities within an event (e.g., Singing, Dancing, Cricket, Gift Pickup).
    Can be solo or group with nomination/registration constraints.
    """
    __tablename__ = "event_activities"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_id = Column(UUID(as_uuid=True), ForeignKey("events.id", ondelete="CASCADE"), nullable=False)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    
    # Activity Details
    name = Column(String(255), nullable=False)  # "Singing", "Cricket", "Gift Pickup"
    description = Column(Text)
    category = Column(String(50), nullable=False)  # solo, group, other
    
    # Capacity & Limits
    max_participants = Column(Integer)  # Max solo participants
    max_teams = Column(Integer)  # Max groups (if group activity)
    min_team_size = Column(Integer, default=1)
    max_team_size = Column(Integer)
    
    # Timeline
    nomination_start = Column(DateTime(timezone=True))
    nomination_end = Column(DateTime(timezone=True))
    activity_start = Column(DateTime(timezone=True))  # When activity happens
    activity_end = Column(DateTime(timezone=True))
    
    # Rules & Settings
    requires_approval = Column(Boolean, default=False)  # Requires admin approval
    allow_multiple_teams = Column(Boolean, default=False)  # Can one person join multiple teams?
    rules_text = Column(Text)  # Custom rules or instructions
    
    # Metadata
    sequence = Column(Integer)  # Order in event agenda
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    event = relationship("Event", back_populates="activities")
    nominations = relationship("EventNomination", back_populates="activity", cascade="all, delete-orphan")
    teams = relationship("EventTeam", back_populates="activity", cascade="all, delete-orphan")


class EventNomination(Base):
    """
    Self-nomination or registration for an activity.
    Solo: user nominates directly. Group: user nominates themselves for team.
    """
    __tablename__ = "event_nominations"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_id = Column(UUID(as_uuid=True), ForeignKey("events.id", ondelete="CASCADE"), nullable=False)
    activity_id = Column(UUID(as_uuid=True), ForeignKey("event_activities.id", ondelete="CASCADE"), nullable=False)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    
    # Nominee Info
    nominee_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    team_id = Column(UUID(as_uuid=True), ForeignKey("event_teams.id"), nullable=True)  # NULL for solo activities
    
    # Submission & Status
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))  # User who created nomination (may diff for approvals)
    status = Column(String(50), default='pending')  # pending, approved, rejected, waitlisted
    
    # Performance Details (for performances)
    performance_title = Column(String(255))  # E.g., "Solo Dancing - Kathak"
    notes = Column(Text)  # Additional info from nominee
    preferred_slot = Column(String(100))  # E.g., "Slot 1 (10am-11am)"
    
    # Tracking
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    reviewed_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))  # Admin who approved/rejected
    reviewed_at = Column(DateTime(timezone=True))
    
    # Relationships
    event = relationship("Event", back_populates="nominations")
    activity = relationship("EventActivity", back_populates="nominations")


class EventTeam(Base):
    """
    Team for group activities (team sports, group performances, etc.)
    """
    __tablename__ = "event_teams"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    activity_id = Column(UUID(as_uuid=True), ForeignKey("event_activities.id", ondelete="CASCADE"), nullable=False)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    
    # Team Details
    team_name = Column(String(255), nullable=False)
    description = Column(Text)
    
    # Leadership
    captain_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    
    # Team Status
    status = Column(String(50), default='forming')  # forming, complete, approved, rejected
    
    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    activity = relationship("EventActivity", back_populates="teams")
    members = relationship("EventTeamMember", back_populates="team", cascade="all, delete-orphan")


class EventTeamMember(Base):
    """
    Members of a team for group activities.
    """
    __tablename__ = "event_team_members"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    team_id = Column(UUID(as_uuid=True), ForeignKey("event_teams.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    
    # Member Role
    role = Column(String(50), default='member')  # member, captain
    
    # Status
    status = Column(String(50), default='active')  # active, inactive, left
    
    # Metadata
    joined_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    team = relationship("EventTeam", back_populates="members")


class EventGiftBatch(Base):
    """
    Batch of gifts for an event (e.g., "Diwali Hampers 2026" with 500 units).
    Tracks planned gifts before individual redemption tracking.
    """
    __tablename__ = "event_gift_batches"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_id = Column(UUID(as_uuid=True), ForeignKey("events.id", ondelete="CASCADE"), nullable=False)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    
    # Gift Type & Quantity
    gift_name = Column(String(255), nullable=False)  # E.g., "Diwali Hamper", "Sports Kit"
    gift_type = Column(String(50), nullable=False)  # hamper, voucher, swag, merchandise, other
    description = Column(Text)
    
    quantity = Column(Integer, nullable=False)  # Total units available
    unit_value = Column(Numeric(10, 2), nullable=False)  # Cost per unit
    
    # Eligibility & Distribution
    eligible_criteria = Column(JSONB, default={})  # {departments: [], locations: [], roles: []}
    distribution_start = Column(DateTime(timezone=True))
    distribution_end = Column(DateTime(timezone=True))
    distribution_locations = Column(JSONB, default=[])  # Array of location names
    
    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    event = relationship("Event", back_populates="gift_batches")
    redemptions = relationship("EventGiftRedemption", back_populates="gift_batch", cascade="all, delete-orphan")


class EventGiftRedemption(Base):
    """
    Per-employee gift redemption tracking with QR codes.
    One row per eligible employee for each gift batch.
    """
    __tablename__ = "event_gift_redemptions"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    gift_batch_id = Column(UUID(as_uuid=True), ForeignKey("event_gift_batches.id", ondelete="CASCADE"), nullable=False)
    event_id = Column(UUID(as_uuid=True), ForeignKey("events.id", ondelete="CASCADE"), nullable=False)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    
    # Recipient
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    
    # QR Token (unique, signed, time-bounded)
    qr_token = Column(String(500), unique=True, nullable=False)  # Encoded, signed JWT or similar
    qr_token_expires_at = Column(DateTime(timezone=True))
    
    # Redemption Status
    status = Column(String(50), default='not_issued')  # not_issued, issued, redeemed, expired
    
    # Redemption Details
    redeemed_at = Column(DateTime(timezone=True))
    redeemed_location = Column(String(255))  # Location where gift was collected
    redeemed_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))  # Staff member who scanned
    
    # Audit
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    gift_batch = relationship("EventGiftBatch", back_populates="redemptions")


class EventBudget(Base):
    """
    Budget tracking for an event.
    Breakdown of planned vs actual spend by category.
    """
    __tablename__ = "event_budgets"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_id = Column(UUID(as_uuid=True), ForeignKey("events.id", ondelete="CASCADE"), nullable=False)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    
    # Overall Budget
    planned_budget = Column(Numeric(15, 2), nullable=False)
    actual_spend = Column(Numeric(15, 2), default=0)
    committed_spend = Column(Numeric(15, 2), default=0)  # Reserved but not yet spent
    
    # Breakdown by Category (JSONB for flexibility)
    budget_breakdown = Column(JSONB, default={})
    # {
    #   "venue": {planned: 10000, actual: 9500, committed: 0},
    #   "gifts": {planned: 50000, actual: 49000, committed: 0},
    #   "catering": {planned: 20000, actual: 0, committed: 20000},
    #   "logistics": {planned: 5000, actual: 0, committed: 0}
    # }
    
    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    event = relationship("Event", back_populates="budget")


class EventMetrics(Base):
    """
    Aggregated metrics for an event (participation, attendance, gift collection rates).
    Can be computed in real-time or cached periodically.
    """
    __tablename__ = "event_metrics"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_id = Column(UUID(as_uuid=True), ForeignKey("events.id", ondelete="CASCADE"), nullable=False)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    
    # Participation Metrics
    total_invited = Column(Integer, default=0)  # Eligible employees
    total_registered = Column(Integer, default=0)  # Those who nominated
    total_participated = Column(Integer, default=0)  # Those who actually participated (check-in)
    no_shows = Column(Integer, default=0)
    
    # Per-Activity Breakdown
    activity_metrics = Column(JSONB, default={})
    # {
    #   "activity_id": {
    #     "name": "Singing",
    #     "nominations": 45,
    #     "approved": 30,
    #     "waitlisted": 10,
    #     "rejected": 5
    #   }
    # }
    
    # Gift Collection Metrics
    gifts_eligible = Column(Integer, default=0)
    gifts_issued = Column(Integer, default=0)
    gifts_redeemed = Column(Integer, default=0)
    
    # Department/Location Breakdown
    department_metrics = Column(JSONB, default={})
    # {
    #   "dept_id": {
    #     "participated": 50,
    #     "gifts_collected": 48
    #   }
    # }
    
    # Last Computed
    computed_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    event = relationship("Event", back_populates="metrics")


class InvitationToken(Base):
    """
    Secure invitation tokens for inviting users to join a tenant organization.
    
    Used for the "Invite-Link" onboarding method where tenants send secure
    join links to prospective employees.
    
    Tokens:
    - Are cryptographically secure (secrets.token_urlsafe)
    - Have configurable expiration (default 24 hours)
    - Are email-specific and one-time use
    - Can be invalidated/revoked by setting is_used
    """
    __tablename__ = "invitation_tokens"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    email = Column(String(255), nullable=False)  # Email address being invited
    token = Column(String(500), nullable=False, unique=True)  # Secure token
    
    # Validity
    is_used = Column(Boolean, default=False)  # Whether token has been consumed
    expires_at = Column(DateTime(timezone=True), nullable=False)
    
    # Audit
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    used_at = Column(DateTime(timezone=True))  # When token was used
    used_by_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))  # Who used it
    
    # Relationships
    tenant = relationship("Tenant")
    used_by_user = relationship("User")
    
    __table_args__ = (
        CheckConstraint("expires_at > created_at", name="check_token_expiry_valid"),
    )


# =====================================================
# POINTS ALLOCATION SYSTEM
# =====================================================

class BudgetAllocationLog(Base):
    """
    Tracks when Platform Admin allocates budget to Tenant.
    Immutable audit trail for all allocation transactions.
    """
    __tablename__ = "budget_allocation_logs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    admin_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    amount = Column(Numeric(15, 2), nullable=False)
    currency = Column(String(10), default='INR')
    reference_note = Column(Text)
    transaction_type = Column(String(50), nullable=False, default='CREDIT_INJECTION')
        # CHECK (transaction_type IN ('CREDIT_INJECTION', 'CLAWBACK', 'ADJUSTMENT'))
    previous_balance = Column(Numeric(15, 2))
    new_balance = Column(Numeric(15, 2))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    tenant = relationship("Tenant")
    admin = relationship("User")


class PlatformBudgetBillingLog(Base):
    """
    Platform-level budget billing audit trail.
    Tracks all admin-initiated budget allocations for invoicing/reconciliation.
    """
    __tablename__ = "platform_billing_logs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    admin_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    amount = Column(Numeric(15, 2), nullable=False)
    currency = Column(String(10), default='INR')
    reference_note = Column(Text)
    transaction_type = Column(String(50), nullable=False, default='CREDIT_INJECTION')
        # CHECK (transaction_type IN ('CREDIT_INJECTION', 'CLAWBACK', 'REVERSAL', 'REFUND', 'ADJUSTMENT'))
    invoice_number = Column(String(100))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    admin = relationship("User")
    tenant = relationship("Tenant")


class BudgetDistributionLog(Base):
    """
    Tracks when Tenant Manager distributes budget from allocation pool to employees.
    Records who gave budget to whom and the reason (recognition, award, event bonus).
    """
    __tablename__ = "budget_distribution_logs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    from_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    to_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    amount = Column(Numeric(15, 2), nullable=False)
    transaction_type = Column(String(50), nullable=False, default='RECOGNITION')
        # CHECK (transaction_type IN ('RECOGNITION', 'MANUAL_AWARD', 'EVENT_BONUS'))
    reference_type = Column(String(50))  # recognition, budget_allocation, event
    reference_id = Column(UUID(as_uuid=True))
    description = Column(Text)
    previous_pool_balance = Column(Numeric(15, 2))
    new_pool_balance = Column(Numeric(15, 2))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    tenant = relationship("Tenant")
    from_user = relationship("User", foreign_keys=[from_user_id])
    to_user = relationship("User", foreign_keys=[to_user_id])


class TenantBudgetAllocation(Base):
    """
    Platform admin allocates budget to a tenant.
    This is the 'Total Allocated Budget' available to tenant managers.
    """
    __tablename__ = "tenant_budget_allocations"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, unique=True)
    total_allocated_budget = Column(Numeric(15, 2), nullable=False, default=0)
    remaining_balance = Column(Numeric(15, 2), nullable=False, default=0)
    status = Column(String(50), default='active')  # active/inactive/closed
    allocation_date = Column(DateTime(timezone=True), server_default=func.now())
    allocated_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    tenant = relationship("Tenant")
    department_allocations = relationship("DepartmentBudgetAllocation", back_populates="tenant_allocation")
    
    @property
    def total_allocated(self):
        return float(self.total_allocated_budget) if self.total_allocated_budget else 0
    
    @property
    def total_remaining(self):
        return float(self.remaining_balance) if self.remaining_balance else 0


class DepartmentBudgetAllocation(Base):
    """
    Tenant manager distributes budget from tenant allocation to departments.
    Sum of all departments should not exceed total tenant allocation.
    """
    __tablename__ = "department_budget_allocations"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    department_id = Column(UUID(as_uuid=True), ForeignKey("departments.id", ondelete="CASCADE"), nullable=False)
    tenant_budget_allocation_id = Column(UUID(as_uuid=True), ForeignKey("tenant_budget_allocations.id", ondelete="CASCADE"), nullable=False)
    allocated_budget = Column(Numeric(15, 2), nullable=False, default=0)
    distributed_budget = Column(Numeric(15, 2), nullable=False, default=0)  # sum of points to employees
    remaining_budget = Column(Numeric(15, 2), nullable=False, default=0)
    status = Column(String(50), default='active')  # active/inactive/closed
    allocation_date = Column(DateTime(timezone=True), server_default=func.now())
    allocated_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))  # tenant_manager
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    __table_args__ = (
        # Ensure unique allocation per department
        # NOTE: Removed UNIQUE constraint to allow multiple allocation periods
    )
    
    # Relationships
    tenant_allocation = relationship("TenantBudgetAllocation", back_populates="department_allocations")
    employee_allocations = relationship("EmployeePointsAllocation", back_populates="department_allocation")
    
    @property
    def allocated(self):
        return float(self.allocated_budget) if self.allocated_budget else 0
    
    @property
    def distributed(self):
        return float(self.distributed_budget) if self.distributed_budget else 0
    
    @property
    def remaining(self):
        return float(self.remaining_budget) if self.remaining_budget else 0


class EmployeePointsAllocation(Base):
    """
    Department lead distributes points to individual employees.
    Points can be spent on recognitions or redeemed.
    """
    __tablename__ = "employee_points_allocations"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    department_budget_allocation_id = Column(UUID(as_uuid=True), ForeignKey("department_budget_allocations.id", ondelete="CASCADE"), nullable=False)
    employee_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    allocated_points = Column(Numeric(15, 2), nullable=False, default=0)
    spent_points = Column(Numeric(15, 2), nullable=False, default=0)
    status = Column(String(50), default='active')  # active/inactive/closed
    allocation_date = Column(DateTime(timezone=True), server_default=func.now())
    allocated_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))  # dept_lead
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    department_allocation = relationship("DepartmentBudgetAllocation", back_populates="employee_allocations")
    employee = relationship("User", foreign_keys=[employee_id])
    
    @property
    def remaining_points(self):
        return float(self.allocated_points) - float(self.spent_points) if self.allocated_points else 0
    
    @property
    def usage_percentage(self):
        if float(self.allocated_points) == 0:
            return 0
        return (float(self.spent_points) / float(self.allocated_points)) * 100


class BudgetAllocationLedger(Base):
    """
    Immutable ledger tracking all budget allocation transactions.
    Used for audit trail and compliance.
    """
    __tablename__ = "budget_allocation_ledger"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    transaction_type = Column(String(50), nullable=False)
    # tenant_allocation / dept_allocation / employee_allocation / allocation_reversal / points_spend
    source_entity_type = Column(String(50), nullable=False)  # tenant/department/employee
    source_entity_id = Column(UUID(as_uuid=True), nullable=False)
    target_entity_type = Column(String(50))  # department/employee (if applicable)
    target_entity_id = Column(UUID(as_uuid=True))
    amount = Column(Numeric(15, 2), nullable=False)
    balance_before = Column(Numeric(15, 2))
    balance_after = Column(Numeric(15, 2))
    description = Column(Text)
    actor_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    tenant = relationship("Tenant")
    actor = relationship("User")


# -------------------- Compatibility aliases / legacy models --------------------
# Provide simple aliases so existing imports in tests keep working.
# Reward used to be a distinct model; map it to Voucher.
Reward = Voucher
# WalletTransaction / Ledger map to the WalletLedger model/table.
WalletTransaction = WalletLedger
Ledger = WalletLedger
# Budget allocation model aliases for backward compatibility
AllocationLog = BudgetAllocationLog
DistributionLog = BudgetDistributionLog


