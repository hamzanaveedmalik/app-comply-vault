# QStash Troubleshooting Guide

If you're not seeing messages in the QStash dashboard, check the following:

## Required Environment Variables

Make sure these are set in Vercel:

1. **QSTASH_TOKEN** - Your QStash token from the Upstash dashboard
2. **NEXT_PUBLIC_APP_URL** - Your public Vercel URL (e.g., `https://intelli-vault.vercel.app`)

## Common Issues

### 1. QSTASH_TOKEN Not Set

**Symptom:** No messages appear in QStash dashboard, meetings stay in "UPLOADING" status

**Solution:**
1. Go to [Upstash QStash Dashboard](https://console.upstash.com/qstash)
2. Copy your `QSTASH_TOKEN` from the Quickstart section
3. Add it to Vercel → Settings → Environment Variables
4. Redeploy your application

### 2. NEXT_PUBLIC_APP_URL Not Set or Wrong

**Symptom:** Jobs are published but fail immediately, or webhook can't be reached

**Solution:**
1. Set `NEXT_PUBLIC_APP_URL` to your Vercel deployment URL
2. Format: `https://your-app.vercel.app` (no trailing slash)
3. **Important:** Cannot be `localhost` - QStash can't reach localhost URLs

### 3. Webhook URL Not Accessible

**Symptom:** QStash shows failed messages

**Check:**
- Your Vercel deployment is live and accessible
- The endpoint `/api/jobs/process-meeting` exists and is accessible
- No authentication blocking QStash requests (middleware should allow this endpoint)

### 4. Missing QStash Signing Keys

**Symptom:** Webhook handler rejects requests

**Solution:**
1. Get `QSTASH_CURRENT_SIGNING_KEY` and `QSTASH_NEXT_SIGNING_KEY` from QStash dashboard
2. Add them to Vercel environment variables
3. These are used to verify webhook signatures

## Testing QStash Connection

### Check if Jobs Are Being Published

1. Upload a meeting recording
2. Check Vercel function logs for:
   - `✅ QStash job published successfully!` - Success
   - `❌ Error publishing QStash job:` - Failure (check error message)

### Check QStash Dashboard

1. Go to [QStash Dashboard](https://console.upstash.com/qstash)
2. Click on **"Logs"** tab
3. You should see:
   - Published messages
   - Webhook delivery attempts
   - Success/failure status

### Manual Test

You can manually trigger a job to test:

```bash
curl -X POST https://qstash.upstash.io/v2/publish/YOUR_WEBHOOK_URL \
  -H "Authorization: Bearer YOUR_QSTASH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"meetingId":"test-id","workspaceId":"test-workspace","fileUrl":"test-url"}'
```

## Environment Variables Checklist

- [ ] `QSTASH_TOKEN` - From QStash dashboard
- [ ] `QSTASH_CURRENT_SIGNING_KEY` - From QStash dashboard
- [ ] `QSTASH_NEXT_SIGNING_KEY` - From QStash dashboard (optional, for key rotation)
- [ ] `NEXT_PUBLIC_APP_URL` - Your Vercel URL (e.g., `https://intelli-vault.vercel.app`)

## Getting QStash Credentials

1. Go to [Upstash Console](https://console.upstash.com/)
2. Navigate to **QStash** → **Overview**
3. In the **Quickstart** section, you'll see:
   - `QSTASH_TOKEN`
   - `QSTASH_CURRENT_SIGNING_KEY`
   - `QSTASH_NEXT_SIGNING_KEY`
4. Copy each value and add to Vercel environment variables

## Debugging Steps

1. **Check Vercel Logs:**
   - Go to Vercel → Your Project → Logs
   - Look for QStash-related log messages
   - Check for error messages

2. **Check QStash Logs:**
   - Go to QStash Dashboard → Logs
   - See if messages are being published
   - Check webhook delivery status

3. **Verify Environment Variables:**
   - In Vercel, go to Settings → Environment Variables
   - Ensure all QStash variables are set
   - Make sure they're set for **Production** environment

4. **Test Webhook Endpoint:**
   - Try accessing `https://your-app.vercel.app/api/jobs/process-meeting` directly
   - Should return an error (expected - needs QStash signature)
   - But confirms the endpoint exists

## Still Not Working?

1. Check that your Vercel deployment has the latest code
2. Verify environment variables are set correctly
3. Check QStash dashboard for any error messages
4. Review Vercel function logs for detailed error messages

