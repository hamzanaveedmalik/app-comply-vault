\set ON_ERROR_STOP on

-- CV-TR-01a operational step.
-- Run with psql as the Neon owner AFTER prisma migrate deploy:
--
--   psql "$DIRECT_URL" -f scripts/provision-neon-app-role.sql
--
-- The password is prompted interactively and is never stored in this repo or
-- shell history. Save the resulting complyvault_app pooled connection URL as
-- DATABASE_URL in the deployment secret manager. Keep the owner/direct URL
-- only as DIRECT_URL for migrations.

\prompt 'New password for restricted role complyvault_app: ' app_password

DO $role_check$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_roles WHERE rolname = 'complyvault_app'
  ) THEN
    RAISE EXCEPTION
      'Role complyvault_app does not exist; run prisma migrate deploy first';
  END IF;
END
$role_check$;

ALTER ROLE complyvault_app
  LOGIN
  NOSUPERUSER
  NOCREATEDB
  NOCREATEROLE
  NOINHERIT
  PASSWORD :'app_password';

SELECT
  rolname,
  rolcanlogin,
  rolsuper,
  rolcreatedb,
  rolcreaterole
FROM pg_roles
WHERE rolname = 'complyvault_app';

SELECT
  has_table_privilege('complyvault_app', '"RecordSeal"', 'SELECT') AS can_select,
  has_table_privilege('complyvault_app', '"RecordSeal"', 'INSERT') AS can_insert,
  has_table_privilege('complyvault_app', '"RecordSeal"', 'UPDATE') AS can_update,
  has_table_privilege('complyvault_app', '"RecordSeal"', 'DELETE') AS can_delete,
  has_table_privilege('complyvault_app', '"RecordSeal"', 'TRUNCATE') AS can_truncate;
