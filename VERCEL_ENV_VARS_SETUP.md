# Step-by-Step: Setting Up Environment Variables in Vercel

This guide shows you exactly how to add environment variables for both **Production** and **Preview/Staging** environments in Vercel.

## Prerequisites

- Access to your Vercel project
- Your Google OAuth credentials ready:

**Production:**
  - Client ID: `[REDACTED - Get from Google Cloud Console]`
  - Client Secret: `[REDACTED - Get from Google Cloud Console]`

**Staging:**
  - Client ID: `[REDACTED - Get from Google Cloud Console]`
  - Client Secret: `[REDACTED - Get from Google Cloud Console]`

---

## Step 1: Navigate to Environment Variables

1. Go to [Vercel Dashboard](https://vercel.com)
2. Click on your project: **ria-compliance-tool** (or your project name)
3. Click on **"Settings"** tab (top navigation)
4. In the left sidebar, click **"Environment Variables"**

You should now see a page with:
- A list of existing environment variables (if any)
- An **"Add New"** button

---

## Step 2: Add AUTH_GOOGLE_ID for Production

### 2.1 Click "Add New"

Click the **"Add New"** button (usually at the top right or in the middle of the page)

### 2.2 Fill in the Form

You'll see a form with these fields:

**Key:**
- Type: `AUTH_GOOGLE_ID`

**Value:**
- Type: `[REDACTED - Get from Google Cloud Console]`

**Environment:**
- ⚠️ **IMPORTANT**: Check ONLY **"Production"**
- Uncheck "Preview" and "Development" (if they're checked)

**Description (Optional):**
- You can add: `Google OAuth Client ID for production`

### 2.3 Save

Click the **"Save"** button

✅ You should see `AUTH_GOOGLE_ID` appear in the list with a "Production" badge

---

## Step 3: Add AUTH_GOOGLE_SECRET for Production

### 3.1 Click "Add New" Again

Click **"Add New"** button again

### 3.2 Fill in the Form

**Key:**
- Type: `AUTH_GOOGLE_SECRET`

**Value:**
- Type: `[REDACTED - Get from Google Cloud Console]`

**Environment:**
- ⚠️ **IMPORTANT**: Check ONLY **"Production"**
- Uncheck "Preview" and "Development"

**Description (Optional):**
- You can add: `Google OAuth Client Secret for production`

### 3.3 Save

Click **"Save"** button

✅ You should see `AUTH_GOOGLE_SECRET` appear in the list with a "Production" badge

---

## Step 4: Add AUTH_GOOGLE_ID for Preview/Staging

### 4.1 Click "Add New"

Click **"Add New"** button again

### 4.2 Fill in the Form

**Key:**
- Type: `AUTH_GOOGLE_ID`
- ⚠️ **Note**: Same key name as production, but different environment!

**Value:**
- Type: `[REDACTED - Get from Google Cloud Console]`
- ⚠️ **Note**: Different value from production (different Google OAuth app for staging)

**Environment:**
- ⚠️ **IMPORTANT**: Check ONLY **"Preview"**
- Uncheck "Production" and "Development"

**Description (Optional):**
- You can add: `Google OAuth Client ID for staging`

### 4.3 Save

Click **"Save"** button

✅ You should now see TWO `AUTH_GOOGLE_ID` entries:
- One with "Production" badge
- One with "Preview" badge

---

## Step 5: Add AUTH_GOOGLE_SECRET for Preview/Staging

### 5.1 Click "Add New"

Click **"Add New"** button again

### 5.2 Fill in the Form

**Key:**
- Type: `AUTH_GOOGLE_SECRET`
- ⚠️ **Note**: Same key name as production, but different environment!

**Value:**
- Type: `[REDACTED - Get from Google Cloud Console]`
- ⚠️ **Note**: Different value from production (different Google OAuth app for staging)

**Environment:**
- ⚠️ **IMPORTANT**: Check ONLY **"Preview"**
- Uncheck "Production" and "Development"

**Description (Optional):**
- You can add: `Google OAuth Client Secret for staging`

### 5.3 Save

Click **"Save"** button

✅ You should now see TWO `AUTH_GOOGLE_SECRET` entries:
- One with "Production" badge
- One with "Preview" badge

---

## Step 6: Verify Your Setup

You should now see **4 environment variables** in your list:

1. `AUTH_GOOGLE_ID` - **Production** ✅
2. `AUTH_GOOGLE_SECRET` - **Production** ✅
3. `AUTH_GOOGLE_ID` - **Preview** ✅
4. `AUTH_GOOGLE_SECRET` - **Preview** ✅

Each should have the correct environment badge next to it.

---

## Step 7: Redeploy Your Applications

⚠️ **CRITICAL**: Environment variables only take effect after redeployment!

### 7.1 Redeploy Production

1. Go to **"Deployments"** tab
2. Find the latest **Production** deployment
3. Click the **"..."** (three dots) menu
4. Click **"Redeploy"**
5. Confirm the redeploy
6. Wait for deployment to complete (~2-3 minutes)

### 7.2 Redeploy Preview/Staging

1. Still in **"Deployments"** tab
2. Find the latest **Preview** deployment (or staging branch deployment)
3. Click the **"..."** (three dots) menu
4. Click **"Redeploy"**
5. Confirm the redeploy
6. Wait for deployment to complete (~2-3 minutes)

---

## Step 8: Test

### 8.1 Test Production

1. Visit: `https://app.complyvault.co/api/auth/signin`
2. Click "Sign in with Google"
3. Should work! ✅

### 8.2 Test Staging

1. Visit: `https://app-staging.complyvault.co/api/auth/signin`
2. Click "Sign in with Google"
3. Should work! ✅

---

## Visual Guide: What You Should See

### In Vercel Environment Variables Page:

```
┌─────────────────────────────────────────────────────────┐
│ Environment Variables                                    │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  AUTH_GOOGLE_ID                    [Production] [Edit]  │
│  AUTH_GOOGLE_SECRET                 [Production] [Edit]  │
│  AUTH_GOOGLE_ID                     [Preview]   [Edit]  │
│  AUTH_GOOGLE_SECRET                 [Preview]   [Edit]  │
│                                                          │
│  [+ Add New]                                            │
└─────────────────────────────────────────────────────────┘
```

### When Adding a Variable:

```
┌─────────────────────────────────────────────────────────┐
│ Add Environment Variable                                 │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Key:                                                    │
│  [AUTH_GOOGLE_ID________________]                        │
│                                                          │
│  Value:                                                  │
│  [your-client-id-here...]                               │
│                                                          │
│  Environment:                                            │
│  ☑ Production                                            │
│  ☐ Preview                                               │
│  ☐ Development                                           │
│                                                          │
│  [Cancel]  [Save]                                        │
└─────────────────────────────────────────────────────────┘
```

---

## Common Mistakes to Avoid

### ❌ Don't Do This:

1. **Setting same variable for "All Environments"**
   - This makes it hard to have different values for staging vs production
   - Always select specific environments

2. **Forgetting to Redeploy**
   - Environment variables only apply to NEW deployments
   - Always redeploy after adding/changing variables

3. **Wrong Environment Selected**
   - Double-check you're selecting "Production" for production vars
   - Double-check you're selecting "Preview" for staging vars

4. **Typos in Variable Names**
   - Must be exactly: `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET`
   - Case-sensitive!

### ✅ Do This:

1. **Select Specific Environments**
   - Production variables → "Production" only
   - Staging variables → "Preview" only

2. **Redeploy After Changes**
   - Always redeploy both production and preview after adding variables

3. **Verify Before Testing**
   - Check the variable list shows correct environment badges
   - Test both production and staging URLs

---

## Troubleshooting

### Variable Not Working?

1. **Check Environment Badge**
   - Make sure variable shows correct environment (Production/Preview)
   - If wrong, delete and recreate with correct environment

2. **Verify Redeployment**
   - Check deployment logs to see if variables were loaded
   - Look for "Environment Variables" section in deployment logs

3. **Check Variable Name**
   - Must be exactly: `AUTH_GOOGLE_ID` or `AUTH_GOOGLE_SECRET`
   - No extra spaces or typos

4. **Check Variable Value**
   - Copy-paste the value to avoid typos
   - Make sure no extra spaces at beginning/end

### Still Having Issues?

1. Check Vercel deployment logs for errors
2. Verify Google Cloud Console has correct redirect URIs
3. Make sure you redeployed after adding variables

---

## Quick Reference

### Production Variables:
- `AUTH_GOOGLE_ID` = `[REDACTED - Get from Google Cloud Console]`
- `AUTH_GOOGLE_SECRET` = `[REDACTED - Get from Google Cloud Console]`
- Environment: **Production** only
- Google Project: `comply-vault-prod`

### Preview/Staging Variables:
- `AUTH_GOOGLE_ID` = `[REDACTED - Get from Google Cloud Console]`
- `AUTH_GOOGLE_SECRET` = `[REDACTED - Get from Google Cloud Console]`
- Environment: **Preview** only
- Google Project: `comply-vault-staging`

---

## Summary Checklist

- [ ] Added `AUTH_GOOGLE_ID` for Production
- [ ] Added `AUTH_GOOGLE_SECRET` for Production
- [ ] Added `AUTH_GOOGLE_ID` for Preview
- [ ] Added `AUTH_GOOGLE_SECRET` for Preview
- [ ] Verified all 4 variables show correct environment badges
- [ ] Redeployed Production
- [ ] Redeployed Preview/Staging
- [ ] Tested Production login
- [ ] Tested Staging login

✅ All done!