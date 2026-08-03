---
tags:
  - guides
  - integrations
---

# Microsoft 365 Mail — Admin Consent Setup Guide

Use this guide when connecting ComplyVault to a firm-managed Microsoft 365 tenant. It doubles as IT onboarding collateral for sales conversations.

## What ComplyVault needs

ComplyVault ingests **selected mailboxes, folders, and date ranges** into the evidence vault. It is not a full-archive solution.

**Microsoft Graph permissions (application):**

- `Mail.Read` — read mail in approved mailboxes

**Microsoft Graph permissions (delegated — per-adviser fallback):**

- `Mail.Read` — read the connecting user's mail
- `User.Read` — identify the mailbox owner
- `offline_access` — refresh tokens for ongoing sync

Tokens are envelope-encrypted at rest (AES-256-GCM). ComplyVault never sends raw email content to third-party AI without the classification redaction step.

## Option A — Application permissions (recommended for CCO / IT)

Best when the compliance team needs to ingest multiple adviser mailboxes under admin control.

1. In **Azure Portal → App registrations**, register an app (or reuse your Teams/SharePoint app).
2. Under **API permissions → Microsoft Graph → Application permissions**, add `Mail.Read`.
3. Click **Grant admin consent for [tenant]**.
4. Create a **client secret** and provide to ComplyVault:
   - `M365_MAIL_CLIENT_ID`
   - `M365_MAIL_CLIENT_SECRET`
   - `M365_MAIL_TENANT_ID`
5. In ComplyVault: **Integrations → Microsoft 365 Mail → Admin consent**.
6. Add each mailbox address (e.g. `adviser@firm.com`), select folders (Inbox, Sent), set backfill date, run **Backfill**.

### Exchange Application Access Policy (least privilege)

Restrict the app to approved mailboxes only:

```powershell
Connect-ExchangeOnline
New-ApplicationAccessPolicy -AppId "<CLIENT_ID>" -PolicyScopeGroupId "<MAIL-ENABLED-SECURITY-GROUP>" -AccessRight RestrictAccess
Test-ApplicationAccessPolicy -Identity adviser@firm.com -AppId "<CLIENT_ID>"
```

## Option B — Delegated consent (per mailbox)

Best when IT cannot grant tenant-wide Mail.Read. Each adviser connects their own mailbox.

1. Adviser (or CCO) opens **Integrations → Microsoft 365 Mail → Connect my mailbox**.
2. Signs in with Microsoft; grants `Mail.Read`.
3. CCO selects folders and date range, then runs backfill.

## Ongoing sync

- **Backfill** — historical import for scoped folders/dates (resumable job).
- **Delta sync** — incremental updates via Graph delta queries; schedule via cron:

```bash
curl -X POST https://app.complyvault.co/api/cron/mailbox-delta-sync \
  -H "Authorization: Bearer $CRON_SECRET"
```

## Token expiry / recovery

If a connection moves to **ERROR**:

1. Check `lastErrorMessage` on the connection in ComplyVault.
2. For application mode: verify admin consent and Exchange Application Access Policy.
3. For delegated mode: have the user reconnect via **Connect my mailbox**.
4. Re-run **Delta sync** after recovery.

## Data residency

Store S3/R2 buckets in the US region for US RIAs. Raw MIME is write-once with SHA-256 verification on export.

## Support contacts

- ComplyVault: support@complyvault.co
- Microsoft Graph docs: https://learn.microsoft.com/en-us/graph/api/resources/mail-api-overview
