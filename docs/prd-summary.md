# ComplyVault — PRD Summary

> Condensed reference. Full PRD: [complyvault-plugin-prd.md](./complyvault-plugin-prd.md)

---

## Document Metadata

| Field | Value |
|-------|-------|
| Product | ComplyVault |
| Version | 1.0 |
| Status | Draft |
| Target Release | Q3 2026 (Phased) |
| Primary Users | CCOs, RIA Principals |

---

## Problem & Solution

**Problem:** RIAs must document all client meetings for SEC compliance. CCOs do this manually — downloading recordings, uploading to ComplyVault, copying summaries into CRM and document storage.

**Solution:** Embed ComplyVault into tools CCOs already use. Remove manual uploads. Make ComplyVault the invisible compliance layer across the RIA workflow.

---

## Success Metrics

| Metric | Target | Timeline |
|--------|--------|----------|
| Integration adoption | >60% connect ≥1 plugin | 6 months |
| Manual upload reduction | >70% audit packs auto-generated | 3 months |
| Churn reduction (integrated vs non) | ≥20% lower | 12 months |
| Partner-sourced leads | 15% of MQLs | Q4 2026 |

---

## Epic Overview

| # | Epic | Phase | Priority |
|---|------|-------|----------|
| 6 | Integration Infrastructure & Platform | 1 (prerequisite) | P0 |
| 1 | Meeting & Recording Capture | 1 | P0 |
| 7 | Dashboard & Reporting | 1 | P0 |
| 2 | Document Storage | 1–2 | P0 |
| 4 | Compliance Platforms (DocuSign, RIAB) | 1 | P0 |
| 5 | Notifications (Email, Slack) | 1–2 | P0 |
| 3 | CRM (Redtail, Wealthbox) | 2 | P0 |
| 8 | CCO Intelligence & Differentiation | 2 | P1 |

---

## Epic 1: Meeting & Recording Capture

**Goal:** Ingest meeting recordings and transcripts into the AI pipeline without manual action.

| Story | Description |
|-------|-------------|
| 1.1 | Zoom OAuth connection, webhook subscription |
| 1.2a | Zoom webhook verification & pipeline trigger |
| 1.2b | Zoom recording & transcript ingestion (VTT preferred) |
| 1.2c | Processing status UI in dashboard |
| 1.3 | Zoom recording scope (All / External only) |
| 1.4 | Microsoft Teams OAuth connection |
| 1.5 | Teams auto-ingestion via transcript webhook |
| 1.6 | Teams App manifest (Generate/View/Check Status) |

---

## Epic 2: Document Storage

**Goal:** Auto-deposit audit packs into RIA document retention.

| Story | Description |
|-------|-------------|
| 2.1 | SharePoint/OneDrive OAuth, folder selection |
| 2.2 | SharePoint auto-deposit to /AuditPacks/YYYY/MM/ |
| 2.3 | Google Drive (Phase 2) |
| 2.4 | SmartVault (Phase 2) |

---

## Epic 3: CRM Integrations

**Goal:** Link audit packs to client records in CRM.

| Story | Description |
|-------|-------------|
| 3.1 | Redtail API key connection |
| 3.2 | Redtail auto-note on matched Contact |
| 3.3 | Wealthbox OAuth, Activity records |
| 3.4 | Salesforce FSC (Phase 3) |

---

## Epic 4: Compliance Platforms

**Goal:** Feed output into compliance platforms for SEC exam prep.

| Story | Description |
|-------|-------------|
| 4.1 | DocuSign OAuth |
| 4.2a | DocuSign envelope on Pending CCO Review |
| 4.2b | DocuSign webhook → status Signed |
| 4.2c | 24hr signature reminder |
| 4.3 | RIA in a Box compliance events |
| 4.4 | ComplySci incidents (Phase 3) |

---

## Epic 5: Notifications

**Goal:** Keep CCOs informed via email and Slack.

| Story | Description |
|-------|-------------|
| 5.0 | Transactional email (audit pack ready) |
| 5.1 | Weekly/daily email digest |
| 5.2 | Slack Bot installation |
| 5.3 | Slack real-time alerts + action buttons |
| 5.4 | Teams Bot (Phase 2) |

---

## Epic 6: Integration Infrastructure

**Goal:** Foundation for all integrations.

| Story | Description |
|-------|-------------|
| 6.1a | IntegrationHub adapter interface |
| 6.1b | Integration test harness |
| 6.2 | OAuth token management (encrypted, auto-refresh) |
| 6.3 | Async write queue (BullMQ/QStash) |
| 6.4 | Integration health dashboard |
| 6.5 | Webhook signature verification |
| 6.6 | Disconnect & delete data |
| 6.7 | Manual retry UI |
| 6.8 | Ops dashboard |

---

## Epic 7: Dashboard & Reporting

**Goal:** Compliance-first command centre.

| Section | Content |
|---------|---------|
| 1 | Compliance Health Score (0–100, 4 sub-scores) |
| 2 | KPI cards (Meetings, Flags, Time to Finalise, Pending Sigs) |
| 3 | Urgent Alert Banner |
| 4 | Recent Meetings table |
| 5 | Action Required panel |
| 6 | Integration Health panel |
| 7 | SEC Exam Readiness |
| 8 | Meeting Coverage chart |
| 9 | Upcoming Deadlines |

---

## Epic 8: CCO Intelligence (Phase 2)

**Goal:** Competitive differentiation vs Jump.ai.

| Story | Description |
|-------|-------------|
| 8.1 | Pre-meeting compliance briefing |
| 8.2 | Adviser supervisory insights (flag rates) |
| 8.3 | Suitability review tracker |
| 8.4 | Adviser-facing pack review tier |

---

## Phased Rollout

| Phase | Timeline | Integrations |
|-------|----------|--------------|
| Phase 1 | Q3 2026 (M1–3) | Zoom, Teams, SharePoint, DocuSign, RIAB, Email |
| Phase 2 | Q3–Q4 2026 (M4–6) | Redtail, Wealthbox, Slack, Teams Bot, Drive, SmartVault |
| Phase 3 | Q1 2027 | Salesforce, ComplySci, Orion, Calendar |

---

## Out of Scope (v1.0)

- Orion/Tamarac portfolio integrations (Phase 3)
- In-meeting live transcription (post-meeting only)
- Two-way sync (CRM → ComplyVault)
- On-premise SharePoint
