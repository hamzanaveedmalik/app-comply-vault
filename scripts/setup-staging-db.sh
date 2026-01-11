#!/bin/bash

# Setup Staging Database Script
# This script helps set up the staging database with migrations

set -e

echo "🚀 Setting up Staging Database"
echo ""

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ Error: DATABASE_URL environment variable is not set"
    echo ""
    echo "Please set it first:"
    echo "  export DATABASE_URL='your-staging-neon-connection-string'"
    echo ""
    echo "Or run:"
    echo "  DATABASE_URL='your-connection-string' ./scripts/setup-staging-db.sh"
    exit 1
fi

echo "✅ DATABASE_URL is set"
echo ""

# Check if it's a staging database (safety check)
if [[ "$DATABASE_URL" == *"staging"* ]] || [[ "$DATABASE_URL" == *"test"* ]]; then
    echo "✅ Database name contains 'staging' or 'test' - looks safe"
else
    echo "⚠️  Warning: Database name doesn't contain 'staging' or 'test'"
    echo "   Make sure this is your STAGING database, not production!"
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Aborted."
        exit 1
    fi
fi

echo ""
echo "📦 Running Prisma migrations..."
npx prisma migrate deploy

echo ""
echo "✅ Staging database setup complete!"
echo ""
echo "Next steps:"
echo "1. Add DATABASE_URL to Vercel → Settings → Environment Variables"
echo "2. Select 'Preview' environment only"
echo "3. Redeploy staging deployment"
echo ""

