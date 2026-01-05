# Vercel Environment Variables - Quick Reference

Copy these to Vercel → Settings → Environment Variables **BEFORE deploying**.

## Required Variables (Minimum 7)

```
DATABASE_URL=postgresql://user:password@host:port/database?schema=public
AUTH_SECRET=your-generated-secret
AUTH_DISCORD_ID=your-discord-client-id
AUTH_DISCORD_SECRET=your-discord-secret
S3_BUCKET_NAME=your-bucket-name
S3_ACCESS_KEY_ID=your-access-key
S3_SECRET_ACCESS_KEY=your-secret-key
```

## Optional but Recommended

```
S3_REGION=us-east-1
S3_ENDPOINT=https://your-account-id.r2.cloudflarestorage.com
QSTASH_TOKEN=your-qstash-token
QSTASH_CURRENT_SIGNING_KEY=your-signing-key
QSTASH_NEXT_SIGNING_KEY=your-next-signing-key
TRANSCRIPTION_PROVIDER=deepgram
DEEPGRAM_API_KEY=your-deepgram-key
RESEND_API_KEY=your-resend-key
EMAIL_FROM=noreply@yourdomain.com
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

## How to Add in Vercel

1. Go to your project in Vercel
2. Click **Settings** (left sidebar)
3. Click **Environment Variables**
4. Click **"Add New"**
5. Enter:
   - **Key**: `DATABASE_URL`
   - **Value**: `postgresql://...`
   - **Environment**: Select Production, Preview, Development (or all)
6. Click **"Save"**
7. Repeat for each variable

## After Adding Variables

1. Go back to **Deployments** tab
2. Click **"Redeploy"** on the latest deployment
3. Or push a new commit to trigger a new deployment

## Quick Copy Checklist

- [ ] DATABASE_URL
- [ ] AUTH_SECRET
- [ ] AUTH_DISCORD_ID
- [ ] AUTH_DISCORD_SECRET
- [ ] S3_BUCKET_NAME
- [ ] S3_ACCESS_KEY_ID
- [ ] S3_SECRET_ACCESS_KEY
- [ ] S3_REGION (optional)
- [ ] S3_ENDPOINT (optional, for R2)
- [ ] QSTASH_TOKEN (optional)
- [ ] QSTASH_CURRENT_SIGNING_KEY (optional)
- [ ] QSTASH_NEXT_SIGNING_KEY (optional)
- [ ] TRANSCRIPTION_PROVIDER (optional)
- [ ] DEEPGRAM_API_KEY (optional)
- [ ] RESEND_API_KEY (optional)
- [ ] EMAIL_FROM (optional)
- [ ] NEXT_PUBLIC_APP_URL (optional, set after first deploy)

