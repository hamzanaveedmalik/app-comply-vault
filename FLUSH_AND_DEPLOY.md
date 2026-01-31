# Flush Databases and Deploy Guide

This guide walks you through flushing (resetting) staging and production databases, then deploying to both environments.

## ⚠️ WARNING

**Flushing a database will DELETE ALL DATA permanently!**
- All users, workspaces, meetings, and records will be deleted
- This action cannot be undone
- Make sure you have backups if you need to recover data

## Prerequisites

1. **Vercel CLI installed** (optional, for direct deployment):
   ```bash
   npm install -g vercel
   vercel login
   ```

2. **Database connection strings** for both environments:
   - Staging: `DATABASE_URL` for staging database
   - Production: `DATABASE_URL` for production database

3. **Git branches set up**:
   - `staging` branch for staging deployments
   - `main` branch for production deployments

## Step 1: Flush Staging Database

### Option A: Using the Script (Recommended)

```bash
# Set staging database URL
export DATABASE_URL="your-staging-database-connection-string"

# Run flush script
./scripts/flush-database.sh
```

The script will:
- ✅ Verify the database URL
- ✅ Show safety warnings
- ✅ Ask for confirmation
- ✅ Drop all tables
- ✅ Re-run migrations
- ✅ Recreate schema

### Option B: Manual Prisma Commands

```bash
# Set staging database URL
export DATABASE_URL="your-staging-database-connection-string"

# Reset database (drops all data and re-runs migrations)
npx prisma migrate reset --force --skip-seed
```

### Verify Staging Database

```bash
# Open Prisma Studio to verify database is empty
npx prisma studio
```

## Step 2: Flush Production Database

**⚠️ EXTRA CAUTION: This is PRODUCTION!**

### Option A: Using the Script

```bash
# Set production database URL
export DATABASE_URL="your-production-database-connection-string"

# Run flush script (will require typing 'FLUSH' to confirm)
./scripts/flush-database.sh
```

### Option B: Manual Prisma Commands

```bash
# Set production database URL
export DATABASE_URL="your-production-database-connection-string"

# Reset database
npx prisma migrate reset --force --skip-seed
```

### Verify Production Database

```bash
# Open Prisma Studio to verify
npx prisma studio
```

## Step 3: Deploy to Staging

### Option A: Using the Deployment Script

```bash
./scripts/deploy-to-environments.sh
# Select option 1 (Staging only)
```

### Option B: Manual Git Push

```bash
# Make sure you're on staging branch
git checkout staging

# Push to trigger Vercel deployment
git push origin staging
```

### Verify Staging Deployment

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Check deployment status
3. Visit `https://app-staging.complyvault.co`
4. Test the application

## Step 4: Deploy to Production

### Option A: Promote Staging Deployment (Recommended)

1. Go to **Vercel Dashboard** → **Deployments**
2. Find the staging deployment you want to promote
3. Click the **"..."** menu (three dots)
4. Click **"Promote to Production"**
5. Confirm the promotion

This ensures production gets the exact same build that was tested on staging.

### Option B: Deploy from Main Branch

```bash
# Make sure you're on main branch
git checkout main

# Merge staging into main (if needed)
git merge staging

# Push to trigger production deployment
git push origin main
```

Or use Vercel CLI:

```bash
vercel --prod
```

### Verify Production Deployment

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Check deployment status
3. Visit `https://app.complyvault.co`
4. Test the application

## Step 5: Run Migrations (If Needed)

After deployment, verify migrations ran successfully:

### Staging

```bash
export DATABASE_URL="your-staging-database-connection-string"
npx prisma migrate deploy
```

### Production

```bash
export DATABASE_URL="your-production-database-connection-string"
npx prisma migrate deploy
```

## Quick Reference: All-in-One Commands

### Flush Both Databases

```bash
# Staging
export DATABASE_URL="your-staging-database-connection-string"
./scripts/flush-database.sh

# Production
export DATABASE_URL="your-production-database-connection-string"
./scripts/flush-database.sh
```

### Deploy Both Environments

```bash
# Use the deployment script
./scripts/deploy-to-environments.sh
# Select option 3 (Both)
```

## Troubleshooting

### Database Connection Errors

- Verify `DATABASE_URL` is correct
- Check database allows connections from your IP
- Verify SSL mode if required

### Migration Errors

- Check Prisma schema is up to date
- Verify all migrations are in `prisma/migrations/`
- Run `npx prisma migrate deploy` manually

### Deployment Failures

- Check Vercel build logs
- Verify environment variables are set
- Check database connection in deployment logs
- Ensure migrations ran successfully

### Data Still Present After Flush

- Verify you're connected to the correct database
- Check `DATABASE_URL` environment variable
- Try manual reset: `npx prisma migrate reset --force`

## Safety Checklist

Before flushing production:

- [ ] ✅ Have backups (if needed for recovery)
- [ ] ✅ Verified correct `DATABASE_URL`
- [ ] ✅ Confirmed this is the intended action
- [ ] ✅ Team is aware of the maintenance
- [ ] ✅ Staging has been tested after flush
- [ ] ✅ All migrations are ready
- [ ] ✅ Environment variables are configured

## Alternative: Selective Data Deletion

If you only want to delete specific data (not everything):

```bash
# Connect to database
export DATABASE_URL="your-database-connection-string"

# Use Prisma Studio to delete specific records
npx prisma studio

# Or use SQL directly
psql $DATABASE_URL -c "DELETE FROM \"Meeting\";"
psql $DATABASE_URL -c "DELETE FROM \"Workspace\";"
# etc.
```

## Post-Deployment Verification

After deploying, verify:

1. **Database Schema**:
   ```bash
   npx prisma studio
   # Check all tables exist and are empty
   ```

2. **Application Functionality**:
   - Sign up/Sign in works
   - Workspace creation works
   - File upload works
   - All features function correctly

3. **Environment Variables**:
   - Check Vercel dashboard
   - Verify all required vars are set
   - Check for environment-specific values

4. **Logs**:
   - Check Vercel function logs
   - Look for any errors
   - Verify database connections

## Summary

**Flush Process:**
1. Set `DATABASE_URL` for target environment
2. Run `./scripts/flush-database.sh` or `npx prisma migrate reset --force`
3. Verify database is empty

**Deploy Process:**
1. Push to `staging` branch → Auto-deploys to staging
2. Test on staging
3. Promote staging deployment → Production
4. Or push to `main` → Production (with approval if enabled)

**Time Estimate:**
- Flush staging: ~2 minutes
- Flush production: ~2 minutes
- Deploy staging: ~3-5 minutes
- Deploy production: ~3-5 minutes
- **Total: ~10-15 minutes**
