from database import Base, engine, SessionLocal, CloudConnection
import sys

def seed():
    try:
        Base.metadata.create_all(bind=engine)
        db = SessionLocal()
        # Clean existing to avoid duplicates if re-run
        db.query(CloudConnection).delete()
        
        db.add(CloudConnection(name='Production AWS Account (Injected)', provider='AWS', credentials={}))
        db.add(CloudConnection(name='Dev Azure Subscription', provider='Azure', credentials={}))
        db.add(CloudConnection(name='GCP Project Spark-Core', provider='GCP', credentials={}))
        
        db.commit()
        print("Database initialized and connections seeded.")
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    seed()
