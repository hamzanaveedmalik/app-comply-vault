# Product Requirements Document: ComplyVault Plugin & Integration Strategy

## Document Metadata

| Field | Value |
|---|---|
| Product | ComplyVault |
| Version | 1.0 |
| Status | Draft |
| Author | Hamza Naveed |
| Created | February 2026 |
| Target Release | Q3 2026 (Phased) |
| Primary Users | Chief Compliance Officers (CCOs), RIA Principals |

---

## Introduction

### Problem Statement

RIAs (Registered Investment Advisors) are required by the SEC to maintain detailed documentation of all client-facing meetings and advice. Today, CCOs do this manually — downloading recordings, uploading to ComplyVault, and then manually copying summaries into their CRM and document storage systems. This creates friction that slows adoption and limits daily active usage.

### Solution Overview

ComplyVault's Plugin & Integration Strategy embeds the product natively into the tools CCOs already use every day — removing the manual upload step entirely and making ComplyVault the invisible compliance layer across the full RIA workflow.

### Target Users

- **Primary:** Chief Compliance Officers (CCOs) at small-to-mid RIAs (1–50 advisers)
- **Secondary:** RIA Principals and Lead Advisers who host client meetings
- **Tertiary:** Enterprise RIA Compliance Teams and Broker-Dealer Compliance Departments

---

## Goals and Success Metrics

### Business Goals

- Reduce time-to-value for new RIA customers by eliminating manual upload workflows
- Increase daily active usage by embedding ComplyVault inside tools CCOs already open every day
- Drive expansion revenue through integration-tier upsells and partner referral channels

### Success Metrics

| Metric | Target | Timeline |
|---|---|---|
| Integration adoption rate | >60% of paid customers connect at least 1 plugin | 6 months post-launch |
| Reduction in manual uploads | >70% of audit packs auto-generated | Within 3 months of integration launch |
| Churn reduction vs non-integrated customers | ≥20% lower | 12-month cohort analysis |
| Partner-sourced leads | 15% of new MQLs from integration partners | Q4 2026 |

---

## Epics

### Epic 1: Meeting & Recording Capture Integrations

**Goal:** Automatically ingest meeting recordings and transcripts into the ComplyVault AI pipeline without any manual action from the CCO.

**Priority:** P0 — Launch Blocker

#### User Stories

##### Story 1.1: Zoom OAuth Connection
**As a** CCO,  
**I want to** connect my Zoom account to ComplyVault via OAuth,  
**so that** meeting recordings are automatically sent to ComplyVault without me uploading anything.

**Acceptance Criteria:**
- [ ] CCO can initiate Zoom OAuth flow from the ComplyVault integrations settings page
- [ ] OAuth scopes requested: `cloud_recording:read`, `webhook:write`
- [ ] On successful connection, a confirmation banner is shown with the connected Zoom account email
- [ ] ComplyVault subscribes to the `recording.completed` webhook on connection
- [ ] Connection status (connected/error/disconnected) is visible on the integrations dashboard

**Technical Notes:**
- Auth: Zoom OAuth 2.0 (Authorization Code flow)
- Store encrypted access + refresh tokens in `IntegrationCredential` table
- Webhook endpoint: `POST /api/webhooks/v1/zoom/recording-completed`

---

##### Story 1.2: Zoom Auto-Ingestion on Recording Complete
**As a** CCO,  
**I want** ComplyVault to automatically process a Zoom recording as soon as a meeting ends,  
**so that** my audit pack is ready within minutes without any manual steps.

**Acceptance Criteria:**
- [ ] `recording.completed` webhook triggers the ComplyVault AI pipeline automatically
- [ ] Both MP4/M4A recording file and Zoom-generated VTT transcript are ingested (VTT preferred to reduce transcription cost)
- [ ] `zoomMeetingId` and `hostEmail` are stored as metadata on the generated audit pack
- [ ] Processing status (queued / transcribing / generating / complete) is visible in the CCO dashboard
- [ ] CCO receives an email notification when the audit pack is ready

**Technical Notes:**
- Retrieve recording download URL from Zoom API using `recordingFiles` from webhook payload
- Queue ingestion job via BullMQ with 3 retry attempts + exponential backoff
- Webhook signature verification required (Zoom webhook secret token)

---

##### Story 1.3: Zoom Recording Scope Settings
**As a** CCO,  
**I want to** control which Zoom meetings ComplyVault automatically processes,  
**so that** I don't generate unnecessary audit packs for internal team calls.

**Acceptance Criteria:**
- [ ] Setting options: "All meetings", "Meetings with external participants only", "Only meetings I manually tag"
- [ ] Default setting: "All meetings"
- [ ] Setting is configurable per user and per workspace
- [ ] Changes take effect immediately for new recordings (not retroactive)

---

##### Story 1.4: Microsoft Teams OAuth Connection
**As a** CCO using Microsoft Teams,  
**I want to** connect my Teams account to ComplyVault,  
**so that** Teams meeting recordings are auto-processed the same way Zoom recordings are.

**Acceptance Criteria:**
- [ ] CCO can initiate Azure AD OAuth flow from ComplyVault integrations page
- [ ] OAuth scopes: `OnlineMeetings.Read`, `CallRecords.Read.All`
- [ ] ComplyVault subscribes to Microsoft Graph `callRecord` change notification on connection
- [ ] Connection status visible on integrations dashboard

**Technical Notes:**
- Auth: Azure AD OAuth 2.0 (Authorization Code + PKCE)
- Graph Notifications subscription endpoint: `POST /api/webhooks/v1/teams/call-record`
- Subscription must be renewed every 60 mins (lifecycle notifications or background job)

---

##### Story 1.5: Microsoft Teams Auto-Ingestion
**As a** CCO,  
**I want** Teams meeting recordings to be automatically processed by ComplyVault,  
**so that** my Teams-based client meetings generate audit packs just like Zoom meetings do.

**Acceptance Criteria:**
- [ ] `callRecord` change notification triggers ingestion pipeline
- [ ] Transcript retrieved via Graph Communications API transcript endpoint
- [ ] Same processing status and email notification as Zoom flow
- [ ] `teamsMeetingId` and `organiserEmail` stored as metadata on audit pack

---

##### Story 1.6: Teams App Manifest
**As a** CCO,  
**I want** a ComplyVault button inside my Teams meeting interface,  
**so that** I can manually trigger ComplyVault processing or check audit pack status without leaving Teams.

**Acceptance Criteria:**
- [ ] ComplyVault Teams App installable from Teams App Store (or sideloaded during beta)
- [ ] App surfaces in the meeting chat sidebar
- [ ] Actions available: "Generate Audit Pack", "View Last Audit Pack", "Check Status"
- [ ] App uses SSO via Azure AD to authenticate without a separate login

---

### Epic 2: Document Storage Integrations

**Goal:** Automatically deposit completed audit packs into the RIA's existing document retention infrastructure.

**Priority:** P0 — Launch Blocker

#### User Stories

##### Story 2.1: SharePoint / OneDrive Connection
**As a** CCO,  
**I want to** connect ComplyVault to our firm's SharePoint,  
**so that** every audit pack is automatically filed in our existing document retention folder structure.

**Acceptance Criteria:**
- [ ] CCO can connect via Azure AD OAuth from ComplyVault integrations page
- [ ] OAuth scopes: `Sites.ReadWrite.All`, `Files.ReadWrite.All`
- [ ] During onboarding, CCO can browse their SharePoint site and select a root folder for audit pack deposits
- [ ] ComplyVault saves the selected folder path and Site ID in the integration config

**Technical Notes:**
- Auth: Azure AD OAuth 2.0 (shared with Teams connection — token reuse where possible)
- Store `siteId`, `driveId`, `rootFolderPath` in `IntegrationConfig` table

---

##### Story 2.2: SharePoint Auto-Deposit
**As a** CCO,  
**I want** completed audit packs to be automatically filed in SharePoint,  
**so that** our document retention is handled without any manual filing.

**Acceptance Criteria:**
- [ ] On audit pack completion, ComplyVault uploads: (1) PDF of audit pack, (2) JSON summary metadata file
- [ ] Files are deposited into `/AuditPacks/YYYY/MM/` sub-folder, auto-created if it doesn't exist
- [ ] SharePoint file URL and upload timestamp are stored on the audit pack record
- [ ] If upload fails, CCO is notified and a manual re-sync button is available
- [ ] CCO can trigger a "Re-sync" for any audit pack to push it to SharePoint again

---

##### Story 2.3: Google Drive Connection and Auto-Deposit
**As a** CCO on Google Workspace,  
**I want to** connect ComplyVault to Google Drive,  
**so that** audit packs are filed in Drive the same way as SharePoint.

**Acceptance Criteria:**
- [ ] CCO connects via Google OAuth from integrations page
- [ ] CCO selects a root Drive folder during onboarding
- [ ] Audit pack PDF + JSON deposited into `/AuditPacks/YYYY/MM/` on completion
- [ ] Same error handling and re-sync button as SharePoint integration

**Technical Notes:**
- Auth: Google OAuth 2.0, scope: `https://www.googleapis.com/auth/drive.file`
- Phase 2 — not a launch blocker

---

##### Story 2.4: SmartVault Integration
**As a** CCO using SmartVault,  
**I want** audit packs to be filed directly in SmartVault,  
**so that** they're organised within our existing client vault structure.

**Acceptance Criteria:**
- [ ] CCO can connect SmartVault via API key + OAuth from integrations page
- [ ] Audit packs are filed under the matched client's SmartVault vault
- [ ] Client matching uses the participant email lookup (same logic as CRM matching)
- [ ] Filing confirmation and SmartVault document URL stored on audit pack record

**Technical Notes:**
- Phase 2 — target SmartVault partner program for co-marketing
- Auth: SmartVault REST API + OAuth

---

### Epic 3: CRM Integrations

**Goal:** Link audit packs directly to client records in the CRM, making ComplyVault a native part of the CCO's existing client management workflow.

**Priority:** P0 for Redtail + Wealthbox (Phase 2), P1 for Salesforce (Phase 3)

#### User Stories

##### Story 3.1: Redtail CRM Connection
**As a** CCO using Redtail,  
**I want to** connect ComplyVault to Redtail,  
**so that** audit packs are automatically linked to the correct client record.

**Acceptance Criteria:**
- [ ] CCO enters Redtail API key in ComplyVault integrations settings
- [ ] ComplyVault validates the key and displays the connected Redtail account name
- [ ] Connection status visible on integrations dashboard

**Technical Notes:**
- Auth: Redtail subscription-based API key (per-user model)
- Base URL: `https://smf.redtailtechnology.com/api/public/v1/`

---

##### Story 3.2: Redtail Auto-Note Creation
**As a** CCO,  
**I want** a note to be automatically added to the client's Redtail record when an audit pack is generated,  
**so that** there's a full client activity trail in my CRM without any manual data entry.

**Acceptance Criteria:**
- [ ] On audit pack completion, ComplyVault POSTs a note to the matched Redtail Contact
- [ ] Note includes: meeting date, adviser name, brief AI-generated summary, link to full audit pack, list of any flagged items
- [ ] Contact matching: meeting participant emails are looked up against Redtail Contact email fields
- [ ] If auto-match fails, CCO sees an "Unmatched meeting" alert with a dropdown to manually select a Contact
- [ ] `ComplyVaultPackId` stored as a custom field on the Contact for reverse lookup
- [ ] If Redtail API call fails, it is retried 3 times with exponential backoff before alerting the CCO

---

##### Story 3.3: Wealthbox Connection and Auto-Activity
**As a** CCO using Wealthbox,  
**I want** ComplyVault to connect to Wealthbox and create Activity records automatically,  
**so that** audit packs are visible within my Wealthbox client timeline.

**Acceptance Criteria:**
- [ ] CCO connects via Wealthbox OAuth 2.0 from integrations page
- [ ] On audit pack completion, ComplyVault creates a Wealthbox Activity (type: Note) linked to the matched Contact
- [ ] Activity content mirrors Redtail note content (date, adviser, summary, link, flags)
- [ ] Same manual override and retry logic as Redtail integration
- [ ] ComplyVault subscribes to `contact.updated` webhook to keep Contact metadata in sync

---

##### Story 3.4: Salesforce Financial Services Cloud Integration
**As a** CCO at an enterprise RIA using Salesforce,  
**I want** ComplyVault to integrate with Salesforce FSC,  
**so that** audit packs are linked to Salesforce client records and compliance activities.

**Acceptance Criteria:**
- [ ] CCO connects via Salesforce OAuth 2.0
- [ ] Audit pack summary posted as a Salesforce Task linked to the matched Contact/Account
- [ ] Flagged items created as Salesforce Cases for compliance follow-up
- [ ] ComplyVaultPackId stored as a custom field on the Contact

**Technical Notes:**
- Phase 3 — enterprise tier feature
- Auth: Salesforce OAuth 2.0 (Connected App)

---

### Epic 4: Compliance Platform Integrations

**Goal:** Feed ComplyVault output directly into the compliance platforms CCOs use for SEC exam preparation, making ComplyVault an indispensable data source.

**Priority:** P0 for DocuSign + RIA in a Box (Phase 1)

#### User Stories

##### Story 4.1: DocuSign Connection
**As a** CCO,  
**I want to** connect ComplyVault to DocuSign,  
**so that** audit packs requiring signatures can be sent for e-signature without leaving ComplyVault.

**Acceptance Criteria:**
- [ ] CCO connects via DocuSign OAuth 2.0 from integrations page
- [ ] ComplyVault stores the connected DocuSign account ID and user ID

**Technical Notes:**
- Auth: DocuSign OAuth 2.0 (Authorization Code flow)
- Use DocuSign eSignature REST API

---

##### Story 4.2: DocuSign Envelope Generation
**As a** CCO,  
**I want** ComplyVault to automatically send an audit pack for e-signature when it's ready for CCO review,  
**so that** I can approve and sign compliance documents without downloading and re-uploading them.

**Acceptance Criteria:**
- [ ] When audit pack status moves to "Pending CCO Review", ComplyVault creates a DocuSign envelope from the audit pack PDF
- [ ] Envelope pre-populated with: Adviser signature field, CCO signature field
- [ ] Envelope sent automatically to adviser first, then CCO on adviser completion
- [ ] Signed document URL and completion timestamp stored on the audit pack record
- [ ] ComplyVault subscribes to DocuSign Connect webhook to auto-update status to "Signed"
- [ ] If signature not completed within 24hrs, a Slack/email reminder is triggered

---

##### Story 4.3: RIA in a Box Integration
**As a** CCO using RIA in a Box,  
**I want** ComplyVault to post completed audit pack summaries into my RIAB compliance calendar,  
**so that** my exam prep is automatically up to date without any duplicate data entry.

**Acceptance Criteria:**
- [ ] CCO connects RIAB via API key in ComplyVault integrations settings
- [ ] On audit pack completion, ComplyVault POSTs a compliance event to RIAB calendar: date, client name, adviser, AI summary
- [ ] Any SEC-sensitive items flagged by ComplyVault AI (suitability language, undisclosed conflicts) are created as RIAB "issues" requiring CCO sign-off
- [ ] Each RIAB event/issue includes a deeplink back to the ComplyVault audit pack
- [ ] RIAB write failures are retried 3 times with alert to CCO on final failure

---

##### Story 4.4: ComplySci Integration
**As a** CCO using ComplySci,  
**I want** flagged compliance items from ComplyVault to appear in ComplySci as incidents,  
**so that** my incident log is automatically populated from meeting analysis.

**Acceptance Criteria:**
- [ ] CCO connects ComplySci via OAuth 2.0
- [ ] Flagged items from audit pack are POSTed to ComplySci incident log with severity classification
- [ ] Non-flagged audit packs are not pushed to ComplySci (only exceptions)
- [ ] ComplySci incident includes deeplink to ComplyVault audit pack

**Technical Notes:**
- Phase 3 feature
- Pursue ComplySci partnership before building — position as a feed-into, not a replacement

---

### Epic 5: Notifications & Communication Integrations

**Goal:** Keep CCOs informed of audit pack status, pending actions, and weekly summaries through the communication tools they already monitor.

**Priority:** P0 for Email (Phase 1), P1 for Slack (Phase 2)

#### User Stories

##### Story 5.1: Email Digest (Gmail / Outlook)
**As a** CCO,  
**I want to** receive a weekly email digest of all audit packs generated that week,  
**so that** I have a summary of compliance activity without logging into ComplyVault.

**Acceptance Criteria:**
- [ ] Weekly digest sent every Monday at 8AM in the CCO's timezone
- [ ] Digest includes: total packs generated, number of flagged items, outstanding DocuSign signatures, links to any items requiring CCO action
- [ ] CCO can configure digest frequency: daily / weekly / off
- [ ] Digest sent via SMTP (default) with optional upgrade to Gmail API or Outlook Graph API for richer formatting
- [ ] Unsubscribe link included in every digest

---

##### Story 5.2: Slack Bot Installation
**As a** CCO,  
**I want to** install the ComplyVault Slack App in our firm's Slack workspace,  
**so that** I get real-time alerts in Slack when an audit pack needs my attention.

**Acceptance Criteria:**
- [ ] CCO installs ComplyVault Slack App via Slack OAuth from integrations page
- [ ] During setup, CCO selects a Slack channel for compliance alerts (e.g., #compliance-alerts)
- [ ] App installation confirmation shown in ComplyVault integrations dashboard

**Technical Notes:**
- Auth: Slack OAuth 2.0 (Bot Token Scopes: `chat:write`, `channels:read`)

---

##### Story 5.3: Slack Real-Time Alerts
**As a** CCO,  
**I want** Slack messages when a new audit pack is ready or when my action is required,  
**so that** I never miss a compliance deadline.

**Acceptance Criteria:**
- [ ] Slack Block Kit message sent when: (a) new audit pack generated, (b) flagged items require CCO attention, (c) DocuSign signature pending >24hrs
- [ ] Message includes: meeting title, date, adviser name, summary of flags (if any), and inline action buttons
- [ ] Action buttons: "Review Pack" (opens ComplyVault), "Mark as Reviewed", "Escalate"
- [ ] Button actions update audit pack status in ComplyVault in real time via Slack Interactivity
- [ ] Weekly digest summary also sent to Slack channel (same content as email digest)

---

##### Story 5.4: Microsoft Teams Bot
**As a** CCO using Microsoft Teams,  
**I want** ComplyVault compliance alerts delivered in Teams,  
**so that** I get the same real-time notifications as Slack users without switching apps.

**Acceptance Criteria:**
- [ ] Teams Bot installable from ComplyVault integrations page
- [ ] CCO selects a Teams channel for compliance alerts
- [ ] Same alert triggers and message content as Slack integration
- [ ] Adaptive Cards used for rich formatting (mirror of Slack Block Kit messages)

**Technical Notes:**
- Phase 2 — build after Slack Bot is stable
- Auth: Bot Framework + Azure AD

---

### Epic 6: Integration Infrastructure & Platform

**Goal:** Build the foundational integration framework that all plugin integrations are built on — ensuring reliability, security, observability, and maintainability.

**Priority:** P0 — Must be built before any integration goes live

#### User Stories

##### Story 6.1: IntegrationHub Service
**As a** developer,  
**I want** a centralised IntegrationHub service with a common adapter interface,  
**so that** each integration is self-contained, testable, and changes to one integration don't break others.

**Acceptance Criteria:**
- [ ] IntegrationHub implemented as a set of Vercel serverless functions (Node.js / tRPC)
- [ ] Each integration implements a common adapter interface: `connect()`, `sync()`, `disconnect()`, `handleWebhook()`
- [ ] Adapter modules are independently deployable
- [ ] Integration test suite covers: OAuth flow, webhook handling, API write, retry logic, disconnect

---

##### Story 6.2: OAuth Token Management
**As a** developer,  
**I want** a centralised OAuth token store with automatic refresh,  
**so that** CCOs never experience auth failures due to expired tokens.

**Acceptance Criteria:**
- [ ] All OAuth tokens (access + refresh) stored encrypted at rest (AES-256) in `IntegrationCredential` table
- [ ] Token refresh runs automatically before expiry (background job checks every 15 mins)
- [ ] If refresh fails, integration status updates to "Error" and CCO is notified to reconnect
- [ ] Token deletion is immediate and complete on `disconnect()`

---

##### Story 6.3: Async Integration Write Queue
**As a** developer,  
**I want** all integration writes (CRM notes, SharePoint uploads, DocuSign envelopes) to be processed asynchronously via a queue,  
**so that** integration failures never block the core audit pack generation pipeline.

**Acceptance Criteria:**
- [ ] BullMQ + Redis used as the job queue
- [ ] Each integration write is a separate queue job
- [ ] Retry policy: 3 attempts, exponential backoff (1min, 5min, 30min)
- [ ] On final failure: job marked as failed, CCO alerted, manual retry button available in dashboard
- [ ] Queue depth and job failure rate monitored and surfaced in internal ops dashboard

---

##### Story 6.4: Integration Health Dashboard
**As a** CCO,  
**I want to** see the health status of all my connected integrations in one place,  
**so that** I can quickly identify if any integration needs attention.

**Acceptance Criteria:**
- [ ] Integrations dashboard shows: connection status, last successful sync timestamp, error message (if any) for each connected integration
- [ ] Status states: Connected (green), Warning — retrying (yellow), Error — action required (red), Not connected (grey)
- [ ] "Reconnect" and "Disconnect" buttons available per integration
- [ ] Failed sync details available in a log view (last 10 failures per integration)

---

##### Story 6.5: Webhook Security
**As a** developer,  
**I want** all incoming webhooks verified against provider signatures,  
**so that** ComplyVault cannot be triggered by spoofed webhook payloads.

**Acceptance Criteria:**
- [ ] Zoom: HMAC-SHA256 signature verification using Zoom webhook secret token
- [ ] Microsoft Graph: Validation token handshake on subscription creation
- [ ] DocuSign: HMAC-SHA256 Connect signature verification
- [ ] Slack: `X-Slack-Signature` verification
- [ ] All unverified webhook requests return 401 and are logged

---

##### Story 6.6: Integration Data Privacy & Deletion
**As a** CCO,  
**I want to** disconnect an integration and have all associated data deleted,  
**so that** we maintain data minimisation compliance and can offboard integrations cleanly.

**Acceptance Criteria:**
- [ ] "Disconnect & Delete" available for every integration
- [ ] On disconnect: OAuth tokens deleted immediately, queued jobs for that integration cancelled
- [ ] Integration metadata (folder paths, channel IDs, CRM config) purged within 24hrs
- [ ] Audit packs themselves are NOT deleted on disconnect — only the integration config
- [ ] Deletion confirmed to CCO via email

---

## Technical Architecture Reference

### Data Model Additions

```
IntegrationCredential
  id, workspaceId, provider (zoom|teams|redtail|...), 
  accessTokenEncrypted, refreshTokenEncrypted, 
  expiresAt, scopes, status

IntegrationConfig
  id, workspaceId, provider,
  config (JSON — folder paths, channel IDs, CRM settings, etc.),
  lastSyncAt, lastErrorAt, lastErrorMessage

IntegrationSyncLog
  id, integrationConfigId, auditPackId,
  provider, action (note|upload|envelope|...), 
  status (pending|success|failed), attempts,
  createdAt, completedAt, errorMessage
```

### Webhook Endpoints

```
POST /api/webhooks/v1/zoom/recording-completed
POST /api/webhooks/v1/teams/call-record
POST /api/webhooks/v1/docusign/envelope-completed
POST /api/webhooks/v1/slack/interactivity
```

### Integration Dispatch Flow

```
Audit Pack Generated
  → Dispatcher (reads connected integrations for workspace)
  → Enqueues jobs: [CRM Note, Document Upload, DocuSign Envelope, Slack Alert]
  → BullMQ processes each job independently
  → On success: updates IntegrationSyncLog, updates audit pack metadata
  → On failure: retries, then alerts CCO
```

---

## Out of Scope (v1.0)

- Calendar integrations (Google Calendar / Outlook) — Phase 3
- Orion / Tamarac portfolio management integrations — Phase 3
- Docupace integration — Phase 3
- Mobile push notifications
- Two-way sync (writing back from CRM to ComplyVault)
- On-premise / self-hosted SharePoint (SharePoint Online only)

---

## Phased Rollout Summary

| Phase | Timeline | Integrations |
|---|---|---|
| Phase 1 — Foundation | Q3 2026 (Months 1–3) | Zoom, Microsoft Teams, SharePoint/OneDrive, DocuSign, RIA in a Box, Email Digest |
| Phase 2 — CRM & Alerts | Q3–Q4 2026 (Months 4–6) | Redtail, Wealthbox, Slack Bot, Teams Bot, Google Drive, SmartVault |
| Phase 3 — Enterprise | Q1 2027 | Salesforce FSC, ComplySci, Google Meet, Orion, Laserfiche, Calendar Detection |

---

## Open Questions

1. Does ComplyVault need SOC 2 Type II certification before enterprise RIAs will grant OAuth access? (Recommended: yes — target SOC 2 audit in Q3 2026 alongside Phase 1 launch)
2. Should the Redtail and Wealthbox integrations support firm-level API keys or per-user keys? (To confirm with Redtail/Wealthbox API documentation)
3. Is there a minimum data retention period for `IntegrationSyncLog` entries given SEC record-keeping rules?
4. Should we pursue the Redtail App Marketplace listing before or after building the integration?

---

## Assumptions

- All OAuth connections are user-initiated (no service account / admin-provisioned connections in v1.0)
- ComplyVault is deployed on Vercel — serverless functions handle webhook endpoints
- Existing stack: Next.js, tRPC, Prisma, PostgreSQL
- BullMQ + Redis available in infrastructure for job queuing
- All integrations write to external systems only — no read-sync of external data into ComplyVault (except transcript retrieval from Zoom/Teams)
