#!/bin/bash
set -e

# Configuration - set these as environment variables or use defaults
BACKUP_DIR=${DB_BACKUP_DIR:-"./backups"}
RETENTION_DAYS=${DB_BACKUP_RETENTION:-7}
DB_URL=${DATABASE_URL}
BACKUP_S3_BUCKET=${BACKUP_S3_BUCKET:-""}

# Create backup directory if it doesn't exist
mkdir -p $BACKUP_DIR

# Generate filename with timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/db_backup_$TIMESTAMP.sql.gz"

# Check if DATABASE_URL is set
if [ -z "$DB_URL" ]; then
  echo "Error: DATABASE_URL environment variable is not set."
  exit 1
fi

# Extract database connection details from DATABASE_URL
# Format: postgresql://USER:PASSWORD@HOST:PORT/DATABASE
DB_USER=$(echo $DB_URL | sed -E 's/^postgresql:\/\/([^:]+).*/\1/')
DB_PASSWORD=$(echo $DB_URL | sed -E 's/^postgresql:\/\/[^:]+:([^@]+).*/\1/')
DB_HOST=$(echo $DB_URL | sed -E 's/^postgresql:\/\/[^@]+@([^:]+).*/\1/')
DB_PORT=$(echo $DB_URL | sed -E 's/^postgresql:\/\/[^:]+:[^@]+@[^:]+:([0-9]+).*/\1/')
DB_NAME=$(echo $DB_URL | sed -E 's/^postgresql:\/\/[^:]+:[^@]+@[^:]+:[0-9]+\/([^?]+).*/\1/')

echo "Creating backup of $DB_NAME on $DB_HOST..."

# Create the backup
PGPASSWORD=$DB_PASSWORD pg_dump -h $DB_HOST -p $DB_PORT -U $DB_USER $DB_NAME | gzip > $BACKUP_FILE

echo "Backup created: $BACKUP_FILE"

# Upload to S3 if configured
if [ -n "$BACKUP_S3_BUCKET" ] && [ -n "$S3_ACCESS_KEY_ID" ] && [ -n "$S3_SECRET_ACCESS_KEY" ]; then
  echo "Uploading backup to S3 bucket: $BACKUP_S3_BUCKET"
  
  # Use AWS CLI to upload to S3
  AWS_ACCESS_KEY_ID=$S3_ACCESS_KEY_ID \
  AWS_SECRET_ACCESS_KEY=$S3_SECRET_ACCESS_KEY \
  aws s3 cp $BACKUP_FILE s3://$BACKUP_S3_BUCKET/database-backups/db_backup_$TIMESTAMP.sql.gz
  
  echo "Backup uploaded to S3: s3://$BACKUP_S3_BUCKET/database-backups/db_backup_$TIMESTAMP.sql.gz"
fi

# Delete old backups (local only)
find $BACKUP_DIR -name "db_backup_*.sql.gz" -type f -mtime +$RETENTION_DAYS -delete

echo "Removed backups older than $RETENTION_DAYS days"
echo "Backup complete!"