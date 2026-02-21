# Catalog module — three-layer reward catalog
from .platform_routes import router as platform_router
from .tenant_routes import router as tenant_router

__all__ = ["platform_router", "tenant_router"]
