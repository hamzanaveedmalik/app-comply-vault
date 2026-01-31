#!/bin/bash

# Deploy to Staging and Production Script
# This script helps deploy to both staging and production environments

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Deployment Script${NC}"
echo ""

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo -e "${YELLOW}⚠️  Vercel CLI not found. Installing...${NC}"
    npm install -g vercel
fi

# Check if logged in to Vercel
if ! vercel whoami &> /dev/null; then
    echo -e "${YELLOW}⚠️  Not logged in to Vercel. Logging in...${NC}"
    vercel login
fi

echo ""
echo "Select deployment option:"
echo "  1) Deploy to Staging only"
echo "  2) Deploy to Production only"
echo "  3) Deploy to both Staging and Production"
echo ""
read -p "Enter option (1-3): " -n 1 -r
echo ""

case $REPLY in
    1)
        echo -e "${GREEN}📦 Deploying to Staging...${NC}"
        echo ""
        echo "Pushing to staging branch..."
        git checkout staging || git checkout -b staging
        git push origin staging
        echo ""
        echo -e "${GREEN}✅ Staging deployment triggered!${NC}"
        echo "   Check Vercel dashboard for deployment status"
        ;;
    2)
        echo -e "${GREEN}📦 Deploying to Production...${NC}"
        echo ""
        echo "Option A: Promote staging deployment (recommended)"
        echo "  1. Go to Vercel Dashboard → Deployments"
        echo "  2. Find latest staging deployment"
        echo "  3. Click '...' → 'Promote to Production'"
        echo ""
        echo "Option B: Deploy directly from main branch"
        read -p "Deploy from main branch now? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            git checkout main
            vercel --prod
            echo ""
            echo -e "${GREEN}✅ Production deployment triggered!${NC}"
        fi
        ;;
    3)
        echo -e "${GREEN}📦 Deploying to both environments...${NC}"
        echo ""
        
        # Deploy to staging
        echo "Step 1: Deploying to Staging..."
        git checkout staging || git checkout -b staging
        git push origin staging
        echo ""
        echo -e "${GREEN}✅ Staging deployment triggered!${NC}"
        echo ""
        
        # Wait a bit
        echo "Waiting 5 seconds..."
        sleep 5
        
        # Deploy to production
        echo ""
        echo "Step 2: Deploying to Production..."
        echo ""
        echo "To deploy to production:"
        echo "  1. Go to Vercel Dashboard → Deployments"
        echo "  2. Find the staging deployment you just created"
        echo "  3. Click '...' → 'Promote to Production'"
        echo ""
        echo "Or deploy directly:"
        read -p "Deploy to production from main branch now? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            git checkout main
            vercel --prod
            echo ""
            echo -e "${GREEN}✅ Production deployment triggered!${NC}"
        fi
        ;;
    *)
        echo "Invalid option. Exiting."
        exit 1
        ;;
esac

echo ""
echo -e "${GREEN}✅ Deployment process complete!${NC}"
echo ""
echo "Monitor deployments:"
echo "  - Vercel Dashboard: https://vercel.com/dashboard"
echo "  - Staging: https://app-staging.complyvault.co"
echo "  - Production: https://app.complyvault.co"
echo ""
