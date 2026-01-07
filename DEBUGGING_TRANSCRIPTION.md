# Debugging Transcription Issues

If your meeting shows "Upload complete: Yes" but "Transcription complete: No", follow these steps:

## Quick Checks

### 1. Check QStash Dashboard

1. Go to [Upstash QStash Dashboard](https://console.upstash.com/qstash)
2. Click on **"Logs"** tab
3. Look for messages with your meeting ID
4. Check the status:
   - **Pending** - Job is queued, waiting to be processed
   - **Success** - Job completed successfully
   - **Failed** - Job failed (check error details)

### 2. Check Vercel Function Logs

1. Go to Vercel Dashboard → Your Project → Functions
2. Look for `/api/jobs/process-meeting` function
3. Check for:
   - `Transcribing meeting [id]...` - Transcription started
   - `✅ Processing complete` - Success
   - `❌ Transcription failed` - Error (check error message)

### 3. Check Transcription Service

If using **Deepgram**:
- Verify `DEEPGRAM_API_KEY` is set and valid
- Check [Deepgram Dashboard](https://console.deepgram.com) for:
  - API usage/quota
  - Error logs
  - Account status

If using **AssemblyAI**:
- Verify `ASSEMBLYAI_API_KEY` is set and valid
- Check [AssemblyAI Dashboard](https://www.assemblyai.com/app) for:
  - API usage/quota
  - Error logs
  - Account status

## Common Issues

### Issue: QStash Job Not Being Called

**Symptoms:**
- Upload complete: Yes
- Transcription complete: No
- No events in QStash dashboard

**Possible Causes:**
1. **QStash signature verification failing** (production only)
   - Check `QSTASH_CURRENT_SIGNING_KEY` and `QSTASH_NEXT_SIGNING_KEY` are set
   - Verify keys match QStash dashboard

2. **Webhook URL not accessible**
   - Verify `NEXT_PUBLIC_APP_URL` is correct
   - Test: `curl https://your-app.vercel.app/api/jobs/process-meeting` (should return 405 Method Not Allowed, not 404)

3. **Vercel deployment paused**
   - Check Vercel dashboard - deployment should be "Ready"

### Issue: Transcription Service Failing

**Symptoms:**
- QStash job shows "Failed" in dashboard
- Vercel logs show transcription errors

**Possible Causes:**
1. **Invalid API key**
   - Verify API key is correct
   - Check for typos or extra spaces

2. **Insufficient credits/quota**
   - Check provider dashboard for account limits
   - Verify billing is active

3. **File format not supported**
   - Supported: `.mp3`, `.mp4`, `.wav`, `.m4a`
   - Check file extension matches actual format

4. **File too large**
   - Check file size (max 500MB)
   - Large files may timeout

### Issue: Transcription Taking Too Long

**Symptoms:**
- Status stuck in PROCESSING
- No errors in logs
- Transcription service shows "processing"

**Possible Causes:**
1. **Large file size**
   - 6-7MB files: ~1-2 minutes
   - 30-minute audio: ~2-3 minutes
   - Very long files may take 5-10 minutes

2. **Vercel function timeout**
   - Hobby plan: 10 seconds (may be too short)
   - Pro plan: 60 seconds
   - Consider upgrading or using longer timeout

3. **Transcription service rate limits**
   - Check provider dashboard for rate limits
   - May need to wait or upgrade plan

## Manual Debugging

### Check Meeting Status via API

```bash
# Get debug information
curl https://your-app.vercel.app/api/debug/meeting/[meeting-id] \
  -H "Cookie: next-auth.session-token=YOUR_SESSION_TOKEN"
```

### Check QStash Message Status

1. Go to QStash Dashboard → Logs
2. Find your meeting ID in the message body
3. Click on the message to see:
   - Request/Response details
   - Error messages
   - Retry attempts

### Test Transcription Service Directly

```bash
# Test Deepgram (if using)
curl --request POST \
  --url https://api.deepgram.com/v1/listen \
  --header 'Authorization: Token YOUR_DEEPGRAM_API_KEY' \
  --header 'Content-Type: audio/mp3' \
  --data-binary @your-audio-file.mp3

# Test AssemblyAI (if using)
curl --request POST \
  --url https://api.assemblyai.com/v2/transcript \
  --header 'Authorization: YOUR_ASSEMBLYAI_API_KEY' \
  --header 'Content-Type: application/json' \
  --data '{"audio_url": "YOUR_AUDIO_URL"}'
```

## Next Steps

1. **If QStash job is pending**: Wait a few minutes, then refresh
2. **If QStash job failed**: Check error details in QStash dashboard
3. **If transcription service error**: Fix API key or quota issue, then retry
4. **If still stuck**: Check Vercel function logs for detailed error messages

## Retry Processing

If transcription hasn't started after 5 minutes:
1. Go to meeting detail page
2. Click "Retry Processing" in debug panel
3. This will republish the QStash job

