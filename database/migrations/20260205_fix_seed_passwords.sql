-- Migration: Ensure seeded tenant admin passwords have correct bcrypt hash
-- This updates specific seeded users to the known hashed password used in seed.sql

UPDATE users
SET password_hash = '$2b$12$wUO54KkKhLF1ShGUklxUZ.F7rxZ5Vy.c5psXvulEaukdcvNuiZX3u'
WHERE corporate_email IN (
  'admin@teste2e.com',
  'admin@autoslug.com'
)
AND password_hash <> '$2b$12$wUO54KkKhLF1ShGUklxUZ.F7rxZ5Vy.c5psXvulEaukdcvNuiZX3u';

-- Idempotent: only replaces if it's different
-- To apply:
-- PGPASSWORD=... psql -h <host> -p <port> -U <user> -d <db> -f 20260205_fix_seed_passwords.sql
