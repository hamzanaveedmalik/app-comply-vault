# Staging Environment Setup Guide

This guide walks you through setting up separate resources for staging to prevent data mixing and ensure safe testing.

## Overview

**Critical Resources (MUST be separate):**
- ✅ Database (DATABASE_URL)
- ✅ S3/R2 Storage (S3_BUCKET_NAME, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY)
- ✅ AUTH_SECRET
- ✅ NEXT_PUBLIC_APP_URL

**Best Practice (SHOULD be separate):**
- API Keys (OPENAI_API_KEY, ANTHROPIC_API_KEY, DEEPGRAM_API_KEY)
- RESEND_API_KEY

**Can Share:**
- AUTH_DISCORD_ID & AUTH_DISCORD_SECRET (Discord allows multiple redirect URLs)
- QStash tokens (unless you want separate queues)

---

## Step 1: Create Staging Database (Neon)

### 1.1 Create New Neon Project

1. Go to [Neon Console](https://console.neon.tech)
2. Click **"Create Project"**
3. Project name: `ria-compliance-staging` (or similar)
4. Region: Same as production (for consistency)
5. PostgreSQL version: Same as production
6. Click **"Create Project"**

### 1.2 Get Connection String

1. In your new Neon project, go to **"Connection Details"**
2. Copy the **Connection String** (looks like: `postgresql://user:password@host/database?sslmode=require`)
3. Save this for Step 4

### 1.3 Run Migrations on Staging Database

```bash
# Set staging database URL temporarily
export DATABASE_URL="your-staging-neon-connection-string"

# Run migrations
cd ria-compliance-tool
npx prisma migrate deploy

# Or if you need to push schema
npx prisma db push
```

### 1.4 Verify Database

```bash
# Open Prisma Studio to verify
npx prisma studio
# Should show empty database (no production data)
```

---

## Step 2: Create Staging R2 Bucket

### 2.1 Create New R2 Bucket

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Navigate to **R2** → **Create bucket**
3. Bucket name: `ria-compliance-recordings-staging`
4. Location: Same as production
5. Click **"Create bucket"**

### 2.2 Create API Token for Staging

1. In Cloudflare Dashboard → **R2** → **Manage R2 API Tokens**
2. Click **"Create API token"**
3. Token name: `ria-compliance-staging`
4. Permissions: **Object Read & Write**
5. Bucket: Select `ria-compliance-recordings-staging`
6. Click **"Create API Token"**
7. **IMPORTANT**: Copy and save:
   - **Access Key ID**
   - **Secret Access Key**
   - You won't be able to see the secret again!

### 2.3 Get R2 Endpoint

1. In your R2 bucket settings
2. Find **"S3 API"** section
3. Copy the **Endpoint URL** (looks like: `https://xxxxx.r2.cloudflarestorage.com`)
4. Save this for Step 4

### 2.4 Configure CORS for Staging

1. Go to your staging bucket → **Settings** → **CORS Policy**
2. Add staging domain:
   ```json
   [
     {
       "AllowedOrigins": [
         "https://app-staging.complyvault.co",
         "https://app.complyvault.co",
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
3. Click **"Save"**

---

## Step 3: Generate New AUTH_SECRET

### 3.1 Generate Secret

```bash
# Generate new auth secret for staging
npx @auth/core secret
```

This will output a new secret. Copy it for Step 4.

**Alternative method:**
```bash
# Or use openssl
openssl rand -base64 32
```

---

## Step 4: Configure Environment Variables in Vercel

### 4.1 Production Environment Variables

Go to **Vercel** → **Settings** → **Environment Variables**

**For Production environment ONLY:**

```
DATABASE_URL=postgresql://... (your production Neon database)
S3_BUCKET_NAME=ria-compliance-recordings
S3_ACCESS_KEY_ID=... (production R2 key)
S3_SECRET_ACCESS_KEY=... (production R2 secret)
S3_ENDPOINT=https://...r2.cloudflarestorage.com (production endpoint)
AUTH_SECRET=... (your current production secret)
NEXT_PUBLIC_APP_URL=https://app.complyvault.co
```

### 4.2 Preview Environment Variables

**For Preview environment ONLY:**

```
DATABASE_URL=postgresql://... (NEW staging Neon database)
S3_BUCKET_NAME=ria-compliance-recordings-staging
S3_ACCESS_KEY_ID=... (NEW staging R2 key)
S3_SECRET_ACCESS_KEY=... (NEW staging R2 secret)
S3_ENDPOINT=https://...r2.cloudflarestorage.com (staging endpoint)
AUTH_SECRET=... (NEW secret from Step 3)
NEXT_PUBLIC_APP_URL=https://app-staging.complyvault.co
```

### 4.3 How to Add in Vercel

1. Go to **Settings** → **Environment Variables**
2. For each variable:
   - Click **"Add New"**
   - Enter **Key** (e.g., `DATABASE_URL`)
   - Enter **Value** (your staging value)
   - **IMPORTANT**: Select **ONLY "Preview"** environment
   - Click **"Save"**
3. Repeat for each staging variable

**Pro Tip**: You can have the same variable name with different values for Production vs Preview!

---

## Step 5: Optional - Separate API Keys

### 5.1 OpenAI API Key (Optional)

1. Go to [OpenAI Platform](https://platform.openai.com/api-keys)
2. Create new API key: `ria-compliance-staging`
3. Set lower rate limits if desired
4. Add to Vercel Preview environment: `OPENAI_API_KEY`

### 5.2 Anthropic API Key (Optional)

1. Go to [Anthropic Console](https://console.anthropic.com)
2. Create new API key for staging
3. Add to Vercel Preview environment: `ANTHROPIC_API_KEY`

### 5.3 Deepgram API Key (Optional)

1. Go to [Deepgram Dashboard](https://console.deepgram.com)
2. Create new project: `ria-compliance-staging`
3. Get API key
4. Add to Vercel Preview environment: `DEEPGRAM_API_KEY`

### 5.4 Resend API Key (Optional)

1. Go to [Resend Dashboard](https://resend.com/api-keys)
2. Create new API key for staging
3. Or use sandbox mode (emails won't send)
4. Add to Vercel Preview environment: `RESEND_API_KEY`

---

## Step 6: Update OAuth Redirect URLs

### 6.1 Discord

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Select your app
3. Go to **OAuth2** → **Redirects**
4. Add: `https://app-staging.complyvault.co/api/auth/callback/discord`
5. Save changes

---

## Step 7: Verify Setup

### 7.1 Test Staging Deployment

1. Push to staging branch:
   ```bash
   git checkout staging
   git push origin staging
   ```

2. Check Vercel deployment:
   - Should use Preview environment variables
   - Should connect to staging database
   - Should use staging R2 bucket

3. Test on staging:
   - Visit `https://app-staging.complyvault.co`
   - Sign in (should work with Discord)
   - Upload a test file (should go to staging bucket)
   - Check database (should be empty, separate from production)

### 7.2 Verify Data Isolation

**Production:**
- Visit `https://app.complyvault.co`
- Check data (should be production data)

**Staging:**
- Visit `https://app-staging.complyvault.co`
- Check data (should be empty or test data only)

---

## Step 8: Environment Variable Checklist

### Production Environment (Vercel)

- [ ] `DATABASE_URL` - Production Neon database
- [ ] `S3_BUCKET_NAME` - `ria-compliance-recordings`
- [ ] `S3_ACCESS_KEY_ID` - Production R2 key
- [ ] `S3_SECRET_ACCESS_KEY` - Production R2 secret
- [ ] `S3_ENDPOINT` - Production R2 endpoint
- [ ] `AUTH_SECRET` - Production secret
- [ ] `NEXT_PUBLIC_APP_URL` - `https://app.complyvault.co`
- [ ] `AUTH_DISCORD_ID` - (can share)
- [ ] `AUTH_DISCORD_SECRET` - (can share)
- [ ] `QSTASH_TOKEN` - (can share)
- [ ] `QSTASH_CURRENT_SIGNING_KEY` - (can share)
- [ ] `QSTASH_NEXT_SIGNING_KEY` - (can share)

### Preview Environment (Vercel)

- [ ] `DATABASE_URL` - **NEW** Staging Neon database
- [ ] `S3_BUCKET_NAME` - `ria-compliance-recordings-staging`
- [ ] `S3_ACCESS_KEY_ID` - **NEW** Staging R2 key
- [ ] `S3_SECRET_ACCESS_KEY` - **NEW** Staging R2 secret
- [ ] `S3_ENDPOINT` - **NEW** Staging R2 endpoint
- [ ] `AUTH_SECRET` - **NEW** Generated secret
- [ ] `NEXT_PUBLIC_APP_URL` - `https://app-staging.complyvault.co`
- [ ] `AUTH_DISCORD_ID` - (can share)
- [ ] `AUTH_DISCORD_SECRET` - (can share)
- [ ] `QSTASH_TOKEN` - (can share)
- [ ] `QSTASH_CURRENT_SIGNING_KEY` - (can share)
- [ ] `QSTASH_NEXT_SIGNING_KEY` - (can share)

---

## Troubleshooting

### Staging Using Production Database

- Check Vercel → Settings → Environment Variables
- Verify `DATABASE_URL` is set for **Preview** environment
- Make sure you didn't accidentally set it for "All Environments"

### Files Going to Wrong Bucket

- Verify `S3_BUCKET_NAME` is different for Preview
- Check `S3_ACCESS_KEY_ID` and `S3_SECRET_ACCESS_KEY` are staging keys
- Verify bucket permissions in Cloudflare

### Auth Not Working on Staging

- Check `AUTH_SECRET` is different for Preview
- Verify Discord redirect URL includes staging domain
- Check `NEXT_PUBLIC_APP_URL` is set correctly

### Environment Variables Not Applying

- After adding variables, **redeploy** the staging deployment
- Or push a new commit to staging branch
- Check deployment logs to see which env vars were used

---

## Quick Reference

### Production Resources
- Database: Production Neon
- Storage: `ria-compliance-recordings`
- Domain: `app.complyvault.co`

### Staging Resources
- Database: Staging Neon (NEW)
- Storage: `ria-compliance-recordings-staging` (NEW)
- Domain: `app-staging.complyvault.co`

### Shared Resources
- Discord OAuth (same app, multiple redirects)
- QStash (same queue)

