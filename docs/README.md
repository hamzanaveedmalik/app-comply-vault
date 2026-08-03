---
tags:
  - index
---

# ComplyVault Documentation

Documentation index for the ComplyVault RIA compliance platform.

**Obsidian:** open this `docs/` folder as a vault. Start from the maps of content (MOCs) below — they give a cleaner graph than linking everything from this README alone.

---

## Maps of content (Obsidian)

| Map | Use when |
|-----|----------|
| [MOC — Release 1](./moc/moc-release-1.md) | 10 Aug demo / v5 backlog |
| [MOC — Product](./moc/moc-product.md) | As-built scope, PRDs, backlogs |
| [MOC — Architecture](./moc/moc-architecture.md) | System design & diagrams |
| [MOC — UX](./moc/moc-ux.md) | Journeys, cockpit, sign-off, workspaces |
| [MOC — Archive](./moc/moc-archive.md) | Superseded briefs |

---

## Product & Planning

| Document | Description |
|----------|-------------|
| [release-1/complyvault-backlog-v5-release-1.md](./release-1/complyvault-backlog-v5-release-1.md) | **Release 1 (10 Aug demo)** — hypothesis-testing backlog; build-ready source of truth |
| [release-1/demo/run-sheet.md](./release-1/demo/run-sheet.md) | AdvizorStack demo run sheet (CV-DM-02) |
| [release-1/demo/deploy-and-rehearsal.md](./release-1/demo/deploy-and-rehearsal.md) | CV-DM-03 deploy + rehearsal checklist |
| [release-1/demo/vl-02-email.md](./release-1/demo/vl-02-email.md) | CV-VL-02 hypothesis-check email draft |
| [product/product-as-built.md](./product/product-as-built.md) | **What is developed today** — as-built product document (prefer over PRDs) |
| [product/app-functionality-overview.md](./product/app-functionality-overview.md) | Narrative functional overview (companion; may lag Trust Layer) |
| [product/backlog-epics-and-stories.md](./product/backlog-epics-and-stories.md) | Product backlog epics and stories (pre–Release 1 families) |
| [product/backlog-phase1-trust.md](./product/backlog-phase1-trust.md) | Phase 1 Seal and Publish backlog + status |
| [archive/advizorstack-demo-brief.md](./archive/advizorstack-demo-brief.md) | Superseded by v5 — retained for history (`CV-AS-*`) |
| [product/complyvault-plugin-prd.md](./product/complyvault-plugin-prd.md) | Full Product Requirements Document — Plugin & Integration Strategy |
| [product/prd-summary.md](./product/prd-summary.md) | Condensed PRD reference — epics, stories, phases |

---

## Architecture

| Document | Description |
|----------|-------------|
| [architecture/architecture-diagrams.md](./architecture/architecture-diagrams.md) | System architecture, data flow, integration patterns (Mermaid) |
| [architecture/architecture-as-built.md](./architecture/architecture-as-built.md) | As-built architecture from the current codebase |

**Diagrams included:**
- High-level system architecture
- Meeting ingestion flow (Zoom)
- Integration data flow
- IntegrationHub adapter pattern
- Data model (ER)
- Webhook endpoints
- OAuth flow
- Compliance Health Score calculation
- Deployment (Vercel)

---

## User Experience

| Document | Description |
|----------|-------------|
| [ux/user-journeys.md](./ux/user-journeys.md) | User journey maps and flows (Mermaid) |

**Journeys included:**
- CCO first-time setup
- CCO zero-touch meeting capture
- CCO end-to-end flow
- CCO daily dashboard check
- CCO flagged meeting review
- CCO manual sync (Zoom)
- Adviser pack review (Phase 2)
- User journey map (experience layers)
- CCO pre-meeting briefing (Phase 2)
- Touchpoint summary

---

## Guides & sales

| Document | Description |
|----------|-------------|
| [guides/USER_GUIDE.md](./guides/USER_GUIDE.md) | End-user guide |
| [guides/FAQ.md](./guides/FAQ.md) | Frequently asked questions |
| [guides/m365-mail-admin-consent-guide.md](./guides/m365-mail-admin-consent-guide.md) | M365 admin consent setup |
| [founder-sales/](./founder-sales/) | Founder-led sales playbook |

---

## Viewing Mermaid Diagrams

- **GitHub:** Renders Mermaid in `.md` files automatically
- **VS Code:** Install "Mermaid" or "Markdown Preview Mermaid Support" extension
- **Online:** Paste into [mermaid.live](https://mermaid.live) to edit/export
- **Obsidian:** Enable the core Mermaid support (built-in) or a Mermaid community plugin
