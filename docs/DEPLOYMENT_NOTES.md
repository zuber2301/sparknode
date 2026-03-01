Database role security hardening

This project now includes a migration to create a non-superuser database role for application connections.

Steps for production deployment:

1. Run the migration `database/migrations/20260206_create_app_role.sql` on the production database as the database superuser (or apply the SQL manually).

2. Set a strong password for the `sparknode_app` role:
   psql -U postgres -d sparknode -c "ALTER ROLE sparknode_app WITH PASSWORD 'your_strong_password_here';"

3. Update environment variables for the backend to use the app role connection string:
   - Set `APP_DATABASE_URL=postgresql://sparknode_app:YOUR_PASSWORD@<DB_HOST>:<DB_PORT>/sparknode`
   - The application will prefer `APP_DATABASE_URL` over `DATABASE_URL` when both are present.

4. (Optional, recommended) Create a dedicated non-superuser PostgreSQL account for the DBA and avoid using the database superuser role for application connections.

5. Restart services to pick up the new configuration.

Notes:
- We intentionally keep `DATABASE_URL` around for backwards compatibility; however, for production you should use `APP_DATABASE_URL` so the application does not run with superuser privileges.
- The migration grants minimal privileges on the public schema and sets default privileges for future objects. Review and tighten them further as needed (e.g., limit to a subset of tables, add role-based function grants, etc.).