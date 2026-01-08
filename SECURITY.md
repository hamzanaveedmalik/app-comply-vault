# Security Documentation

## Data Protection

### Encryption

- **Data in Transit:** All data in transit uses TLS 1.2+ (enforced by Vercel and cloud providers)
- **Data at Rest:** All data at rest is encrypted with AES-256
  - Database: PostgreSQL with encryption at rest (Vercel Postgres)
  - Storage: S3/R2 compatible storage with server-side encryption enabled
  - Recordings, transcripts, and exports are encrypted at rest in cloud storage

### Tenant Isolation

- **Strict Workspace Isolation:** All database queries enforce `workspaceId` filtering
- **No Cross-Tenant Access:** Multi-tenant architecture ensures no workspace can access another's data
- **API-Level Enforcement:** All API routes verify workspace membership before data access
- **Database-Level Constraints:** Foreign keys enforce workspace relationships

### Access Control

- **Role-Based Access Control (RBAC):**
  - `OWNER_CCO`: Can finalize records, manage workspace settings, invite users
  - `MEMBER`: Can view and edit meetings, cannot finalize
- **UI-Level Enforcement:** Components check user role before showing actions
- **API-Level Enforcement:** All API routes verify role permissions

### Authentication

- **NextAuth.js (Auth.js v5):** Secure session management
- **Discord OAuth:** Primary authentication provider
- **Session Security:** Secure, HTTP-only cookies
- **Workspace Context:** Session includes workspace and role information

## Audit & Compliance

### Audit Logging

- **Comprehensive Logging:** All user actions are logged (upload, view, edit, finalize, export)
- **Append-Only:** Audit logs are immutable (no updates or deletes)
- **Workspace-Scoped:** All audit events are scoped to workspace
- **Retention:** Audit logs retained per workspace retention policy (≥ 5 years)

### Data Retention

- **Minimum Retention:** 5 years (SEC requirement)
- **Default Retention:** 6 years (with buffer)
- **Legal Hold:** Workspaces can set legal hold to prevent deletion
- **Configurable:** Workspace owners can configure retention years

## Security Best Practices

### API Security

- **Input Validation:** All API inputs validated with Zod schemas
- **Error Handling:** Error messages don't expose sensitive system details
- **Rate Limiting:** Handled by Vercel platform (automatic DDoS protection)
- **CORS:** Configured for secure cross-origin requests

### Storage Security

- **Presigned URLs:** Direct S3/R2 uploads use time-limited presigned URLs
- **Workspace-Prefixed Keys:** All storage keys include workspace ID for isolation
- **File Validation:** File format and size validation before upload

### Processing Security

- **Background Jobs:** QStash webhooks verify signatures
- **Service Isolation:** Transcription and extraction services run in isolated contexts
- **Error Handling:** Processing errors don't expose sensitive data

## Subprocessors

### Current Subprocessors

1. **Vercel** (Hosting & Platform)
   - Category: Infrastructure
   - Purpose: Application hosting, edge functions, database hosting
   - Data: Application data, database records

2. **Upstash** (QStash)
   - Category: Infrastructure
   - Purpose: Background job processing
   - Data: Job metadata (meeting IDs, workspace IDs)

3. **Deepgram / AssemblyAI** (Transcription)
   - Category: AI/ML Services
   - Purpose: Audio transcription
   - Data: Audio recordings (temporary, deleted after processing)

4. **OpenAI / Anthropic** (Extraction)
   - Category: AI/ML Services
   - Purpose: LLM-based field extraction
   - Data: Transcript text (temporary, not stored by provider)

5. **Resend** (Email)
   - Category: Communication
   - Purpose: Email notifications
   - Data: Email addresses, notification content

6. **Cloudflare R2 / AWS S3** (Storage)
   - Category: Infrastructure
   - Purpose: File storage
   - Data: Recordings, exports (encrypted at rest)

### Data Processing Agreements

- All subprocessors are required to maintain appropriate security standards
- Data processing agreements in place for all subprocessors
- Regular security reviews of subprocessor practices

## Incident Response

### Security Incident Procedure

1. **Detection:** Monitor logs and alerts for suspicious activity
2. **Assessment:** Determine scope and impact of incident
3. **Containment:** Isolate affected systems or accounts
4. **Notification:** Notify affected users and authorities if required
5. **Recovery:** Restore systems and data from backups
6. **Post-Incident:** Review and improve security measures

### Contact

For security concerns: security@complyvault.com

## Compliance

### SEC Rule 204-2 Compliance

- **Books & Records:** System generates exam-ready audit packs
- **Retention:** Enforces minimum 5-year retention (configurable)
- **Audit Trail:** Complete audit logging of all actions
- **Evidence Integrity:** Timestamp-linked evidence with transcript snippets

### Privacy

- **GLBA Compliance:** Financial data protection standards
- **Data Minimization:** Only collect necessary data
- **User Consent:** Explicit consent required before processing recordings
- **Data Deletion:** Support for data deletion requests (30-day window)

