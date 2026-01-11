# Deployment Workflow: Staging → Production

This guide explains how to set up a staging-first deployment workflow where code automatically deploys to staging, and production deployments require manual approval.

## Workflow Overview

```
Feature Branch → Staging (Auto) → Test → Manual Promotion → Production
```

1. **Push to `staging` branch** → Auto-deploys to `app-staging.complyvault.co`
2. **Test on staging** → Verify everything works
3. **Manual promotion** → Promote staging deployment to production
4. **Production** → Live on `app.complyvault.co`

## Quick Setup (5 Minutes)

### 1. Configure Vercel Settings

1. Go to **Vercel Dashboard** → Your Project → **Settings** → **Git**
2. Set **"Production Branch"** to: `main`
3. Scroll down to **"Deployment Protection"**
4. Enable **"Production Protection"**:
   - Toggle ON: "Require approval before deploying to Production"
   - This makes production deployments require manual approval

### 2. Verify Domain Configuration

- **Staging**: `app-staging.complyvault.co` → Preview environment → `staging` branch
- **Production**: `app.complyvault.co` → Production environment → `main` branch

### 3. Create Staging Branch

```bash
git checkout -b staging
git push -u origin staging
```

### 4. Test the Workflow

1. Push to staging → Should auto-deploy
2. Go to Deployments → Find staging deployment
3. Click "..." → "Promote to Production"
4. Confirm → Deploys to production

That's it! Your workflow is set up.

## Step 1: Configure Vercel Git Settings

### 1.1 Enable Production Protection (Manual Approval)

1. Go to Vercel → **Settings** → **Git**
2. Find **"Production Branch"** section
3. Set **"Production Branch"** to: `main`
4. Enable **"Production Protection"**:
   - This requires manual approval before deploying to production
   - Or disable auto-deploy for main branch

### 1.2 Configure Branch Deployments

1. Still in **Settings** → **Git**
2. Under **"Ignored Build Step"** (optional):
   - You can add patterns to skip builds for certain files
3. Under **"Deployment Protection"**:
   - Enable for Production environment
   - This adds a manual approval step

## Step 2: Set Up Branch Strategy

### Recommended Branch Structure

```
main          → Production (manual promotion)
staging       → Staging (auto-deploy)
feature/*     → Preview deployments (auto)
```

### Create Staging Branch

```bash
# Create and push staging branch
git checkout -b staging
git push -u origin staging
```

## Step 3: Configure Domain Assignments

### Production Domain
- **Domain**: `app.complyvault.co`
- **Environment**: Production
- **Branch**: `main` (but won't auto-deploy)

### Staging Domain
- **Domain**: `app-staging.complyvault.co`
- **Environment**: Preview
- **Branch**: `staging` (auto-deploys)

## Step 4: How to Deploy

### Deploy to Staging (Automatic)

1. **Push to staging branch**:
   ```bash
   git checkout staging
   git merge main  # or merge your feature branch
   git push origin staging
   ```

2. **Vercel automatically**:
   - Detects the push
   - Builds the project
   - Deploys to Preview environment
   - Assigns to `app-staging.complyvault.co`

3. **Test on staging**:
   - Visit `https://app-staging.complyvault.co`
   - Verify all features work
   - Check logs for errors

### Promote to Production (Manual)

#### Option A: Using Vercel Dashboard (Recommended)

1. Go to **Vercel Dashboard** → **Deployments**
2. Find the staging deployment you want to promote
3. Click the **"..."** menu (three dots)
4. Click **"Promote to Production"**
5. Confirm the promotion
6. Vercel will:
   - Deploy the same build to Production
   - Assign to `app.complyvault.co`
   - Use Production environment variables

#### Option B: Using Vercel CLI

```bash
# Install Vercel CLI if you haven't
npm i -g vercel

# Login
vercel login

# Promote a specific deployment
vercel promote <deployment-url>

# Or promote latest staging deployment
vercel promote --target production
```

#### Option C: Merge to Main (Alternative)

If you want to keep auto-deploy for main but with protection:

1. **Merge staging to main**:
   ```bash
   git checkout main
   git merge staging
   git push origin main
   ```

2. **Vercel will**:
   - Create a production deployment
   - Require approval (if Production Protection is enabled)
   - You approve in the dashboard
   - Deploys to production

## Step 5: Environment Variables

Make sure environment variables are set correctly:

### Production Environment
- Go to **Settings** → **Environment Variables**
- Set variables for **Production** environment:
  - `NEXT_PUBLIC_APP_URL` = `https://app.complyvault.co`
  - All other production variables

### Preview/Staging Environment
- Set variables for **Preview** environment:
  - `NEXT_PUBLIC_APP_URL` = `https://app-staging.complyvault.co`
  - Can use same database or separate staging database

## Step 6: Typical Workflow

### Daily Development Flow

1. **Create feature branch**:
   ```bash
   git checkout -b feature/new-feature
   # Make changes
   git commit -m "Add new feature"
   git push origin feature/new-feature
   ```

2. **Create PR** → Vercel creates preview deployment

3. **Merge to staging**:
   ```bash
   git checkout staging
   git merge feature/new-feature
   git push origin staging
   ```
   → Auto-deploys to `app-staging.complyvault.co`

4. **Test on staging** → Verify everything works

5. **Promote to production**:
   - Go to Vercel → Deployments
   - Find staging deployment
   - Click "Promote to Production"
   - Confirm

6. **Or merge to main** (if using merge strategy):
   ```bash
   git checkout main
   git merge staging
   git push origin main
   ```
   → Requires approval → Deploys to production

## Step 7: Production Protection Setup

### Enable in Vercel Dashboard

1. Go to **Settings** → **Git**
2. Scroll to **"Production Protection"**
3. Enable **"Require approval before deploying to Production"**
4. Optionally add team members who can approve

### What This Does

- When code is pushed to `main` branch:
  - Vercel creates a deployment
  - Status shows "Awaiting Approval"
  - You must click "Approve" in dashboard
  - Then it deploys to production

## Step 8: Verification Checklist

After setup, verify:

- [ ] Staging branch exists and is pushed to GitHub
- [ ] `app-staging.complyvault.co` is connected to Preview environment
- [ ] `app.complyvault.co` is connected to Production environment
- [ ] Production Protection is enabled (optional)
- [ ] Environment variables are set for both Production and Preview
- [ ] Push to staging → Auto-deploys to staging
- [ ] Promote staging deployment → Deploys to production

## Troubleshooting

### Staging Not Auto-Deploying

- Check Vercel → Settings → Git → Auto-deploy is enabled
- Verify you pushed to the correct branch
- Check Vercel → Deployments for build status

### Can't Promote to Production

- Verify you have permission to promote
- Check Production Protection settings
- Ensure production domain is configured
- Verify production environment variables are set

### Production Deployment Fails

- Check production environment variables
- Verify database connection (if using separate DB)
- Check build logs for errors
- Ensure all required env vars are set for Production

## Alternative: GitHub Actions Workflow

If you want more control, you can use GitHub Actions:

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches:
      - staging
      - main

jobs:
  deploy-staging:
    if: github.ref == 'refs/heads/staging'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: amondnet/vercel-action@v20
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod=false'

  deploy-production:
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: amondnet/vercel-action@v20
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
          vercel-confirm: true  # Requires manual confirmation
```

## Summary

**Staging-First Workflow:**
1. Push to `staging` → Auto-deploys to staging
2. Test on `app-staging.complyvault.co`
3. Promote deployment → Production
4. Live on `app.complyvault.co`

**Key Settings:**
- Staging branch → Preview environment (auto-deploy)
- Main branch → Production environment (manual approval)
- Production Protection enabled (optional but recommended)

