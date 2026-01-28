from sqlalchemy import Column, String, DateTime, Boolean, ForeignKey, Numeric, Integer, Text, Date, CheckConstraint, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID, JSONB
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
    ONGOING = "ongoing"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


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
    domain = Column(String(255), unique=True)
    logo_url = Column(String(500))
    favicon_url = Column(String(500))
    primary_color = Column(String(20), default="#3B82F6")  # Brand color
    status = Column(String(50), default='active')
    
    # Subscription & Billing
    subscription_tier = Column(String(50), default='starter')
    subscription_status = Column(String(50), default='active')  # active, past_due, cancelled
    subscription_started_at = Column(DateTime(timezone=True))
    subscription_ends_at = Column(DateTime(timezone=True))
    max_users = Column(Integer, default=50)  # User limit based on plan
    
    # Feature Flags & Settings
    settings = Column(JSONB, default={})
    # settings structure:
    # {
    #   "copay_enabled": true,
    #   "copay_max_percentage": 50,
    #   "points_to_currency_ratio": 0.10,  # 1 point = $0.10
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
    
    @property
    def is_active(self):
        return self.status == 'active' and self.subscription_status == 'active'
    
    @property
    def copay_enabled(self):
        return self.settings.get('copay_enabled', False)
    
    @property
    def points_to_currency(self):
        return self.settings.get('points_to_currency_ratio', 0.10)


class Department(Base):
    __tablename__ = "departments"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    parent_id = Column(UUID(as_uuid=True), ForeignKey("departments.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    tenant = relationship("Tenant", back_populates="departments")
    users = relationship("User", back_populates="department")
    department_budgets = relationship("DepartmentBudget", back_populates="department")


class User(Base):
    __tablename__ = "users"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    email = Column(String(255), nullable=False)
    password_hash = Column(String(255), nullable=False)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    role = Column(String(50), nullable=False)
    department_id = Column(UUID(as_uuid=True), ForeignKey("departments.id"))
    manager_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    avatar_url = Column(String(500))
    date_of_birth = Column(Date)
    hire_date = Column(Date)
    status = Column(String(50), default='active')
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    tenant = relationship("Tenant", back_populates="users")
    department = relationship("Department", back_populates="users")
    wallet = relationship("Wallet", back_populates="user", uselist=False)
    recognitions_given = relationship("Recognition", foreign_keys="Recognition.from_user_id", back_populates="from_user")
    recognitions_received = relationship("Recognition", foreign_keys="Recognition.to_user_id", back_populates="to_user")
    
    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}"


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
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    budget = relationship("Budget", back_populates="department_budgets")
    department = relationship("Department", back_populates="department_budgets")
    
    @property
    def remaining_points(self):
        return float(self.allocated_points) - float(self.spent_points)


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
    visibility = Column(String(20), default='public')  # public/private/department
    status = Column(String(50), default='active')  # pending/active/rejected/revoked
    department_budget_id = Column(UUID(as_uuid=True), ForeignKey("department_budgets.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    from_user = relationship("User", foreign_keys=[from_user_id], back_populates="recognitions_given")
    to_user = relationship("User", foreign_keys=[to_user_id], back_populates="recognitions_received")
    badge = relationship("Badge", back_populates="recognitions")
    comments = relationship("RecognitionComment", back_populates="recognition")
    reactions = relationship("RecognitionReaction", back_populates="recognition")


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
    voucher_code = Column(String(255))
    voucher_pin = Column(String(100))
    status = Column(String(50), default='pending')  # pending/processing/completed/failed/cancelled/expired
    provider_reference = Column(String(255))
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
    actor_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
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
# EVENTS & LOGISTICS MODULE
# =====================================================

class Event(Base):
    """
    Tenant-specific events (Hackathons, Annual Day, Sales Kickoff, etc.)
    
    Features:
    - Custom event wizards per tenant culture
    - Modular sub-activities (Performance vs Gifting tracks)
    - Separate event budgets outside recurring recognition pool
    - Approval workflows for localized governance
    """
    __tablename__ = "events"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    
    # Basic Info
    name = Column(String(255), nullable=False)
    description = Column(Text)
    event_type = Column(String(50), default='mixed')  # recognition, logistics, mixed
    
    # Scheduling
    start_date = Column(DateTime(timezone=True), nullable=False)
    end_date = Column(DateTime(timezone=True), nullable=False)
    registration_deadline = Column(DateTime(timezone=True))
    
    # Location
    location = Column(String(500))
    is_virtual = Column(Boolean, default=False)
    virtual_link = Column(String(500))
    
    # Capacity & Status
    max_participants = Column(Integer)
    status = Column(String(50), default='draft')  # draft, published, ongoing, completed, cancelled
    
    # Visual & Branding
    banner_image_url = Column(String(500))
    theme_color = Column(String(20))
    
    # Settings
    settings = Column(JSONB, default={})
    # settings structure:
    # {
    #   "require_manager_approval": true,
    #   "allow_plus_one": false,
    #   "notify_on_registration": true,
    #   "enable_waitlist": true,
    #   "qr_checkin_enabled": true,
    #   "gift_pickup_enabled": true,
    #   "custom_fields": [{"name": "T-Shirt Size", "type": "select", "options": ["S", "M", "L", "XL"]}]
    # }
    
    # Audit
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    tenant = relationship("Tenant", back_populates="events")
    creator = relationship("User", foreign_keys=[created_by])
    activities = relationship("EventActivity", back_populates="event", cascade="all, delete-orphan")
    participants = relationship("EventParticipant", back_populates="event", cascade="all, delete-orphan")
    event_budget = relationship("EventBudget", back_populates="event", uselist=False, cascade="all, delete-orphan")
    
    @property
    def is_registration_open(self):
        from datetime import datetime
        now = datetime.utcnow()
        if self.registration_deadline:
            return self.status == 'published' and now < self.registration_deadline
        return self.status == 'published' and now < self.start_date


class EventActivity(Base):
    """
    Sub-activities within an event (Performance tracks, Gifting sessions, etc.)
    
    Features:
    - Custom capacity limits per activity
    - Activity-specific budgets
    - Separate approval workflows
    """
    __tablename__ = "event_activities"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    event_id = Column(UUID(as_uuid=True), ForeignKey("events.id", ondelete="CASCADE"), nullable=False)
    
    # Basic Info
    name = Column(String(255), nullable=False)
    description = Column(Text)
    activity_type = Column(String(50), default='general')  # performance, gifting, workshop, networking, general
    
    # Scheduling
    start_time = Column(DateTime(timezone=True))
    end_time = Column(DateTime(timezone=True))
    
    # Capacity
    max_capacity = Column(Integer)
    current_count = Column(Integer, default=0)
    
    # Location
    location = Column(String(500))
    
    # Points/Rewards
    participation_points = Column(Numeric(15, 2), default=0)  # Points for participation
    
    # Settings
    settings = Column(JSONB, default={})
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    event = relationship("Event", back_populates="activities")
    participants = relationship("ActivityParticipant", back_populates="activity", cascade="all, delete-orphan")
    gift_items = relationship("EventGiftItem", back_populates="activity", cascade="all, delete-orphan")
    
    @property
    def is_full(self):
        if self.max_capacity is None:
            return False
        return self.current_count >= self.max_capacity
    
    @property
    def available_spots(self):
        if self.max_capacity is None:
            return None
        return max(0, self.max_capacity - self.current_count)


class EventParticipant(Base):
    """
    Event registration and participation tracking.
    
    Features:
    - Manager approval workflow
    - Check-in tracking with QR verification
    - Custom field responses
    """
    __tablename__ = "event_participants"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    event_id = Column(UUID(as_uuid=True), ForeignKey("events.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    # Status
    status = Column(String(50), default='pending')  # pending, approved, rejected, checked_in, completed
    
    # Approval
    approved_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    approved_at = Column(DateTime(timezone=True))
    rejection_reason = Column(Text)
    
    # Check-in
    checked_in_at = Column(DateTime(timezone=True))
    checked_in_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    
    # Custom Fields
    custom_field_responses = Column(JSONB, default={})
    
    # Timestamps
    registered_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    event = relationship("Event", back_populates="participants")
    user = relationship("User", foreign_keys=[user_id])
    approver = relationship("User", foreign_keys=[approved_by])
    activity_participations = relationship("ActivityParticipant", back_populates="event_participant", cascade="all, delete-orphan")


class ActivityParticipant(Base):
    """
    Participation tracking for specific event activities.
    """
    __tablename__ = "activity_participants"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    activity_id = Column(UUID(as_uuid=True), ForeignKey("event_activities.id", ondelete="CASCADE"), nullable=False)
    event_participant_id = Column(UUID(as_uuid=True), ForeignKey("event_participants.id", ondelete="CASCADE"), nullable=False)
    
    # Status
    status = Column(String(50), default='registered')  # registered, attended, no_show
    
    # Check-in
    checked_in_at = Column(DateTime(timezone=True))
    
    # Points awarded
    points_awarded = Column(Numeric(15, 2), default=0)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    activity = relationship("EventActivity", back_populates="participants")
    event_participant = relationship("EventParticipant", back_populates="activity_participations")


class EventBudget(Base):
    """
    Separate event-specific budget outside the recurring recognition pool.
    
    Features:
    - One-time funding for logistics events
    - Isolated from main tenant budget
    - Track gifts, prizes, and participation rewards
    """
    __tablename__ = "event_budgets"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    event_id = Column(UUID(as_uuid=True), ForeignKey("events.id", ondelete="CASCADE"), nullable=False, unique=True)
    
    # Budget amounts
    total_budget = Column(Numeric(15, 2), nullable=False, default=0)
    allocated_amount = Column(Numeric(15, 2), nullable=False, default=0)
    spent_amount = Column(Numeric(15, 2), nullable=False, default=0)
    
    # Budget breakdown
    breakdown = Column(JSONB, default={})
    # breakdown structure:
    # {
    #   "gifts": 50000,
    #   "prizes": 20000,
    #   "participation_rewards": 10000,
    #   "miscellaneous": 5000
    # }
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    event = relationship("Event", back_populates="event_budget")
    
    @property
    def remaining_budget(self):
        return float(self.total_budget) - float(self.spent_amount)


class EventGiftItem(Base):
    """
    Gift items available for an event activity (for logistics events).
    """
    __tablename__ = "event_gift_items"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    activity_id = Column(UUID(as_uuid=True), ForeignKey("event_activities.id", ondelete="CASCADE"), nullable=False)
    
    # Gift details
    name = Column(String(255), nullable=False)
    description = Column(Text)
    image_url = Column(String(500))
    
    # Inventory
    total_quantity = Column(Integer, nullable=False, default=0)
    allocated_quantity = Column(Integer, nullable=False, default=0)
    distributed_quantity = Column(Integer, nullable=False, default=0)
    
    # Value
    unit_value = Column(Numeric(15, 2), default=0)
    points_value = Column(Numeric(15, 2), default=0)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    activity = relationship("EventActivity", back_populates="gift_items")
    allocations = relationship("GiftAllocation", back_populates="gift_item", cascade="all, delete-orphan")
    
    @property
    def available_quantity(self):
        return self.total_quantity - self.allocated_quantity


class GiftAllocation(Base):
    """
    Gift allocations to employees for pickup at events.
    """
    __tablename__ = "gift_allocations"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    gift_item_id = Column(UUID(as_uuid=True), ForeignKey("event_gift_items.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    # Allocation details
    quantity = Column(Integer, nullable=False, default=1)
    
    # Pickup status
    status = Column(String(50), default='pending')  # pending, ready, picked_up, expired
    picked_up_at = Column(DateTime(timezone=True))
    verified_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    
    # QR Code token hash (for verification)
    qr_token_hash = Column(String(255))
    
    # Timestamps
    allocated_at = Column(DateTime(timezone=True), server_default=func.now())
    expires_at = Column(DateTime(timezone=True))
    
    # Relationships
    gift_item = relationship("EventGiftItem", back_populates="allocations")
    user = relationship("User", foreign_keys=[user_id])
    verifier = relationship("User", foreign_keys=[verified_by])


# =====================================================
# PLATFORM ANALYTICS & METRICS
# =====================================================

class TenantAnalytics(Base):
    """
    Pre-computed analytics metrics for tenant dashboards.
    Updated periodically for performance.
    """
    __tablename__ = "tenant_analytics"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    
    # Time period
    period_type = Column(String(20), nullable=False)  # daily, weekly, monthly, quarterly
    period_start = Column(Date, nullable=False)
    period_end = Column(Date, nullable=False)
    
    # Engagement Metrics
    active_users = Column(Integer, default=0)
    recognitions_given = Column(Integer, default=0)
    recognitions_received = Column(Integer, default=0)
    points_distributed = Column(Numeric(15, 2), default=0)
    points_redeemed = Column(Numeric(15, 2), default=0)
    
    # Budget Metrics
    budget_utilization_rate = Column(Numeric(5, 2), default=0)  # percentage
    budget_burn_rate = Column(Numeric(15, 2), default=0)  # points per day
    
    # Engagement Scores
    engagement_score = Column(Numeric(5, 2), default=0)  # 0-100
    participation_rate = Column(Numeric(5, 2), default=0)  # percentage
    
    # Department breakdown
    department_metrics = Column(JSONB, default={})
    # department_metrics structure:
    # {
    #   "dept_uuid": {
    #     "recognitions": 50,
    #     "points": 5000,
    #     "active_users": 20,
    #     "engagement_score": 75
    #   }
    # }
    
    # Top performers
    top_recognizers = Column(JSONB, default=[])  # [{user_id, count, points}]
    top_recipients = Column(JSONB, default=[])  # [{user_id, count, points}]
    
    # Computed at
    computed_at = Column(DateTime(timezone=True), server_default=func.now())
    
    class Meta:
        unique_together = ['tenant_id', 'period_type', 'period_start']


class PlatformMetrics(Base):
    """
    Platform-wide metrics for Platform Owner dashboard.
    Aggregated across all tenants without exposing individual data.
    """
    __tablename__ = "platform_metrics"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Time period
    period_type = Column(String(20), nullable=False)
    period_start = Column(Date, nullable=False)
    period_end = Column(Date, nullable=False)
    
    # Tenant Metrics
    total_tenants = Column(Integer, default=0)
    active_tenants = Column(Integer, default=0)
    new_tenants = Column(Integer, default=0)
    churned_tenants = Column(Integer, default=0)
    
    # User Metrics
    total_users = Column(Integer, default=0)
    active_users = Column(Integer, default=0)
    new_users = Column(Integer, default=0)
    
    # Transaction Metrics
    total_recognitions = Column(Integer, default=0)
    total_points_distributed = Column(Numeric(15, 2), default=0)
    total_redemptions = Column(Integer, default=0)
    total_redemption_value = Column(Numeric(15, 2), default=0)
    
    # Revenue Metrics (if applicable)
    mrr = Column(Numeric(15, 2), default=0)  # Monthly Recurring Revenue
    arr = Column(Numeric(15, 2), default=0)  # Annual Recurring Revenue
    
    # Tier breakdown
    tier_breakdown = Column(JSONB, default={})
    # tier_breakdown structure:
    # {
    #   "free": 10,
    #   "starter": 25,
    #   "professional": 15,
    #   "enterprise": 5
    # }
    
    # Top performing tenants (anonymized for benchmarking)
    tenant_benchmarks = Column(JSONB, default=[])
    # tenant_benchmarks structure:
    # [{tenant_id, engagement_score, user_count}]
    
    # Computed at
    computed_at = Column(DateTime(timezone=True), server_default=func.now())

