#!/bin/bash

# Generate AUTH_SECRET for Staging
# This script generates a new auth secret for the staging environment

set -e

echo "🔐 Generating AUTH_SECRET for Staging"
echo ""

# Try to use @auth/core secret generator
if command -v npx &> /dev/null; then
    echo "Using @auth/core to generate secret..."
    SECRET=$(npx -y @auth/core secret 2>/dev/null || echo "")
fi

# Fallback to openssl if @auth/core fails
if [ -z "$SECRET" ]; then
    if command -v openssl &> /dev/null; then
        echo "Using openssl to generate secret..."
        SECRET=$(openssl rand -base64 32)
    else
        echo "❌ Error: Neither @auth/core nor openssl is available"
        echo ""
        echo "Please install one of:"
        echo "  - Node.js (for @auth/core)"
        echo "  - openssl (for openssl)"
        exit 1
    fi
fi

echo ""
echo "✅ Generated AUTH_SECRET:"
echo ""
echo "$SECRET"
echo ""
echo "📋 Next steps:"
echo "1. Copy the secret above"
echo "2. Go to Vercel → Settings → Environment Variables"
echo "3. Add AUTH_SECRET with value: $SECRET"
echo "4. Select 'Preview' environment ONLY"
echo "5. Click Save"
echo ""
echo "⚠️  Important: This is different from your production AUTH_SECRET!"
echo ""

