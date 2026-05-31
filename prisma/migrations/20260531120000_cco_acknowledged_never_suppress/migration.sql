-- Persist never-suppress acknowledgement as an audit event on wizard completion
ALTER TYPE "AuditAction" ADD VALUE 'CCO_ACKNOWLEDGED_NEVER_SUPPRESS';
