from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import logging

from config import settings
from database import engine, Base
from core.tenant import TenantMiddleware
from auth.routes import router as auth_router
from tenants.routes import router as tenants_router, public_router
from tenants.routes import router as tenant_public_router
from users.routes import router as users_router
from budgets.routes import router as budgets_router
from budgets.workflow_routes import router as budget_workflow_router
from tenants.distribution_routes import router as budget_distribution_router
from wallets.routes import router as wallets_router
from recognition.routes import router as recognition_router
from redemption.routes import router as redemption_router
from feed.routes import router as feed_router
from notifications.routes import router as notifications_router
from audit.routes import router as audit_router
from events.routes import router as events_router
from analytics.routes import router as analytics_router
from platform_admin.routes import router as platform_router
from platform_admin.ledger_routes import router as platform_ledger_router
from platform_admin.ledger_export_routes import router as platform_ledger_export_router
from platform_admin.alert_routes import router as platform_alert_router
from copilot.routes import router as copilot_router
from copilot.snpilot_routes import router as snpilot_router
from sales.routes import router as sales_router
from crm.routes import router as crm_router
from catalog.platform_routes import router as catalog_platform_router
from catalog.tenant_routes import router as catalog_tenant_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logging.info("Starting SparkNode Multi-Tenant API...")
    yield
    # Shutdown
    logging.info("Shutting down SparkNode API...")


app = FastAPI(
    title="SparkNode API",
    description="Multi-Tenant Employee Rewards & Recognition Platform",
    version="2.0.0",
    lifespan=lifespan
)

# Tenant Context Middleware
app.add_middleware(TenantMiddleware)

# CORS Configuration
cors_origins = settings.cors_origins
if not isinstance(cors_origins, list):
    cors_origins = [cors_origins]
# Ensure common local dev origins are allowed
for origin in ("http://localhost:6173", "http://localhost:5173", "http://localhost:3000"):
    if origin not in cors_origins:
        cors_origins.append(origin)

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logging.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )

# Include routers
app.include_router(auth_router, prefix="/api/auth", tags=["Authentication"])
app.include_router(public_router, prefix="/tenant", tags=["Public Tenant Access"])
app.include_router(tenants_router, prefix="/api/tenants", tags=["Tenants"])
app.include_router(users_router, prefix="/api/users", tags=["Users"])
app.include_router(budget_distribution_router, tags=["Tenant Budget Distribution"])
app.include_router(budgets_router, prefix="/api/budgets", tags=["Budgets"])
app.include_router(budget_workflow_router, prefix="/api", tags=["Budget Workflow"])
app.include_router(wallets_router, prefix="/api/wallets", tags=["Wallets"])
app.include_router(recognition_router, prefix="/api/recognitions", tags=["Recognition"])
app.include_router(redemption_router, prefix="/api/redemptions", tags=["Redemption"])
app.include_router(feed_router, prefix="/api/feed", tags=["Feed"])
app.include_router(notifications_router, prefix="/api/notifications", tags=["Notifications"])
app.include_router(audit_router, prefix="/api/audit", tags=["Audit"])
app.include_router(events_router, prefix="/api/events", tags=["Events & Logistics"])
app.include_router(analytics_router, prefix="/api/analytics", tags=["Analytics"])
app.include_router(sales_router, prefix="/api/sales-events", tags=["Sales & Marketing"])
app.include_router(crm_router, prefix="/api/crm", tags=["CRM Connectors"])
app.include_router(platform_router, prefix="/api/platform", tags=["Platform Admin"])
app.include_router(platform_ledger_router, tags=["Platform Budget Ledger"])
app.include_router(platform_ledger_export_router, tags=["Platform Budget Ledger Export"])
app.include_router(platform_alert_router, tags=["Platform Budget Alerts"])
app.include_router(copilot_router, prefix="/api", tags=["AI Copilot"])
app.include_router(snpilot_router, prefix="/api", tags=["SNPilot Intents"])
app.include_router(catalog_platform_router, prefix="/api/catalog/admin", tags=["Catalog — Platform Admin"])
app.include_router(catalog_tenant_router, prefix="/api/catalog", tags=["Catalog — Tenant & Browse"])


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
