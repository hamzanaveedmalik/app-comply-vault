-- Add new AuditAction values for workspace and invitation events
ALTER TYPE "AuditAction" ADD VALUE 'WORKSPACE_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'INVITE_SENT';
ALTER TYPE "AuditAction" ADD VALUE 'INVITE_RESENT';
ALTER TYPE "AuditAction" ADD VALUE 'INVITE_ACCEPTED';
