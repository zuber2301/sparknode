from sqlalchemy import text
from sqlalchemy.orm import Session
from database import SessionLocal
from models import User, SystemAdmin

db = SessionLocal()
try:
    print("--- Users ---")
    users = db.query(User).all()
    for u in users:
        print(f"ID: {u.id}, Email: {u.corporate_email}, Role: {u.org_role}, Status: {u.status}, Has Admin: {u.system_admin is not None}")
    
    print("\n--- System Admins ---")
    admins = db.query(SystemAdmin).all()
    for a in admins:
        print(f"AdminID: {a.admin_id}, UserID: {a.user_id}")
finally:
    db.close()
