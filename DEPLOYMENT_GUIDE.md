# Deployment Guide: GitHub + Vercel

## Step 1: Prepare for GitHub

### 1.1 Check .gitignore

Make sure `.env` and sensitive files are ignored:

```bash
cd ria-compliance-tool
cat .gitignore | grep -E "\.env|node_modules"
```

Should see:
- `.env`
- `.env*.local`
- `node_modules/`

### 1.2 Create .env.example (Optional but Recommended)

Create a template file for other developers:

```bash
cp .env .env.example
# Then edit .env.example to remove actual secrets, keep variable names
```

## Step 2: Initialize Git Repository

### 2.1 Check if Git is initialized

```bash
cd ria-compliance-tool
git status
```

If you see "not a git repository", initialize:

```bash
git init
```

### 2.2 Add all files

```bash
git add .
```

### 2.3 Create initial commit

```bash
git commit -m "Initial commit: EPIC 1 & 2 complete - Foundation + Transcription Pipeline"
```

## Step 3: Push to GitHub

### 3.1 Create GitHub Repository

1. Go to https://github.com/new
2. Repository name: `ria-compliance-tool` (or your preferred name)
3. Description: "RIA Compliance Tool - Exam-ready client interaction records"
4. Choose: **Private** (recommended for now)
5. **Don't** initialize with README, .gitignore, or license
6. Click "Create repository"

### 3.2 Add Remote and Push

GitHub will show you commands. Run:

```bash
# Add remote (replace YOUR_USERNAME with your GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/ria-compliance-tool.git

# Rename branch to main (if needed)
git branch -M main

# Push to GitHub
git push -u origin main
```

If you get authentication errors, you may need to:
- Use GitHub CLI: `gh auth login`
- Or use SSH: `git remote set-url origin git@github.com:YOUR_USERNAME/ria-compliance-tool.git`

## Step 4: Deploy to Vercel

### 4.1 Connect Repository

1. Go to https://vercel.com
2. Sign up/login (use GitHub account for easiest setup)
3. Click "Add New Project"
4. Import your GitHub repository: `ria-compliance-tool`
5. Click "Import"

### 4.2 Configure Project

Vercel will auto-detect Next.js. Settings:

- **Framework Preset**: Next.js (auto-detected)
- **Root Directory**: `./` (or `ria-compliance-tool` if repo is in subdirectory)
- **Build Command**: `npm run build` (default)
- **Output Directory**: `.next` (default)
- **Install Command**: `npm install` (default)

**⚠️ STOP HERE - Don't click "Deploy" yet!**

### 4.3 Add Environment Variables (CRITICAL - Do This BEFORE Deploying)

**The build will fail if you don't add environment variables first!**

Before clicking "Deploy", you MUST add environment variables:

**⚠️ IMPORTANT**: You MUST add environment variables BEFORE clicking "Deploy", otherwise the build will fail.

1. **Before clicking "Deploy"**, go to **Settings** → **Environment Variables** (in the left sidebar)
2. Click **"Add New"** for each variable below
3. Select environment: **Production**, **Preview**, and **Development** (or at least Production)
4. Add each variable one by one:

**Required (Minimum for Build to Succeed):**
```
DATABASE_URL=postgresql://...
AUTH_SECRET=...
AUTH_DISCORD_ID=...
AUTH_DISCORD_SECRET=...
S3_BUCKET_NAME=...
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
```

**Optional but Recommended:**
```
S3_REGION=us-east-1
S3_ENDPOINT=https://...r2.cloudflarestorage.com
QSTASH_TOKEN=...
QSTASH_CURRENT_SIGNING_KEY=...
QSTASH_NEXT_SIGNING_KEY=...
TRANSCRIPTION_PROVIDER=deepgram
DEEPGRAM_API_KEY=...
RESEND_API_KEY=...
EMAIL_FROM=...
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

**Important Notes:**
- ⚠️ **Add ALL required variables BEFORE clicking "Deploy"** - Build will fail without them
- `NEXT_PUBLIC_APP_URL` - Set to your Vercel URL after first deploy (or leave empty for now)
- Add variables for **Production**, **Preview**, and **Development** environments
- Never commit `.env` file to GitHub!
- You can add variables one by one, or use "Bulk Add" if available

### 4.4 Deploy

1. Click "Deploy"
2. Wait for build to complete (~2-3 minutes)
3. Vercel will provide a URL: `https://your-app.vercel.app`

### 4.5 Update NEXT_PUBLIC_APP_URL

After first deploy:

1. Go to **Settings** → **Environment Variables**
2. Update `NEXT_PUBLIC_APP_URL` to your Vercel URL
3. Redeploy (or it will auto-update on next push)

## Step 5: Set Up Database (Production)

### 5.1 Production Database Options

**Option A: Vercel Postgres (Recommended)**
- Go to Vercel dashboard → **Storage** → **Create Database** → **Postgres**
- Copy connection string → Add as `DATABASE_URL` in environment variables

**Option B: Supabase (Free Tier)**
- Go to https://supabase.com
- Create project
- Get connection string from Settings → Database
- Add as `DATABASE_URL` in Vercel

**Option C: Neon (Free Tier)**
- Go to https://neon.tech
- Create project
- Get connection string
- Add as `DATABASE_URL` in Vercel

### 5.2 Run Migrations

After setting up production database:

```bash
# Set production DATABASE_URL temporarily
export DATABASE_URL="your-production-database-url"

# Run migrations
cd ria-compliance-tool
npx prisma migrate deploy
```

Or use Vercel CLI:
```bash
vercel env pull .env.production
npx prisma migrate deploy
```

## Step 6: Verify Deployment

### 6.1 Test the App

1. Visit your Vercel URL
2. Sign in with Discord
3. Create workspace
4. Upload a test meeting
5. Check QStash dashboard - should see messages!

### 6.2 Check QStash

1. Go to QStash dashboard → **Logs**
2. Should see webhook calls to your Vercel URL
3. Messages should be processing

### 6.3 Monitor Logs

In Vercel dashboard:
- Go to **Deployments** → Click latest deployment → **Functions** tab
- Check logs for any errors

## Step 7: Continuous Deployment

After initial setup:

1. **Push to GitHub** → Vercel auto-deploys
2. **Environment variables** persist across deployments
3. **Database migrations** run automatically (if configured)

## Troubleshooting

### Build Fails

- Check build logs in Vercel
- Common issues:
  - Missing environment variables
  - TypeScript errors
  - Prisma client not generated

### QStash Still Not Working

- Verify `NEXT_PUBLIC_APP_URL` is set to Vercel URL (not localhost)
- Check QStash dashboard for failed messages
- Verify webhook URL in QStash logs matches Vercel URL

### Database Connection Issues

- Verify `DATABASE_URL` is correct
- Check database allows connections from Vercel IPs
- Run migrations: `npx prisma migrate deploy`

## Next Steps After Deployment

1. ✅ Test full workflow: Upload → Process → View transcript
2. ✅ Set up custom domain (optional)
3. ✅ Configure production email (Resend)
4. ✅ Set up monitoring (Vercel Analytics)

## Security Checklist

- [ ] `.env` is in `.gitignore` ✅
- [ ] No secrets committed to GitHub
- [ ] All environment variables set in Vercel
- [ ] Database connection string is secure
- [ ] QStash signing keys are set
- [ ] Production AUTH_SECRET is strong

