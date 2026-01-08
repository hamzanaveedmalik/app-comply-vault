# Backup and Recovery Procedures

## Backup Strategy

### Daily Backups

- **Database Backups:** 
  - Vercel Postgres: Automatic daily backups (managed by Vercel)
  - Retention: 7 days of daily backups
  - Point-in-time recovery: Supported for last 30 days

- **Storage Backups:**
  - S3/R2: Automatic versioning enabled
  - Cross-region replication: Configured for disaster recovery
  - Retention: 30 days of version history

### Backup Scope

**Critical Data Backed Up:**
- Meeting records (metadata, transcripts, extraction data)
- Workspace configurations
- User accounts and workspace memberships
- Audit events
- Version history
- Recordings (stored in S3/R2 with versioning)

**Backup Frequency:**
- Database: Daily (automatic)
- Storage: Continuous (versioning)
- Manual exports: On-demand via audit pack export

## Recovery Procedures

### Point-in-Time Recovery

- **Database:** Vercel Postgres supports point-in-time recovery for last 30 days
- **Process:** Contact Vercel support to initiate recovery
- **RTO Target:** < 4 hours for database recovery
- **RPO Target:** < 1 hour (last backup)

### Storage Recovery

- **Versioning:** All files have version history
- **Recovery:** Restore specific file versions via S3/R2 console
- **Process:** 
  1. Access S3/R2 bucket
  2. Navigate to file
  3. Select version to restore
  4. Restore to current version

### Full Workspace Recovery

1. **Database Recovery:**
   - Restore workspace data from backup
   - Verify workspace isolation maintained
   - Restore user memberships

2. **Storage Recovery:**
   - Restore meeting recordings from version history
   - Verify file integrity
   - Update file URLs if needed

3. **Verification:**
   - Verify all meetings accessible
   - Verify audit trail intact
   - Test export functionality

## Disaster Recovery

### RTO/RPO Targets

- **Recovery Time Objective (RTO):** < 4 hours
- **Recovery Point Objective (RPO):** < 1 hour

### Recovery Procedures

1. **Assessment:** Determine scope of data loss
2. **Backup Selection:** Choose appropriate backup point
3. **Recovery:** Restore from backup
4. **Verification:** Verify data integrity
5. **Notification:** Notify affected users

## Backup Testing

### Regular Testing

- **Monthly:** Test database backup restoration
- **Quarterly:** Full disaster recovery drill
- **Documentation:** Update procedures based on test results

### Test Procedures

1. Create test workspace
2. Generate test data
3. Create backup
4. Delete test data
5. Restore from backup
6. Verify data integrity

## Data Export

### Manual Exports

- **Audit Packs:** Users can export complete audit packs (PDF, CSV, TXT, ZIP)
- **Audit Logs:** Workspace owners can export audit logs as CSV
- **Meeting Data:** All meeting data exportable via audit pack

### Export Retention

- Exports are generated on-demand
- No automatic retention of exports
- Users responsible for storing exported files

## Contact

For backup/recovery requests: support@complyvault.com

