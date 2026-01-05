# Cloudflare R2 CORS Configuration

If you're getting "Upload to storage failed: Failed to fetch" errors, you need to configure CORS on your R2 bucket.

## Step 1: Configure CORS in Cloudflare Dashboard

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Navigate to **R2** → Your bucket
3. Click on **Settings** tab
4. Scroll down to **CORS Policy**
5. Click **Edit CORS Policy**

## Step 2: Add CORS Configuration

Add the following CORS configuration:

```json
[
  {
    "AllowedOrigins": [
      "https://intelli-vault.vercel.app",
      "https://*.vercel.app",
      "http://localhost:3000",
      "http://localhost:3001"
    ],
    "AllowedMethods": [
      "GET",
      "PUT",
      "POST",
      "HEAD"
    ],
    "AllowedHeaders": [
      "*"
    ],
    "ExposeHeaders": [
      "ETag"
    ],
    "MaxAgeSeconds": 3600
  }
]
```

**Important Notes:**
- Replace `https://intelli-vault.vercel.app` with your actual Vercel domain
- Add `http://localhost:3000` and `http://localhost:3001` for local development
- The `PUT` method is required for presigned URL uploads
- `AllowedHeaders: ["*"]` allows all headers (you can restrict this if needed)

## Step 3: Save and Test

1. Click **Save** to apply the CORS policy
2. Wait a few seconds for changes to propagate
3. Try uploading a file again

## Alternative: Using Wrangler CLI

If you prefer using the CLI:

```bash
# Install Wrangler if you haven't
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Set CORS policy
wrangler r2 bucket cors put YOUR_BUCKET_NAME --file cors.json
```

Create a `cors.json` file:
```json
[
  {
    "AllowedOrigins": [
      "https://intelli-vault.vercel.app",
      "https://*.vercel.app",
      "http://localhost:3000"
    ],
    "AllowedMethods": ["GET", "PUT", "POST", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

## Troubleshooting

### Still getting CORS errors?

1. **Check the browser console** - Look for specific CORS error messages
2. **Verify the origin** - Make sure your Vercel domain matches exactly (including `https://`)
3. **Clear browser cache** - Sometimes cached CORS policies cause issues
4. **Check R2 bucket settings** - Ensure the bucket is public or has proper access configured

### Common Issues

- **"No 'Access-Control-Allow-Origin' header"** - CORS not configured or origin not in allowed list
- **"Method PUT not allowed"** - Add `PUT` to `AllowedMethods`
- **"Preflight request failed"** - Check `AllowedHeaders` includes the headers your request sends

## Testing CORS

You can test CORS configuration using curl:

```bash
curl -X OPTIONS https://your-account-id.r2.cloudflarestorage.com/your-bucket/key \
  -H "Origin: https://intelli-vault.vercel.app" \
  -H "Access-Control-Request-Method: PUT" \
  -v
```

Look for `Access-Control-Allow-Origin` in the response headers.

