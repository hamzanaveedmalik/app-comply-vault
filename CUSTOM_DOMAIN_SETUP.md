# Custom Domain Setup Guide

This guide walks you through setting up both **Production** (`app.complyvault.co`) and **Staging** (`app-staging.complyvault.co`) environments.

## Overview: Production vs Staging

- **Production**: `app.complyvault.co` → Connected to `main` branch, Production environment
- **Staging**: `app-staging.complyvault.co` → Connected to Preview environment (all branches/PRs)

## Step 1: Add Production Domain

1. Go to your Vercel project dashboard
2. Click on **Settings** (left sidebar)
3. Click on **Domains** (under "Project Settings")
4. Click **"Add Domain"**
5. Enter: `app.complyvault.co`
6. In the modal:
   - Select **"Connect to an environment"**
   - First dropdown: Select **"Production"** (not Preview!)
   - Second dropdown: Keep **"All Branches"** or select specific branch
7. Click **"Save"**

Vercel will show you the DNS records you need to add.

## Step 2: Add Staging Domain

1. Still in **Settings** → **Domains**
2. Click **"Add Domain"** again
3. Enter: `app-staging.complyvault.co`
4. In the modal:
   - Select **"Connect to an environment"**
   - First dropdown: Select **"Preview"** (this is for staging!)
   - Second dropdown: **"All Branches"** (or select a specific staging branch)
5. Click **"Save"**

Vercel will show you a different CNAME value for staging.

## Step 3: Configure DNS in Namecheap

You need to add **two CNAME records** - one for production and one for staging.

### Add Production CNAME

1. Go to your Namecheap domain control panel for `complyvault.co`
2. Navigate to **Advanced DNS** tab
3. In the **HOST RECORDS** section, click **"+ ADD NEW RECORD"**
4. Add a **CNAME Record** for production:
   - **Type**: CNAME Record
   - **Host**: `app`
   - **Value**: Use the value from Vercel for `app.complyvault.co` (e.g., `fc812f8a67100b92.vercel-dns-017.com.`)
   - **TTL**: Automatic (or 30 min)
5. Click **Save** (checkmark icon)

### Add Staging CNAME

1. Still in **Advanced DNS**, click **"+ ADD NEW RECORD"** again
2. Add a **CNAME Record** for staging:
   - **Type**: CNAME Record
   - **Host**: `app-staging`
   - **Value**: Use the value from Vercel for `app-staging.complyvault.co` (will be different from production)
   - **TTL**: Automatic (or 30 min)
3. Click **Save** (checkmark icon)

**Important**: Always use the exact CNAME values that Vercel shows in the Domains section. Each domain gets its own unique CNAME target.

### Optional: Redirect Root Domain

If you want `complyvault.co` to redirect to `app.complyvault.co`:

1. In Namecheap Advanced DNS, add a **URL Redirect Record**:
   - **Type**: URL Redirect Record
   - **Host**: `@`
   - **Value**: `https://app.complyvault.co`
   - **Redirect Type**: Unmasked (or Masked, your preference)

## Step 4: Update Environment Variables

You need to set different `NEXT_PUBLIC_APP_URL` values for Production and Preview environments.

### Production Environment Variables

1. Go to Vercel → **Settings** → **Environment Variables**
2. Find `NEXT_PUBLIC_APP_URL` (or add it if it doesn't exist)
3. Click **Edit** (or **Add New**)
4. Set the value to: `https://app.complyvault.co` (no trailing slash)
5. **Important**: Select **ONLY "Production"** environment
6. Click **Save**

### Preview/Staging Environment Variables

1. Still in **Environment Variables**
2. Click **"Add New"** (or edit if it exists)
3. Key: `NEXT_PUBLIC_APP_URL`
4. Value: `https://app-staging.complyvault.co` (no trailing slash)
5. **Important**: Select **ONLY "Preview"** environment
6. Click **Save**

### Development Environment (Optional)

For local development, you can leave it empty or set to `http://localhost:3000`

### Other Environment Variables

Make sure all other environment variables (DATABASE_URL, AUTH_SECRET, etc.) are set for:
- **Production** (for production domain)
- **Preview** (for staging domain)
- **Development** (for local dev)

**Note**: You can use the same database for both production and staging, or separate databases. For staging, you might want a separate test database.

## Step 5: Update CORS Configuration

If you're using Cloudflare R2 or S3 with CORS, add both domains:

1. Go to your R2 bucket settings (or S3 bucket)
2. Update CORS policy to include both production and staging:
   ```json
   [
     {
       "AllowedOrigins": [
         "https://app.complyvault.co",
         "https://app-staging.complyvault.co",
         "https://*.vercel.app",
         "http://localhost:3000",
         "http://localhost:3001"
       ],
       "AllowedMethods": ["GET", "PUT", "POST", "HEAD"],
       "AllowedHeaders": ["*"],
       "ExposeHeaders": ["ETag"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```

## Step 6: Update Auth.js Callback URLs

If you're using OAuth providers (Discord, etc.), add both domains:

1. Go to your OAuth provider's app settings (e.g., Discord Developer Portal)
2. Add **both** Redirect URIs:
   - `https://app.complyvault.co/api/auth/callback/discord` (production)
   - `https://app-staging.complyvault.co/api/auth/callback/discord` (staging)
   - `http://localhost:3000/api/auth/callback/discord` (local dev, if needed)
3. Save the changes

**Note**: Some OAuth providers allow multiple redirect URIs. Add all three if you want to test locally too.

## Step 7: Set Up Staging Branch (Optional but Recommended)

To have a dedicated staging branch that always deploys to staging:

1. Create a new branch in GitHub:
   ```bash
   git checkout -b staging
   git push -u origin staging
   ```

2. In Vercel → **Settings** → **Git**:
   - Configure the `staging` branch to deploy to Preview environment
   - Or use the default: all branches deploy to Preview

3. Now:
   - Pushes to `main` → Deploys to Production (`app.complyvault.co`)
   - Pushes to `staging` or any PR → Deploys to Preview (`app-staging.complyvault.co`)

## Step 8: Redeploy

After updating environment variables:

1. Go to Vercel → **Deployments**
2. Click the **"..."** menu on the latest deployment
3. Click **"Redeploy"** for both Production and Preview
4. Or push a new commit to trigger automatic deployment

## Step 9: Verify

1. Wait for DNS propagation (can take up to 48 hours, usually 1-2 hours)
2. Check domain status in Vercel → Settings → Domains
   - Both domains should show "Valid Configuration" (green checkmark)
3. Test Production:
   - Visit `https://app.complyvault.co`
   - Test file uploads (check CORS)
   - Test OAuth login
   - Check QStash webhooks are working
4. Test Staging:
   - Visit `https://app-staging.complyvault.co`
   - Verify it shows the Preview/Staging deployment
   - Test the same features to ensure staging works

## Troubleshooting

### Domain Not Verifying

- **Check DNS records**: Make sure the CNAME record is correct
- **Wait for propagation**: DNS changes can take time
- **Check TTL**: Lower TTL values help with faster updates
- **Verify in Vercel**: Check the Domains page for specific error messages

### SSL Certificate Issues

- Vercel automatically provisions SSL certificates via Let's Encrypt
- This happens automatically after DNS verification
- Can take a few minutes after DNS is verified

### CORS Errors

- Make sure you've updated R2/S3 CORS configuration
- Check that `NEXT_PUBLIC_APP_URL` is set correctly
- Clear browser cache and try again

### QStash Not Working

- **Production**: Verify `NEXT_PUBLIC_APP_URL` is set to `https://app.complyvault.co` for Production environment
- **Staging**: Verify `NEXT_PUBLIC_APP_URL` is set to `https://app-staging.complyvault.co` for Preview environment
- Check QStash dashboard for webhook delivery status
- Redeploy after updating the environment variable
- Make sure you're testing the correct environment (production vs staging)

### Staging Domain Not Working

- Verify the staging domain is connected to **Preview** environment (not Production)
- Check that `NEXT_PUBLIC_APP_URL` is set correctly for Preview environment
- Make sure you've pushed to a branch that triggers Preview deployments
- Check Vercel → Deployments to see which deployments are assigned to Preview

## Workflow Summary

### Production Workflow
- **Domain**: `app.complyvault.co`
- **Environment**: Production
- **Branches**: `main` branch (or branches you configure)
- **Database**: Production database
- **URL**: Set `NEXT_PUBLIC_APP_URL` to `https://app.complyvault.co` (Production env only)

### Staging Workflow
- **Domain**: `app-staging.complyvault.co`
- **Environment**: Preview
- **Branches**: All branches except `main`, or specific `staging` branch
- **Database**: Can use same production DB or separate staging DB
- **URL**: Set `NEXT_PUBLIC_APP_URL` to `https://app-staging.complyvault.co` (Preview env only)

### Typical Development Flow

1. **Feature Development**: Work on a feature branch
2. **Create PR**: Opens a preview deployment (uses staging domain if configured)
3. **Test on Staging**: Test on `app-staging.complyvault.co`
4. **Merge to Main**: Merges to `main` → Auto-deploys to `app.complyvault.co`

## Alternative: Using Root Domain

If you prefer to use `complyvault.co` directly (not recommended for SaaS apps):

1. Add `complyvault.co` as a domain in Vercel
2. Add an **A Record** in Namecheap (Vercel will provide the IP)
3. Or use **ALIAS Record** if available
4. Update all environment variables and configurations accordingly

**Note**: Using root domain means you can't easily add a marketing site later without additional configuration.

