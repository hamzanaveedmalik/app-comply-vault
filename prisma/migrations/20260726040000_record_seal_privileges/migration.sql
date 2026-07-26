-- CV-TR-01a / CV-TR-02: append-only RecordSeal ledger.
--
-- Deployment contract:
--   * Prisma migrations run as the Neon owner/migration role.
--   * Runtime DATABASE_URL uses the SQL-created `complyvault_app` role.
--   * This migration creates that role NOLOGIN; an operator enables LOGIN and
--     sets its password out-of-band with scripts/provision-neon-app-role.sql.
--
-- RAW SQL: Prisma cannot express PostgreSQL roles, ownership, grants, revokes,
-- default privileges, or an append-only trigger.

ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'RECORD_SEALED';

CREATE TABLE "RecordSeal" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "meetingId" TEXT NOT NULL,
  "packHash" TEXT NOT NULL,
  "sealedAt" TIMESTAMP(3) NOT NULL,
  "sealedByUserId" TEXT NOT NULL,
  "storageUri" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMP(3),

  CONSTRAINT "RecordSeal_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RecordSeal_packHash_sha256_check"
    CHECK ("packHash" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "RecordSeal_retention_after_seal_check"
    CHECK ("expiresAt" > "sealedAt"),
  CONSTRAINT "RecordSeal_not_soft_deletable_check"
    CHECK ("deletedAt" IS NULL),
  CONSTRAINT "RecordSeal_insert_timestamp_check"
    CHECK ("updatedAt" = "createdAt")
);

CREATE UNIQUE INDEX "RecordSeal_packHash_key"
  ON "RecordSeal"("packHash");
CREATE UNIQUE INDEX "RecordSeal_workspaceId_meetingId_key"
  ON "RecordSeal"("workspaceId", "meetingId");
CREATE INDEX "RecordSeal_workspaceId_sealedAt_idx"
  ON "RecordSeal"("workspaceId", "sealedAt");
CREATE INDEX "RecordSeal_meetingId_idx"
  ON "RecordSeal"("meetingId");
CREATE INDEX "RecordSeal_expiresAt_idx"
  ON "RecordSeal"("expiresAt");

ALTER TABLE "RecordSeal"
  ADD CONSTRAINT "RecordSeal_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RecordSeal"
  ADD CONSTRAINT "RecordSeal_meetingId_fkey"
  FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- SQL-created Neon roles do not inherit neon_superuser. Keep the application
-- role separate from the migration role and grant only required privileges.
DO $roles$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'complyvault_app') THEN
    CREATE ROLE complyvault_app
      NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_roles WHERE rolname = 'complyvault_seal_owners'
  ) THEN
    CREATE ROLE complyvault_seal_owners
      NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
  END IF;
END
$roles$;

-- The migration role may alter the table in future migrations, but the runtime
-- application role is deliberately not a member of the owner group.
GRANT complyvault_seal_owners TO CURRENT_USER;
ALTER TABLE "RecordSeal" OWNER TO complyvault_seal_owners;

DO $database_grant$
BEGIN
  EXECUTE format(
    'GRANT CONNECT ON DATABASE %I TO complyvault_app',
    current_database()
  );
END
$database_grant$;
GRANT USAGE ON SCHEMA public TO complyvault_app;
REVOKE CREATE ON SCHEMA public FROM complyvault_app;

-- Runtime permissions for the existing Prisma schema. RecordSeal is narrowed
-- to SELECT/INSERT immediately below.
GRANT SELECT, INSERT, UPDATE, DELETE
  ON ALL TABLES IN SCHEMA public TO complyvault_app;
GRANT USAGE, SELECT
  ON ALL SEQUENCES IN SCHEMA public TO complyvault_app;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO complyvault_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO complyvault_app;

REVOKE UPDATE, DELETE, TRUNCATE
  ON TABLE "RecordSeal" FROM complyvault_app;
GRANT SELECT, INSERT
  ON TABLE "RecordSeal" TO complyvault_app;

-- Defense in depth: even a mistakenly over-granted non-owner role cannot
-- mutate an existing ledger row. REVOKE remains the primary control.
CREATE OR REPLACE FUNCTION prevent_record_seal_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  RAISE EXCEPTION 'RecordSeal is append-only'
    USING ERRCODE = '42501'; -- insufficient_privilege
END
$function$;

CREATE TRIGGER "RecordSeal_append_only"
BEFORE UPDATE OR DELETE ON "RecordSeal"
FOR EACH ROW EXECUTE FUNCTION prevent_record_seal_mutation();
