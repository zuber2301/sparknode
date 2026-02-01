

# =====================================================
# PLATFORM ADMIN: TENANT-SPECIFIC USER MANAGEMENT
# =====================================================

@router.get("/tenant/{tenant_id}/users", response_model=List[UserListResponse])
async def get_tenant_users(
    tenant_id: UUID,
    department_id: Optional[UUID] = None,
    org_role: Optional[str] = Query(None, alias="role"),
    status: Optional[str] = Query(default="active"),
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Platform Admin endpoint to view all users of a specific tenant.
    
    This implements the "Platform Admin View" from the architecture:
    "When you click on a tenant in the Tenant Manager, your UI should call:
    GET /users/tenant/{tenant_id}/users"
    
    Allows platform admins to:
    - See all employees in a specific organization
    - Filter by department, role, or status
    - Manage users across the entire platform
    
    Access Control:
    - Platform admins only
    - Raises 403 if current_user is not a platform admin
    
    Example:
        GET /api/users/tenant/550e8400-e29b-41d4-a716-446655440000/users
        GET /api/users/tenant/550e8400-e29b-41d4-a716-446655440000/users?role=hr_admin
        GET /api/users/tenant/550e8400-e29b-41d4-a716-446655440000/users?department_id=XXX&status=ACTIVE
    """
    # Verify platform admin access
    if not current_user.is_platform_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Platform admin access required"
        )
    
    # Verify tenant exists
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found"
        )
    
    # Build query for this tenant's users
    query = db.query(User).filter(User.tenant_id == tenant_id)
    
    if department_id:
        query = query.filter(User.department_id == department_id)
    
    if org_role:
        query = query.filter(User.org_role == org_role)
    
    if status:
        query = query.filter(func.lower(User.status) == status.lower())
    
    users = query.offset(skip).limit(limit).all()
    return users
