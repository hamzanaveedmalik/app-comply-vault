# Google OAuth Credentials Reference

This document contains instructions for setting up Google OAuth credentials for both Production and Staging environments.

## Production Credentials

**Google Cloud Project:** `comply-vault-prod`

- **Client ID:** `[REDACTED - Set in environment variables]`
- **Client Secret:** `[REDACTED - Set in environment variables]`
- **Redirect URIs:**
  - `https://app.complyvault.co/api/auth/callback/google`
  - `http://localhost:3000/api/auth/callback/google` (for local dev)

**Vercel Environment Variables:**
- `AUTH_GOOGLE_ID` = `[REDACTED - Set in environment variables]`
- `AUTH_GOOGLE_SECRET` = `[REDACTED - Set in environment variables]`
- **Environment:** Production only

---

## Staging Credentials

**Google Cloud Project:** `comply-vault-staging`

- **Client ID:** `[REDACTED - Set in environment variables]`
- **Client Secret:** `[REDACTED - Set in environment variables]`
- **Redirect URIs:**
  - `https://app-staging.complyvault.co/api/auth/callback/google`
  - `http://localhost:3000/api/auth/callback/google` (for local dev)

**Vercel Environment Variables:**
- `AUTH_GOOGLE_ID` = `[REDACTED - Set in environment variables]`
- `AUTH_GOOGLE_SECRET` = `[REDACTED - Set in environment variables]`
- **Environment:** Preview only

---

## Important Notes

1. **Different OAuth Apps**: Production and Staging use completely separate Google OAuth applications
2. **Environment Separation**: This ensures staging testing doesn't affect production users
3. **Security**: Never commit these secrets to Git
4. **Redirect URIs**: Make sure both redirect URIs are configured in their respective Google Cloud Console projects

---

## Quick Setup Checklist

### Production Setup:
- [ ] Add `AUTH_GOOGLE_ID` to Vercel (Production environment)
- [ ] Add `AUTH_GOOGLE_SECRET` to Vercel (Production environment)
- [ ] Verify redirect URI in Google Cloud Console (`comply-vault-prod` project)
- [ ] Redeploy Production

### Staging Setup:
- [ ] Add `AUTH_GOOGLE_ID` to Vercel (Preview environment)
- [ ] Add `AUTH_GOOGLE_SECRET` to Vercel (Preview environment)
- [ ] Verify redirect URI in Google Cloud Console (`comply-vault-staging` project)
- [ ] Redeploy Preview/Staging

---

## Google Cloud Console Links

- **Production Project:** [comply-vault-prod](https://console.cloud.google.com/apis/credentials?project=comply-vault-prod)
- **Staging Project:** [comply-vault-staging](https://console.cloud.google.com/apis/credentials?project=comply-vault-staging)

---

**Last Updated:** January 2025