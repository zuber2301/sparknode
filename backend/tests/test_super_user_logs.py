from database import engine
from sqlalchemy import text

USER_EMAIL = 'super_user@sparknode.io'


def test_super_user_logs_printout():
    with engine.connect() as conn:
        user = conn.execute(text("SELECT id, corporate_email, status, password_hash IS NOT NULL AS has_password, to_char(created_at, 'YYYY-MM-DD HH24:MI:SS TZ') as created_at FROM users WHERE corporate_email = :email"), {'email': USER_EMAIL}).fetchone()
        assert user is not None, 'super_user not found in users table'
        print('\nUSER:')
        print('id:', user.id)
        print('email:', user.corporate_email)
        print('status:', user.status)
        print('has_password:', user.has_password)
        print('created_at:', user.created_at)

        admin = conn.execute(text("SELECT admin_id, user_id, access_level, mfa_enabled, to_char(last_login_at, 'YYYY-MM-DD HH24:MI:SS TZ') as last_login_at FROM system_admins WHERE user_id = (SELECT id FROM users WHERE corporate_email = :email)"), {'email': USER_EMAIL}).fetchone()
        print('\nSYSTEM_ADMIN:')
        if not admin:
            print('No system_admin row found')
        else:
            print('admin_id:', admin.admin_id)
            print('user_id:', admin.user_id)
            print('access_level:', admin.access_level)
            print('mfa_enabled:', admin.mfa_enabled)
            print('last_login_at:', admin.last_login_at)

        print('\nAUDIT LOGS:')
        rows = conn.execute(text("SELECT id, action, entity_type, to_char(created_at, 'YYYY-MM-DD HH24:MI:SS TZ') as created_at FROM audit_log WHERE actor_id = (SELECT id FROM users WHERE corporate_email = :email) ORDER BY created_at DESC LIMIT 50"), {'email': USER_EMAIL}).fetchall()
        if not rows:
            print('No audit log entries found for this user')
        else:
            for r in rows:
                print(f"{r.created_at} | {r.id} | {r.action} | {r.entity_type}")

    # Keep test passing
    assert True
