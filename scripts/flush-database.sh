#!/bin/bash

# Flush Database Script
# This script resets a database by dropping all data and re-running migrations
# WARNING: This will DELETE ALL DATA in the target database!

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${RED}⚠️  WARNING: This will DELETE ALL DATA in the target database!${NC}"
echo ""

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}❌ Error: DATABASE_URL environment variable is not set${NC}"
    echo ""
    echo "Please set it first:"
    echo "  export DATABASE_URL='your-database-connection-string'"
    echo ""
    echo "Or run:"
    echo "  DATABASE_URL='your-connection-string' ./scripts/flush-database.sh"
    exit 1
fi

# Extract database name from connection string for safety check
DB_NAME=$(echo "$DATABASE_URL" | sed -n 's/.*\/\([^?]*\).*/\1/p')

echo -e "${YELLOW}Database URL detected:${NC}"
echo "  ${DATABASE_URL:0:50}..." # Show first 50 chars only
echo ""

# Safety check - warn if it doesn't look like staging/test
if [[ "$DATABASE_URL" != *"staging"* ]] && [[ "$DATABASE_URL" != *"test"* ]] && [[ "$DATABASE_URL" != *"dev"* ]]; then
    echo -e "${RED}⚠️  WARNING: Database name doesn't contain 'staging', 'test', or 'dev'${NC}"
    echo -e "${RED}   This might be PRODUCTION!${NC}"
    echo ""
    read -p "Are you SURE you want to flush this database? Type 'FLUSH' to confirm: " -r
    echo
    if [[ ! $REPLY == "FLUSH" ]]; then
        echo "Aborted."
        exit 1
    fi
fi

echo ""
echo -e "${YELLOW}This will:${NC}"
echo "  1. Drop all tables (DELETE ALL DATA)"
echo "  2. Re-run all migrations"
echo "  3. Recreate the database schema"
echo ""
read -p "Continue? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 1
fi

echo ""
echo -e "${GREEN}🔄 Flushing database...${NC}"
echo ""

# Reset database using Prisma
echo "Step 1: Resetting database schema..."
npx prisma migrate reset --force --skip-seed

echo ""
echo -e "${GREEN}✅ Database flushed successfully!${NC}"
echo ""
echo "Next steps:"
echo "  1. Verify the database is empty: npx prisma studio"
echo "  2. Deploy your application"
echo ""
