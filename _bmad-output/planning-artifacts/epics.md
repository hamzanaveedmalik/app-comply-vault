---
stepsCompleted: ['step-01-validate-prerequisites', 'step-02-design-epics', 'step-03-create-stories', 'step-04-final-validation', 'review-refinement', 'dashboard-redesign', 'competitive-analysis-jump']
inputDocuments: ['docs/complyvault-plugin-prd.md']
lastUpdated: 'February 2026'
---

# ComplyVault — Full Epic & Story Breakdown

## Overview

Complete epic and story breakdown for ComplyVault, decomposing the Plugin & Integration PRD plus dashboard redesign and competitive differentiation features (informed by Jump.ai $80M Series B analysis, Feb 2026).

**Total: 43 stories across 8 epics.**

Changes from previous version:
- Stories split for sprint-sized delivery, edge-case ACs added, phase labels applied (Feb 2026 review)
- Epic 7 added: Dashboard & Reporting (Story 7.1 — Compliance Command Centre)
- Epic 8 added: CCO Intelligence & Competitive Differentiation (Stories 8.1–8.4, informed by Jump.ai competitive analysis)

---

## Requirements Inventory

### Functional Requirements

FR1: CCO can connect Zoom account to ComplyVault via OAuth from integrations settings
FR2: ComplyVault subscribes to Zoom recording.completed webhook on connection
FR3: recording.completed webhook triggers ComplyVault AI pipeline automatically
FR4: Both MP4/M4A recording and Zoom VTT transcript are ingested
FR5: zoomMeetingId and hostEmail stored as metadata on audit pack
FR6: Processing status visible in CCO dashboard; email notification when audit pack ready
FR7: CCO can control which Zoom meetings are auto-processed (scope settings)
FR8: CCO can connect Microsoft Teams via Azure AD OAuth
FR9: Teams callRecord change notification triggers ingestion pipeline
FR10: Teams meeting recordings processed same as Zoom; teamsMeetingId and organiserEmail stored
FR11: ComplyVault Teams App available in meeting interface with Generate/View/Check Status actions
FR12: CCO can connect SharePoint via Azure AD OAuth and select root folder
FR13: Completed audit packs auto-deposited to SharePoint in /AuditPacks/YYYY/MM/
FR14: CCO can connect Google Drive and auto-deposit audit packs
FR15: CCO can connect SmartVault; audit packs filed under matched client vault
FR16: CCO can connect Redtail via API key; connection validated
FR17: Audit pack completion creates Redtail note on matched Contact
FR18: Unmatched meetings show alert with manual Contact selection
FR19: CCO can connect Wealthbox via OAuth; Activity records created on audit pack completion
FR20: CCO can connect Salesforce FSC; audit pack summary as Task, flags as Cases
FR21: CCO can connect DocuSign via OAuth
FR22: Audit pack "Pending CCO Review" triggers DocuSign envelope; adviser then CCO signature
FR23: DocuSign Connect webhook updates status to Signed
FR24: CCO can connect RIA in a Box; compliance events and flagged issues posted
FR25: CCO can connect ComplySci; flagged items posted as incidents
FR26: CCO receives configurable weekly/daily email digest of audit packs
FR27: CCO can install ComplyVault Slack App; select channel for alerts
FR28: Slack messages sent for new audit pack, flagged items, DocuSign pending >24hrs
FR29: Slack action buttons (Review Pack, Mark as Reviewed, Escalate) update audit pack status
FR30: Teams Bot delivers same alerts as Slack
FR31: IntegrationHub with common adapter interface (connect, sync, disconnect, handleWebhook)
FR32: OAuth tokens stored encrypted; auto-refresh before expiry
FR33: Integration writes processed via BullMQ queue; 3 retries, exponential backoff
FR34: Integrations dashboard shows connection status, last sync, errors per integration
FR35: All webhooks verified against provider signatures
FR36: Disconnect & Delete purges integration data; audit packs retained
FR37: Dashboard shows Compliance Health Score with 4 weighted sub-scores
FR38: Dashboard surfaces Action Required items ordered by urgency
FR39: Dashboard shows SEC Exam Readiness progress bars with exam countdown
FR40: Dashboard shows Meeting Coverage chart by week
FR41: Dashboard shows Upcoming Compliance Deadlines
FR42: CCO receives pre-meeting compliance briefing before scheduled client meetings
FR43: CCO can view supervisory insights: flag rates by adviser and meeting type
FR44: Adviser-facing tier allows advisers to self-serve review and sign their own packs

### NonFunctional Requirements

NFR1: Integration adoption rate >60% of paid customers within 6 months
NFR2: >70% of audit packs auto-generated within 3 months of integration launch
NFR3: OAuth tokens encrypted at rest (AES-256)
NFR4: Token refresh runs every 15 mins; CCO notified on refresh failure
NFR5: Webhook signature verification required; unverified requests return 401
NFR6: Integration metadata purged within 24hrs on disconnect
NFR7: Retry policy: 3 attempts, exponential backoff (1min, 5min, 30min)
NFR8: Queue depth and job failure rate monitored in ops dashboard
NFR9: Dashboard LCP <1.5s on standard broadband
NFR10: Compliance Health Score computed nightly via background job; cached for dashboard

### FR Coverage Map

FR1–FR11: Epic 1 - Meeting & Recording Capture
FR12–FR15: Epic 2 - Document Storage
FR16–FR20: Epic 3 - CRM Integrations
FR21–FR25: Epic 4 - Compliance Platforms
FR26–FR30: Epic 5 - Notifications
FR31–FR36: Epic 6 - Integration Infrastructure
FR37–FR41: Epic 7 - Dashboard & Reporting
FR42–FR44: Epic 8 - CCO Intelligence & Competitive Differentiation

---

## Epic List

| # | Epic | Phase | FRs |
|---|---|---|---|
| 1 | Meeting & Recording Capture Integrations | Phase 1 | FR1–FR11 |
| 2 | Document Storage Integrations | Phase 1–2 | FR12–FR15 |
| 3 | CRM Integrations | Phase 2–3 | FR16–FR20 |
| 4 | Compliance Platform Integrations | Phase 1–3 | FR21–FR25 |
| 5 | Notifications & Communication | Phase 1–2 | FR26–FR30 |
| 6 | Integration Infrastructure & Platform | Phase 1 (prerequisite) | FR31–FR36 |
| 7 | Dashboard & Reporting | Phase 1 | FR37–FR41 |
| 8 | CCO Intelligence & Competitive Differentiation | Phase 2 | FR42–FR44 |

---

## Epic 6: Integration Infrastructure & Platform

⚠️ **All stories in Epic 6 must be completed before any story in Epics 1–5 can begin.**
- Story 6.1a/6.1b → blocks everything
- Story 6.2 → blocks all OAuth connection stories (1.1, 1.4, 2.1, 2.3, 3.1, 3.3, 4.1, 5.2)
- Story 6.3 → blocks all integration write stories (2.2, 3.2, 3.3, 4.2, 4.3)
- Story 6.5 → blocks all webhook ingestion stories (1.2a, 1.5, 4.2b)

### Story 6.1a: IntegrationHub Adapter Interface & Scaffolding

As a developer,
I want a defined adapter interface and base scaffolding for integrations,
So that each integration is self-contained and follows a consistent contract.

**Acceptance Criteria:**

**Given** the integration platform is being built
**When** a new integration is added
**Then** the common adapter interface is defined: connect(), sync(), disconnect(), handleWebhook()
**And** a base adapter class is created for integrations to extend
**And** folder structure and module boundaries are established
**And** IntegrationHub is implemented as Vercel serverless functions (Node.js / tRPC)
**And** adapter modules are independently deployable

### Story 6.1b: IntegrationHub Integration Test Harness

As a developer,
I want a test utility that validates any adapter's behaviour,
So that integration changes can be verified before deployment.

**Acceptance Criteria:**

**Given** an adapter implements the common interface
**When** the test harness runs
**Then** a test utility exists asserting:
- OAuth flow completes and tokens stored encrypted in IntegrationCredential
- A simulated webhook payload routes to the correct handleWebhook() method
- A simulated API write enqueues a BullMQ job with correct payload
- A simulated write failure triggers retry (3 attempts, correct backoff intervals)
- disconnect() deletes tokens and cancels pending queue jobs
**And** adapter interface test coverage ≥90% branch coverage

### Story 6.2: OAuth Token Management

As a developer,
I want a centralised OAuth token store with automatic refresh,
So that CCOs never experience auth failures due to expired tokens.

**Acceptance Criteria:**

**Given** an integration stores OAuth tokens
**When** tokens are stored
**Then** all tokens (access + refresh) stored encrypted at rest (AES-256) in IntegrationCredential table
**And** token refresh runs automatically before expiry (background job checks every 15 mins)
**And** if refresh fails, integration status updates to "Error" and CCO is notified to reconnect
**And** token deletion is immediate and complete on disconnect()

### Story 6.3: Async Integration Write Queue

As a developer,
I want all integration writes processed asynchronously via a queue,
So that integration failures never block the core audit pack generation pipeline.

**Acceptance Criteria:**

**Given** an integration write is triggered
**When** the write is enqueued
**Then** BullMQ + Redis used as the job queue
**And** each integration write is a separate queue job
**And** retry policy: 3 attempts, exponential backoff (1min, 5min, 30min)
**And** on final failure: job marked as failed, CCO alerted, manual retry button available (Story 6.7)
**And** queue depth and job failure rate surfaced in internal ops dashboard (Story 6.8)

### Story 6.4: Integration Health Dashboard

As a CCO,
I want to see the health status of all my connected integrations in one place,
So that I can quickly identify if any integration needs attention.

**Acceptance Criteria:**

**Given** the CCO is on the integrations dashboard
**When** viewing integration status
**Then** dashboard shows: connection status, last successful sync timestamp, error message per integration
**And** status states: Connected (green), Warning — retrying (yellow), Error — action required (red), Not connected (grey)
**And** "Reconnect" and "Disconnect" buttons available per integration
**And** failed sync details in a log view (last 10 failures per integration)

### Story 6.5: Webhook Security

As a developer,
I want all incoming webhooks verified against provider signatures,
So that ComplyVault cannot be triggered by spoofed webhook payloads.

**Acceptance Criteria:**

**Given** a webhook request is received
**When** the request is processed
**Then** Zoom: HMAC-SHA256 verification using Zoom webhook secret token
**And** Microsoft Graph: Validation token handshake on subscription creation
**And** DocuSign: HMAC-SHA256 Connect signature verification
**And** Slack: X-Slack-Signature verification
**And** all unverified webhook requests return 401 and are logged

### Story 6.6: Integration Data Privacy & Deletion

As a CCO,
I want to disconnect an integration and have all associated data deleted,
So that we maintain data minimisation compliance and can offboard integrations cleanly.

**Acceptance Criteria:**

**Given** the CCO selects "Disconnect & Delete"
**Then** OAuth tokens deleted immediately, queued jobs cancelled
**And** integration metadata (folder paths, channel IDs, CRM config) purged within 24hrs
**And** audit packs themselves are NOT deleted — only integration config
**And** deletion confirmed to CCO via email

### Story 6.7: Manual Retry UI (Integration Write Failures)

As a CCO,
I want to manually retry a failed integration write from the audit pack detail page,
So that I can recover from transient failures without raising a support ticket.

**Acceptance Criteria:**

**Given** the CCO is viewing an audit pack detail page
**When** integration writes have been attempted
**Then** each audit pack detail page shows integration write status per connected integration
**And** status states: Synced, Pending, Failed (with error summary)
**And** "Retry" button visible on any integration with status = Failed
**And** clicking Retry re-enqueues the job immediately
**And** on retry success, status updates to Synced with new timestamp
**And** on retry failure, error message updated with latest failure reason

### Story 6.8: Internal Ops Dashboard (Queue & Health Monitoring)

As a member of the ComplyVault ops team,
I want an internal dashboard showing queue health and failure rates,
So that we can proactively identify integration degradation before CCOs are impacted.

**Acceptance Criteria:**

**Given** the ops team needs to monitor integration health
**When** accessing /internal/ops (auth-gated to ComplyVault team)
**Then** per-integration: current queue depth, jobs processed (last 24h), jobs failed (last 24h), failure rate %
**And** alert triggers if failure rate for any integration exceeds 10% in a 1hr window
**And** last 50 failed jobs shown: integration name, error, audit pack ID, retry count
**And** BullMQ Bull Board or equivalent used (avoid building from scratch)

---

## Epic 1: Meeting & Recording Capture Integrations

### Story 1.1: Zoom OAuth Connection

As a CCO,
I want to connect my Zoom account to ComplyVault via OAuth,
So that meeting recordings are automatically sent to ComplyVault without me uploading anything.

**Acceptance Criteria:**

**Given** the CCO is on the integrations settings page
**When** the CCO initiates the Zoom OAuth flow
**Then** OAuth scopes cloud_recording:read and webhook:write are requested
**And** on successful connection, a confirmation banner shows the connected Zoom account email
**And** ComplyVault subscribes to the recording.completed webhook
**And** connection status (connected/error/disconnected) is visible on the integrations dashboard

### Story 1.2a: Zoom Webhook Verification & Pipeline Trigger

As a CCO,
I want the Zoom recording.completed webhook to be verified and trigger the ComplyVault pipeline,
So that only legitimate Zoom events are processed and jobs are enqueued reliably.

**Acceptance Criteria:**

**Given** a Zoom recording.completed webhook is received
**When** the webhook payload is verified (HMAC-SHA256 signature check — Story 6.5)
**Then** the ComplyVault ingestion job is enqueued to BullMQ
**And** zoomMeetingId and hostEmail are extracted from the payload for job metadata
**And** unverified webhooks return 401 and are logged

### Story 1.2b: Zoom Recording & Transcript Ingestion

As a CCO,
I want ComplyVault to download and ingest the Zoom recording and transcript,
So that the AI pipeline can generate the audit pack from the meeting content.

**Acceptance Criteria:**

**Given** a Zoom ingestion job is picked up from the queue
**When** the job retrieves the recording from Zoom API
**Then** both MP4/M4A recording file and Zoom VTT transcript are ingested (VTT preferred to reduce cost)
**And** zoomMeetingId and hostEmail stored as metadata on the generated audit pack

**VTT Fallback:**
**Given** Zoom has not generated a VTT transcript
**Then** ComplyVault falls back to its own transcription service on the MP4/M4A file
**And** the audit pack metadata notes that Zoom transcript was unavailable

### Story 1.2c: Audit Pack Processing Status UI

As a CCO,
I want to see the processing status of recordings in the dashboard,
So that I know when an audit pack will be ready without checking email.

**Acceptance Criteria:**

**Given** a recording has been ingested
**When** the CCO views the dashboard
**Then** processing status (queued / transcribing / generating / complete) is visible per recording
**And** status updates in near real-time as the pipeline progresses

### Story 1.3: Zoom Recording Scope Settings

As a CCO,
I want to control which Zoom meetings ComplyVault automatically processes,
So that I don't generate unnecessary audit packs for internal team calls.

**Acceptance Criteria:**

**Given** the CCO has connected Zoom
**When** the CCO configures recording scope settings
**Then** options available: "All meetings", "Meetings with external participants only", "Only meetings I manually tag"
**And** default setting is "All meetings"
**And** setting is configurable per user and per workspace
**And** changes take effect immediately for new recordings (not retroactive)

**External participant detection:**
**Given** "Meetings with external participants only" is selected
**When** a recording.completed event is received
**Then** ComplyVault checks if any participant email domain differs from the host's domain
**And** if all participants share the host domain, the recording is skipped and a skipped-log entry is created
**And** CCO can view skipped recordings in a log and manually trigger processing if needed

### Story 1.4: Microsoft Teams OAuth Connection

As a CCO using Microsoft Teams,
I want to connect my Teams account to ComplyVault,
So that Teams meeting recordings are auto-processed the same way Zoom recordings are.

**Acceptance Criteria:**

**Given** the CCO is on the ComplyVault integrations page
**When** the CCO initiates Azure AD OAuth flow
**Then** OAuth scopes OnlineMeetings.Read and CallRecords.Read.All are requested
**And** ComplyVault subscribes to Microsoft Graph callRecord change notification on connection
**And** connection status is visible on the integrations dashboard

### Story 1.5: Microsoft Teams Auto-Ingestion

As a CCO,
I want Teams meeting recordings to be automatically processed by ComplyVault,
So that my Teams-based client meetings generate audit packs just like Zoom meetings do.

**Acceptance Criteria:**

**Given** a Teams callRecord change notification is received
**When** the notification is validated
**Then** the ingestion pipeline is triggered
**And** transcript is retrieved via Graph Communications API transcript endpoint
**And** same processing status (Story 1.2c) and email notification (Story 5.0) as Zoom flow
**And** teamsMeetingId and organiserEmail stored as metadata on the audit pack

### Story 1.6: Teams App Manifest

As a CCO,
I want a ComplyVault button inside my Teams meeting interface,
So that I can manually trigger ComplyVault processing or check audit pack status without leaving Teams.

**Acceptance Criteria:**

**Given** the CCO has connected Teams
**When** the ComplyVault Teams App is installed
**Then** the app surfaces in the meeting chat sidebar
**And** actions available: "Generate Audit Pack", "View Last Audit Pack", "Check Status"
**And** the app uses SSO via Azure AD to authenticate without a separate login

---

## Epic 2: Document Storage Integrations

### Story 2.1: SharePoint / OneDrive Connection

As a CCO,
I want to connect ComplyVault to our firm's SharePoint,
So that every audit pack is automatically filed in our existing document retention folder structure.

**Acceptance Criteria:**

**Given** the CCO is on the integrations page
**When** the CCO connects via Azure AD OAuth
**Then** OAuth scopes Sites.ReadWrite.All and Files.ReadWrite.All are requested
**And** during onboarding, CCO can browse their SharePoint site and select a root folder
**And** ComplyVault saves the selected folder path and Site ID in the integration config

### Story 2.2: SharePoint Auto-Deposit

As a CCO,
I want completed audit packs to be automatically filed in SharePoint,
So that our document retention is handled without any manual filing.

**Acceptance Criteria:**

**Given** an audit pack has completed processing with SharePoint connected
**Then** ComplyVault uploads: (1) PDF of audit pack, (2) JSON summary metadata file
**And** files deposited into /AuditPacks/YYYY/MM/ sub-folder, auto-created if needed
**And** SharePoint file URL and upload timestamp stored on the audit pack record
**And** if upload fails, CCO is notified and a manual re-sync button is available (Story 6.7)

**Folder creation failure (edge case):**
**Given** folder creation fails (permissions error or quota exceeded)
**Then** job fails with error code FOLDER_CREATE_FAILED
**And** CCO notified with: "Check SharePoint permissions for the selected site"
**And** job is NOT retried automatically — manual re-sync available

### Story 2.3: Google Drive Connection and Auto-Deposit

⚠️ **Phase 2** — do not pull before Phase 1 complete.

As a CCO on Google Workspace,
I want to connect ComplyVault to Google Drive,
So that audit packs are filed in Drive the same way as SharePoint.

**Acceptance Criteria:**

**Given** the CCO connects via Google OAuth (scope: drive.file)
**Then** CCO selects a root Drive folder during onboarding
**And** audit pack PDF + JSON deposited into /AuditPacks/YYYY/MM/ on completion
**And** same error handling and re-sync button as SharePoint integration

### Story 2.4: SmartVault Integration

⚠️ **Phase 2** — target SmartVault partner agreement first.

As a CCO using SmartVault,
I want audit packs to be filed directly in SmartVault,
So that they're organised within our existing client vault structure.

**Acceptance Criteria:**

**Given** the CCO has connected SmartVault via API key + OAuth
**When** an audit pack is completed
**Then** audit pack filed under the matched client's SmartVault vault
**And** client matching uses participant email lookup (same logic as CRM matching)
**And** filing confirmation and SmartVault document URL stored on audit pack record

---

## Epic 3: CRM Integrations

### Story 3.1: Redtail CRM Connection

As a CCO using Redtail,
I want to connect ComplyVault to Redtail,
So that audit packs are automatically linked to the correct client record.

**Acceptance Criteria:**

**Given** the CCO enters the Redtail API key
**Then** ComplyVault validates the key and displays the connected Redtail account name
**And** connection status is visible on the integrations dashboard

### Story 3.2: Redtail Auto-Note Creation

As a CCO,
I want a note to be automatically added to the client's Redtail record when an audit pack is generated,
So that there's a full client activity trail in my CRM without any manual data entry.

**Acceptance Criteria:**

**Given** an audit pack has completed with Redtail connected
**Then** ComplyVault POSTs a note to the matched Redtail Contact
**And** note includes: meeting date, adviser name, AI-generated summary, link to audit pack, flagged items
**And** contact matching: participant emails looked up against Redtail Contact email fields
**And** if a participant email matches more than one Contact, meeting is treated as "Unmatched" and CCO sees all matches in dropdown with Contact name, email, and last activity date
**And** if auto-match fails, CCO sees "Unmatched meeting" alert with dropdown to manually select a Contact
**And** ComplyVaultPackId stored as custom field on Contact for reverse lookup
**And** on first connection, ComplyVault checks if ComplyVaultPackId custom field exists; if not, creates it; if creation fails, integration still works with warning: "ComplyVaultPackId field could not be created — reverse lookup unavailable"
**And** if Redtail API call fails, retried 3 times with exponential backoff before alerting CCO

### Story 3.3: Wealthbox Connection and Auto-Activity

As a CCO using Wealthbox,
I want ComplyVault to connect to Wealthbox and create Activity records automatically,
So that audit packs are visible within my Wealthbox client timeline.

**Acceptance Criteria:**

**Given** the CCO connects via Wealthbox OAuth 2.0
**When** an audit pack completes
**Then** ComplyVault creates a Wealthbox Activity (type: Note) linked to the matched Contact
**And** activity content mirrors Redtail note content (date, adviser, summary, link, flags)
**And** same manual override and retry logic as Redtail integration
**And** ComplyVault subscribes to contact.updated webhook to keep Contact metadata in sync

### Story 3.4: Salesforce Financial Services Cloud Integration

⚠️ **Phase 3** — Enterprise tier only. Do not pull into Phase 1 or 2 sprints.

As a CCO at an enterprise RIA using Salesforce,
I want ComplyVault to integrate with Salesforce FSC,
So that audit packs are linked to Salesforce client records and compliance activities.

**Acceptance Criteria:**

**Given** the CCO connects via Salesforce OAuth 2.0
**When** an audit pack completes
**Then** audit pack summary posted as a Salesforce Task linked to the matched Contact/Account
**And** flagged items created as Salesforce Cases for compliance follow-up
**And** contact matching uses same participant email lookup as Redtail/Wealthbox (shared matching service)
**And** if auto-match fails, CCO sees "Unmatched meeting" alert with Salesforce Contact search dropdown
**And** Salesforce write failures retried 3 times with exponential backoff before alerting CCO
**And** ComplyVaultPackId stored as Salesforce custom field (auto-created on first connection if absent)

---

## Epic 4: Compliance Platform Integrations

### Story 4.1: DocuSign Connection

As a CCO,
I want to connect ComplyVault to DocuSign,
So that audit packs requiring signatures can be sent for e-signature without leaving ComplyVault.

**Acceptance Criteria:**

**Given** the CCO connects via DocuSign OAuth 2.0
**Then** ComplyVault stores the connected DocuSign account ID and user ID

### Story 4.2a: DocuSign Envelope Creation & Signing Order

As a CCO,
I want ComplyVault to automatically create a DocuSign envelope when an audit pack is ready for review,
So that I can approve and sign compliance documents without downloading and re-uploading them.

**Acceptance Criteria:**

**Given** audit pack status moves to "Pending CCO Review" with DocuSign connected
**Then** ComplyVault creates a DocuSign envelope from the audit pack PDF
**And** envelope pre-populated with: Adviser signature field, CCO signature field
**And** envelope sent automatically to adviser first, then CCO on adviser completion

**Envelope creation failure (edge case):**
**Given** the DocuSign API returns an error
**Then** job retried per standard retry policy (3 attempts, exponential backoff)
**And** on final failure, audit pack status remains "Pending CCO Review" (not advanced)
**And** CCO alerted with option to retry manually or download PDF and sign externally

### Story 4.2b: DocuSign Webhook & Status Sync

As a CCO,
I want ComplyVault to automatically update the audit pack status when the DocuSign envelope is signed,
So that I have a single source of truth for signature completion.

**Acceptance Criteria:**

**Given** a DocuSign envelope has been sent
**When** the DocuSign Connect webhook receives envelope completion
**Then** ComplyVault verifies the webhook signature (Story 6.5)
**And** audit pack status is updated to "Signed"
**And** signed document URL and completion timestamp stored on the audit pack record

### Story 4.2c: DocuSign Signature Reminder

As a CCO,
I want to be reminded when a DocuSign signature has been pending for more than 24 hours,
So that I don't miss compliance deadlines.

**Acceptance Criteria:**

**Given** a DocuSign envelope has been sent and signature is not yet complete
**When** 24 hours have elapsed since envelope creation
**Then** a Slack/email reminder is triggered (depends on Story 5.3 for Slack; Story 5.0/5.1 for email)
**And** reminder includes: meeting title, audit pack link, and current signer

### Story 4.3: RIA in a Box Integration

As a CCO using RIA in a Box,
I want ComplyVault to post completed audit pack summaries into my RIAB compliance calendar,
So that my exam prep is automatically up to date without any duplicate data entry.

**Acceptance Criteria:**

**Given** the CCO connects RIAB via API key
**When** an audit pack completes
**Then** ComplyVault POSTs a compliance event to RIAB calendar: date, client name, adviser, AI summary
**And** SEC-sensitive items flagged by AI are created as RIAB "issues" requiring CCO sign-off
**And** each RIAB event/issue includes a deeplink back to the ComplyVault audit pack
**And** RIAB write failures retried 3 times with alert to CCO on final failure

### Story 4.4: ComplySci Integration

⚠️ **Phase 3** — pursue ComplySci partnership before building.

As a CCO using ComplySci,
I want flagged compliance items from ComplyVault to appear in ComplySci as incidents,
So that my incident log is automatically populated from meeting analysis.

**Acceptance Criteria:**

**Given** the CCO connects ComplySci via OAuth 2.0
**When** an audit pack has flagged items
**Then** flagged items POSTed to ComplySci incident log with severity classification
**And** non-flagged audit packs are not pushed (only exceptions)
**And** ComplySci incident includes deeplink to ComplyVault audit pack

---

## Epic 5: Notifications & Communication Integrations

### Story 5.0: Transactional Email Notifications (Audit Pack Ready)

As a CCO,
I want to receive an email when a new audit pack has been generated,
So that I know when a meeting has been processed without checking the dashboard.

**Acceptance Criteria:**

**Given** an audit pack has reached status = "Complete"
**Then** email sent to the CCO's registered email
**And** email includes: meeting title, date, adviser name, number of flagged items, direct link
**And** 0 flagged items: subject = "Audit pack ready: [Meeting Title]"
**And** ≥1 flagged items: subject = "⚠️ Action required: [Meeting Title] — [N] items flagged"
**And** email uses SMTP by default; upgrades to Gmail API / Graph API if those integrations are connected
**And** CCO can disable audit pack ready emails per-workspace in notification settings

### Story 5.1: Email Digest (Gmail / Outlook)

As a CCO,
I want to receive a weekly email digest of all audit packs generated that week,
So that I have a summary of compliance activity without logging into ComplyVault.

**Acceptance Criteria:**

**Given** the CCO has configured digest preferences
**When** the digest runs (default: every Monday at 8AM in CCO's timezone)
**Then** digest includes: total packs generated, number of flagged items, outstanding DocuSign signatures, links to items requiring CCO action
**And** CCO can configure digest frequency: daily / weekly / off
**And** digest sent via SMTP (default) with optional Gmail API or Outlook Graph API for richer formatting
**And** CCO can optionally configure Slack as a digest delivery channel (in addition to or instead of email)
**And** unsubscribe link included in every digest

### Story 5.2: Slack Bot Installation

As a CCO,
I want to install the ComplyVault Slack App in our firm's Slack workspace,
So that I get real-time alerts in Slack when an audit pack needs my attention.

**Acceptance Criteria:**

**Given** the CCO is on the integrations page
**When** the CCO installs ComplyVault Slack App via Slack OAuth
**Then** during setup, CCO selects a Slack channel for compliance alerts
**And** app installation confirmation shown in ComplyVault integrations dashboard

### Story 5.3: Slack Real-Time Alerts

As a CCO,
I want Slack messages when a new audit pack is ready or when my action is required,
So that I never miss a compliance deadline.

**Acceptance Criteria:**

**Given** the Slack App is installed
**When** (a) new audit pack generated, (b) flagged items require CCO attention, (c) DocuSign pending >24hrs
**Then** Slack Block Kit message sent with: meeting title, date, adviser name, flags summary, inline action buttons
**And** action buttons: "Review Pack", "Mark as Reviewed", "Escalate"
**And** button actions update audit pack status in real time via Slack Interactivity

### Story 5.4: Microsoft Teams Bot

⚠️ **Phase 2** — build after Slack Bot is stable.

As a CCO using Microsoft Teams,
I want ComplyVault compliance alerts delivered in Teams,
So that I get the same real-time notifications as Slack users without switching apps.

**Acceptance Criteria:**

**Given** the CCO installs the Teams Bot
**Then** CCO selects a Teams channel for compliance alerts
**And** same alert triggers and message content as Slack integration
**And** Adaptive Cards used for rich formatting (mirror of Slack Block Kit messages)

---

## Epic 7: Dashboard & Reporting

**Phase:** Phase 1 — can run in parallel with Sprint 2 (no Epic 6 dependency; reads existing data model)

### Story 7.1: Compliance Command Centre Dashboard

As a CCO,
I want a compliance-first dashboard that shows me where my firm stands at a glance,
So that I can make decisions and take action without digging through a list of uploads.

**Design reference:** See `complyvault-dashboard-v2.html`. Match existing ComplyVault styling exactly — white background, existing card borders, existing font, existing status pill styles.

---

**Section 1: Compliance Health Score (hero widget)**

**Given** the CCO loads the dashboard
**When** the page renders
**Then** a Compliance Health Score (0–100) is displayed
**And** score calculated from 4 weighted sub-scores:
  - Meeting Coverage (% of tracked client meetings with a completed audit pack) — 30%
  - Documents Finalised (% of audit packs with status = Signed) — 25%
  - Flags Resolved (% of flagged items with CCO disposition = Resolved or Dismissed) — 25%
  - Signatures Complete (% of DocuSign envelopes completed within SLA) — 20%
**And** each sub-score is displayed as a labelled progress bar
**And** delta vs previous calendar month shown ("↑ 6 pts from last month")
**And** days until next SEC exam shown below the score (sourced from upcoming deadlines calendar)
**And** score computed nightly via background job and cached; not computed on page load (NFR10)

---

**Section 2: KPI Cards row**

**Given** the CCO views the KPI row
**Then** four stat cards are displayed alongside the Health Score:
  1. **Meetings Logged** — total this calendar month, breakdown: documented / in review / processing
  2. **AI Flags Raised** — total this month, breakdown by severity: High / Medium / Low
  3. **Avg. Time to Finalise** — median hours from upload to Signed; P90 and slowest outlier shown
  4. **Pending Signatures** — total open DocuSign envelopes, sub-counts: overdue / awaiting adviser / awaiting CCO
**And** each card shows a period-over-period delta with direction indicator
**And** clicking any KPI card navigates to the relevant filtered list view

---

**Section 3: Urgent Alert Banner**

**Given** there are overdue signatures or critical unresolved flags
**When** the dashboard loads
**Then** a dismissible alert banner is shown at the top of the content area
**And** banner lists the count and nature of the urgent items with a "Review Now" CTA
**And** if there are no urgent items, the banner is hidden entirely

---

**Section 4: Recent Meetings table**

**Given** the CCO views the meetings table
**Then** the 10 most recent meetings are shown with columns: Client Name, Meeting Type, Adviser, Date, Status, Risk Flag, Action
**And** Status uses distinct pills matching existing design: Signed / Pending Sig. / Draft Ready / Processing
**And** Risk Flag shows highest-severity AI flag (High / Medium / Low / None) with colour coding
**And** Adviser column shows adviser initials avatar + name
**And** table has filter tabs: All / Flagged / Unsigned / This Week
**And** clicking any row navigates to the audit pack detail page

---

**Section 5: Action Required panel**

**Given** there are items requiring CCO action
**Then** up to 8 action items shown, ordered by urgency (overdue sigs first, then unresolved flags, then pending reviews)
**And** each item has: coloured urgency dot (red / amber / blue), title, context subtitle, relative timestamp
**And** a total item count badge shown in the panel header
**And** clicking any item navigates to the relevant audit pack or integration settings page

---

**Section 6: Integration Health panel**

**Given** the CCO has connected integrations
**Then** each connected integration listed with: icon, name, last sync timestamp, status indicator
**And** status states: Live (green) / Attention (amber) / Error (red) / Not Connected (grey)
**And** integrations with status = Error surface at the top of the list regardless of alphabetical order
**And** "Manage →" link navigates to the integrations settings page

---

**Section 7: SEC Exam Readiness panel**

**Given** an upcoming SEC exam date is configured
**Then** 5 compliance readiness dimensions shown as labelled progress bars:
  1. Meeting Documentation
  2. Suitability Records
  3. Signed Disclosures
  4. Conflict of Interest Log
  5. Supervisory Review
**And** bars colour-coded: ≥90% green, 70–89% amber, <70% red
**And** countdown badge shown in panel header ("47 days")
**And** if no exam date configured, panel shows CTA: "Set exam date to track readiness"

---

**Section 8: Meeting Coverage chart**

**Given** the CCO views the coverage chart
**Then** last 4 calendar weeks shown as bar groups (Mon–Fri per week)
**And** each bar colour-coded: documented (green) / flagged (amber) / missed (grey)
**And** total meeting count per week shown beside each row
**And** legend explains the three states

---

**Section 9: Upcoming Deadlines panel**

**Given** the CCO has configured compliance calendar events
**Then** next 4 upcoming deadlines shown with: day/month, title, subtitle, category tag
**And** category tags: SEC Prep / Filing / Review
**And** "View Calendar →" navigates to the full compliance calendar
**And** if no deadlines configured, CTA shown: "Add your SEC exam date"

---

**Non-functional requirements:**
- Dashboard LCP <1.5s on standard broadband (NFR9)
- All widgets use real data — no placeholder values on production
- Dashboard is default route post-login (replaces current /dashboard)
- Responsive down to 1280px width minimum

---

## Epic 8: CCO Intelligence & Competitive Differentiation

**Context:** Jump.ai raised $80M Series B (Feb 2026) and has ~27,000 advisers. They are an adviser productivity tool that treats compliance as a feature. ComplyVault's moat is being the CCO's tool — the compliance command layer, not the adviser productivity layer. These stories sharpen that distinction and close the window before Jump moves deeper into the CCO persona.

**Phase:** Phase 2 — build after core integration infrastructure and dashboard are live.

---

### Story 8.1: Pre-Meeting Compliance Briefing

**Strategic rationale:** Jump checks the calendar before meetings and briefs advisers. ComplyVault has no pre-meeting presence. A CCO-facing pre-meeting briefing (what disclosures are required, what's the suitability status for this client, what was flagged last time) gives ComplyVault a hook before the recording starts — something Jump doesn't offer to the CCO.

As a CCO,
I want to receive a pre-meeting compliance briefing before a scheduled client meeting,
So that I can ensure advisers are prepared on compliance obligations before the meeting happens — not just after.

**Acceptance Criteria:**

**Given** a client meeting is scheduled in the connected calendar (Google Calendar or Outlook)
**When** the meeting is 24 hours away
**Then** ComplyVault sends a pre-meeting briefing to the CCO and/or the adviser (configurable)
**And** briefing includes:
  - Required disclosures for this meeting type (based on firm-configured rules)
  - Suitability review status for this client (last reviewed date, overdue flag if >12 months)
  - Outstanding flagged items from the client's previous meetings
  - Any open DocuSign envelopes for this client
**And** briefing is delivered via email and/or Slack (whichever is connected)
**And** CCO can configure: send to CCO only / adviser only / both / off
**And** briefing links to a "Meeting Checklist" page in ComplyVault for the adviser to confirm disclosures were given

**Technical notes:**
- Requires Google Calendar or Outlook Calendar connection (new integration — Phase 2)
- Client matching: calendar event attendees matched against CRM client records
- If no calendar integration is connected, feature is unavailable and CCO sees a CTA to connect their calendar

---

### Story 8.2: Adviser Supervisory Insights

**Strategic rationale:** Jump surfaces insights about high-performing advisers for growth. ComplyVault should surface the same data for compliance — which advisers generate the most flags, which meeting types carry the most risk, which clients have the most outstanding suitability issues. This is the feature that makes ComplyVault indispensable to a CCO at a multi-adviser firm and justifies the $799/month price point on its own.

As a CCO,
I want to see compliance performance broken down by adviser and meeting type,
So that I can identify patterns, coach underperforming advisers, and prioritise supervisory reviews.

**Acceptance Criteria:**

**Given** the CCO navigates to the new "Supervisory Insights" section
**When** the page loads
**Then** a table shows each adviser with: total meetings (this quarter), flag rate %, avg. time to finalise, outstanding signatures, last supervisory review date
**And** adviser rows are sortable by each column
**And** clicking an adviser row shows their meeting history filtered to that adviser
**And** a second view shows flag rates broken down by meeting type (e.g., Intro calls flag at 12%, Retirement Reviews at 34%)
**And** a trend chart shows flag rate per adviser over the last 6 months
**And** CCO can export the supervisory table as a CSV for SEC exam preparation
**And** data is scoped to the CCO's firm — no cross-firm data visible

---

### Story 8.3: Suitability Review Tracker

**Strategic rationale:** SEC rules require RIAs to periodically review client suitability. This is currently tracked manually or not at all. A suitability tracker that auto-flags overdue reviews directly addresses an SEC exam failure point — and it's something Jump doesn't offer because it's a CCO concern, not an adviser productivity concern.

As a CCO,
I want to see which clients have overdue suitability reviews,
So that I can proactively address gaps before an SEC examination.

**Acceptance Criteria:**

**Given** the CCO navigates to the new "Suitability Reviews" section
**When** the page loads
**Then** a table shows each client with: last suitability review date, days since review, review status (Current / Due Soon / Overdue)
**And** status thresholds: Current = reviewed within 12 months, Due Soon = 10–12 months, Overdue = >12 months
**And** overdue clients shown at the top of the table with a red indicator
**And** clicking a client row shows their meeting history with suitability-relevant meetings highlighted
**And** CCO can manually mark a client as "Reviewed" with a date and note (creates an audit log entry)
**And** CCO can configure the review threshold (default 12 months, configurable 6–24 months)
**And** a summary count (X overdue, Y due soon) is surfaced on the main dashboard (Story 7.1 Section 2 KPI row)

---

### Story 8.4: Adviser-Facing Pack Review (Adviser Tier)

**Strategic rationale:** Jump's viral growth comes from advisers expensing it themselves — 2,000 new advisers per month. ComplyVault currently only has a CCO buyer. An adviser-facing tier where advisers can review and sign their own packs creates a bottom-up adoption motion alongside the CCO top-down motion. It also removes the CCO as a bottleneck for adviser-initiated reviews.

As an adviser,
I want to log into ComplyVault and review my own meeting audit packs before they go to the CCO,
So that I can correct errors and add context before the CCO sees the pack — speeding up finalisation.

**Acceptance Criteria:**

**Given** the CCO has invited an adviser to ComplyVault with the "Adviser" role
**When** the adviser logs in
**Then** the adviser sees only their own meeting packs (not other advisers' packs or firm-wide data)
**And** adviser can: view the full audit pack, add inline comments/corrections, mark their own pack as "Ready for CCO Review"
**And** when adviser marks as ready, CCO is notified (email + Slack if connected)
**And** CCO can see adviser comments/corrections in the review view alongside the original AI output
**And** adviser cannot: approve/sign packs on behalf of the CCO, view supervisory insights, access integration settings
**And** adviser tier is priced separately (e.g., per-seat add-on) — not included in the base CCO subscription
**And** CCO can revoke adviser access at any time from the workspace settings

---

## Recommended Sprint Scope

| Sprint | Stories | Notes |
|---|---|---|
| **Sprint 1** | 6.1a, 6.1b, 6.2, 6.5, 6.3, 6.4, 6.6, 6.7, 6.8 | Epic 6 only — no integration work starts until this is done |
| **Sprint 2** | 5.0, 1.1, 1.2a, 1.2b, 1.2c, **7.1** | Zoom + dashboard in parallel |
| **Sprint 3** | 1.4, 1.5, 2.1, 2.2, 5.1 | Teams + SharePoint + email digest |
| **Sprint 4** | 4.1, 4.2a, 4.2b, 4.2c, 4.3, 1.6 | DocuSign + RIAB + Teams App |
| **Sprint 5 (Phase 2)** | 3.1, 3.2, 3.3, 5.2, 5.3, 2.3, 2.4 | CRM + Slack + Drive + SmartVault |
| **Sprint 6 (Phase 2)** | 8.1, 8.2, 8.3, 8.4 | Intelligence & differentiation features |
| **Sprint 7 (Phase 3)** | 3.4, 4.4, 1.3 scope settings, 5.4 | Enterprise + ComplySci + Teams Bot |

---

## Out of Scope (v1.0)

- Orion / Tamarac portfolio management integrations — Phase 3
- Docupace integration — Phase 3
- Mobile push notifications
- Two-way sync (writing back from CRM to ComplyVault)
- On-premise / self-hosted SharePoint (SharePoint Online only)
- In-meeting live transcription (ComplyVault processes post-meeting recordings only)

---

## Open Questions

1. Does ComplyVault need SOC 2 Type II before enterprise RIAs will grant OAuth access? (Recommended: yes — target audit in Q3 2026 alongside Phase 1 launch)
2. Should Redtail and Wealthbox integrations support firm-level API keys or per-user keys?
3. Is there a minimum data retention period for IntegrationSyncLog given SEC record-keeping rules?
4. Should we pursue the Redtail App Marketplace listing before or after building the integration?
5. For Story 8.4 (Adviser Tier): what is the per-seat pricing model? Should advisers be invited by the CCO only, or can they self-sign-up and request CCO approval?
6. For Story 8.1 (Pre-Meeting Briefing): should the calendar integration be a Phase 2 integration (new Epic 1 story) or a standalone prerequisite for 8.1 only?

---

## Assumptions

- All OAuth connections are user-initiated (no service account / admin-provisioned connections in v1.0)
- ComplyVault is deployed on Vercel — serverless functions handle webhook endpoints
- Existing stack: Next.js, tRPC, Prisma, PostgreSQL
- BullMQ + Redis available in infrastructure for job queuing
- All integrations write to external systems only — no read-sync of external data into ComplyVault (except transcript retrieval from Zoom/Teams and calendar events for Story 8.1)
- Jump.ai is the primary competitive reference point; differentiation strategy is CCO-first rather than adviser-first
