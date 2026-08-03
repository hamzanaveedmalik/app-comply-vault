---
tags:
  - product
  - prd
---

# ComplyVault — PRD Summary

> Condensed reference. Full PRD: [complyvault-plugin-prd.md](./complyvault-plugin-prd.md)

---

## Document Metadata

| Field | Value |
|-------|-------|
| Product | ComplyVault |
| Version | 1.1 |
| Status | Draft |
| Target Release | Q3 2026 (Phased) |
| Primary Users | CCOs, RIA Principals |
| Changelog | v1.1 — Added Zoho One CRM (P0, Phase 1); Tiered Sign-Off Workflow (Epic 4); Configurable Disclosure Profiles (Epic 8); based on CCO discovery feedback |

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
| 4 | Compliance Platforms & Sign-Off Workflow | 1 | P0 |
| 5 | Notifications (Email, Slack) | 1–2 | P0 |
| 3 | CRM (Zoho One, Redtail, Wealthbox) | 1–2 | P0 |
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

| Story | Description | Phase | Priority |
|-------|-------------|-------|----------|
| **3.0** | **Zoho One / Zoho CRM OAuth connection** | **1** | **P0** |
| **3.0a** | **Zoho CRM auto-note: push structured compliance summary, flags, and action items to matched Contact record on audit pack generation** | **1** | **P0** |
| **3.0b** | **Zoho CRM task sync: create Zoho Tasks from audit pack action items with owner, due date, and priority** | **1** | **P1** |
| **3.0c** | **Zoho CRM link-back: attach deep link to full audit pack in ComplyVault from the Contact record** | **1** | **P1** |
| 3.1 | Redtail API key connection | 2 | P0 |
| 3.2 | Redtail auto-note on matched Contact | 2 | P0 |
| 3.3 | Wealthbox OAuth, Activity records | 2 | P0 |
| 3.4 | Salesforce FSC (Phase 3) | 3 | P1 |

---

## Epic 4: Compliance Platforms & Sign-Off Workflow

**Goal:** Feed output into compliance platforms for SEC exam prep. Support tiered approval so CCO liability is scoped appropriately.

| Story | Description | Phase | Priority |
|-------|-------------|-------|----------|
| **4.0** | **Tiered sign-off workflow: Advisor certifies meeting accuracy (Layer 1), then Compliance Manager reviews flags, resolves/escalates each, and approves the compliance layer (Layer 2). CCO sign-off only covers the compliance review, not the advisor's conduct.** | **1** | **P0** |
| **4.0a** | **Flag resolution UI: Compliance Manager can mark each flag as Resolved, Escalated, Accepted Risk, or Not Applicable before sign-off** | **1** | **P0** |
| **4.0b** | **Approval audit trail: timestamped log of both sign-off layers with reviewer identity and flag resolution decisions** | **1** | **P0** |
| 4.1 | DocuSign OAuth | 1 | P0 |
| 4.2a | DocuSign envelope on Pending CCO Review | 1 | P0 |
| 4.2b | DocuSign webhook → status Signed | 1 | P0 |
| 4.2c | 24hr signature reminder | 1 | P1 |
| 4.3 | RIA in a Box compliance events | 1 | P0 |
| 4.4 | ComplySci incidents (Phase 3) | 3 | P1 |

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

## Epic 8: CCO Intelligence & Differentiation (Phase 2)

**Goal:** Competitive differentiation vs Jump.ai. Configurable compliance logic so the system adapts to each firm's existing framework.

| Story | Description | Priority |
|-------|-------------|----------|
| **8.0** | **Configurable disclosure profiles: firm-level settings to mark disclosure categories as "covered elsewhere" (e.g. marketing pack, ADV brochure, client agreement). System skips flagging these as missing from meeting records.** | **P0** |
| **8.0a** | **Configurable action item scoping: CCO defines which action item categories appear in the audit pack vs. operational notes that stay outside the compliance record** | **P0** |
| **8.0b** | **AI flag transparency: documentation and in-app explainer showing how flags are identified, confidence thresholds, and the human review layer before finalisation** | **P1** |
| 8.1 | Pre-meeting compliance briefing | P1 |
| 8.2 | Adviser supervisory insights (flag rates) | P1 |
| 8.3 | Suitability review tracker | P1 |
| 8.4 | Adviser-facing pack review tier | P1 |

---

## Phased Rollout

| Phase | Timeline | Integrations |
|-------|----------|--------------|
| Phase 1 | Q3 2026 (M1–3) | Zoom, Teams, SharePoint, DocuSign, RIAB, Email, **Zoho One CRM**, **Tiered Sign-Off** |
| Phase 2 | Q3–Q4 2026 (M4–6) | Redtail, Wealthbox, Slack, Teams Bot, Drive, SmartVault, **Configurable Disclosure Profiles** |
| Phase 3 | Q1 2027 | Salesforce, ComplySci, Orion, Calendar |

---

## Out of Scope (v1.0)

- Orion/Tamarac portfolio integrations (Phase 3)
- In-meeting live transcription (post-meeting only)
- Two-way sync (CRM → ComplyVault)
- On-premise SharePoint

## Related documentation

- Full plugin PRD: [[complyvault-plugin-prd]]
- As-built (prefer for “what exists”): [[product-as-built]]
- Archived 2.0 draft: [[new-prd-complyvault-2.0-draft]]
- [[Product-Map|Product Map]]
