from sqlalchemy import text
from database import SessionLocal
import uuid

# Root tenant ID from seed.sql
ROOT_TENANT_ID = '00000000-0000-0000-0000-000000000000'
ADMIN_EMAIL = 'admin@sparknode.io'
# Password hash for 'jspark123'
PWD_HASH = '$2b$12$wUO54KkKhLF1ShGUklxUZ.F7rxZ5Vy.c5psXvulEaukdcvNuiZX3u'

db = SessionLocal()
try:
    # 1. Create root tenant if missing
    db.execute(text(f"""
        INSERT INTO tenants (id, name, slug, status, subscription_tier, subscription_status) 
        VALUES ('{ROOT_TENANT_ID}', 'root_tenant_sparknode', 'admin', 'active', 'enterprise', 'active')
        ON CONFLICT (id) DO NOTHING;
    """))

    # 2. Insert admin into users table
    user_id = str(uuid.uuid4())
    db.execute(text(f"""
        INSERT INTO users (id, tenant_id, email, corporate_email, password_hash, first_name, last_name, org_role, status, is_super_admin)
        VALUES ('{user_id}', '{ROOT_TENANT_ID}', '{ADMIN_EMAIL}', '{ADMIN_EMAIL}', '{PWD_HASH}', 'Platform', 'Admin', 'platform_admin', 'ACTIVE', TRUE)
        ON CONFLICT (tenant_id, email) DO UPDATE SET org_role = 'platform_admin'
        RETURNING id;
    """))
    
    # Get the user_id if it already existed
    res = db.execute(text(f"SELECT id FROM users WHERE email = '{ADMIN_EMAIL}'")).fetchone()
    if res:
        user_id = res[0]

    # 3. Drop legacy system_admins table
    db.execute(text("DROP TABLE IF EXISTS system_admins CASCADE;"))

    # 4. Create new system_admins table
    db.execute(text("""
        CREATE TABLE system_admins (
            admin_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
            access_level VARCHAR(20) DEFAULT 'PLATFORM_ADMIN',
            mfa_enabled BOOLEAN DEFAULT TRUE,
            last_login_at TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
    """))

    # 5. Link user to system_admins
    db.execute(text(f"""
        INSERT INTO system_admins (user_id, access_level)
        VALUES ('{user_id}', 'PLATFORM_ADMIN');
    """))

    db.commit()
    print("Migration successful: admin@sparknode.io is now in users and system_admins tables.")
except Exception as e:
    db.rollback()
    print(f"Migration failed: {e}")
finally:
    db.close()
