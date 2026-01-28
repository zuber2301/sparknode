from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from config import settings
from database import engine, Base
from auth.routes import router as auth_router
from tenants.routes import router as tenants_router
from users.routes import router as users_router
from budgets.routes import router as budgets_router
from wallets.routes import router as wallets_router
from recognition.routes import router as recognition_router
from redemption.routes import router as redemption_router
from feed.routes import router as feed_router
from notifications.routes import router as notifications_router
from audit.routes import router as audit_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print("Starting SparkNode API...")
    yield
    # Shutdown
    print("Shutting down SparkNode API...")


app = FastAPI(
    title="SparkNode API",
    description="Employee Rewards & Recognition Platform",
    version="1.0.0",
    lifespan=lifespan
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth_router, prefix="/api/auth", tags=["Authentication"])
app.include_router(tenants_router, prefix="/api/tenants", tags=["Tenants"])
app.include_router(users_router, prefix="/api/users", tags=["Users"])
app.include_router(budgets_router, prefix="/api/budgets", tags=["Budgets"])
app.include_router(wallets_router, prefix="/api/wallets", tags=["Wallets"])
app.include_router(recognition_router, prefix="/api/recognitions", tags=["Recognition"])
app.include_router(redemption_router, prefix="/api/redemptions", tags=["Redemption"])
app.include_router(feed_router, prefix="/api/feed", tags=["Feed"])
app.include_router(notifications_router, prefix="/api/notifications", tags=["Notifications"])
app.include_router(audit_router, prefix="/api/audit", tags=["Audit"])


@app.get("/")
async def root():
    return {
        "name": "SparkNode API",
        "version": "1.0.0",
        "status": "running"
    }


@app.get("/health")
async def health_check():
    return {"status": "healthy"}
