-- Add AI_QUERY AuditAction enum value for Ask ComplyVault (CV-FEAT-014)
-- Append-only audit trail entry written on every LLM-backed question.
ALTER TYPE "AuditAction" ADD VALUE 'AI_QUERY';
