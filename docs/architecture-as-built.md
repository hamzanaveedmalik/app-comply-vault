# ComplyVault — Architecture (As-Built from Codebase)

Living reference derived from `src/`, `prisma/schema.prisma`, and `app/api` routes. **Forward-looking PRD targets** (DocuSign envelopes, RIAB writes, Redtail, etc.) exist as `IntegrationProvider` enum or UI labels but **do not have full adapter + job flows** unless noted below.

---

## 1. System context

What the deployed app talks to today (when env vars are configured).

```mermaid
flowchart LR
  subgraph users [Users]
    CCO[CCO / Members]
  end

  subgraph complyvault [ComplyVault — Next.js App Router]
    APP[Browser UI plus Server Actions]
    API[Route Handlers /api/*]
  end

  CCO --> APP
  APP --> API

  API --> PG[(PostgreSQL)]
  API --> OBJ[(S3-compatible object storage)]

  API --> QSTASH[Upstash QStash]
  QSTASH -.->|HTTP callbacks| API

  API --> REDIS[(Redis)]
  REDIS --- BULL[BullMQ — integration-writes queue optional when REDIS_URL set]

  API --> ZOOM[Zoom API + Webhooks]
  API --> MSFT[Microsoft Graph — Teams + SharePoint]
  API --> ZOHO[Zoho CRM API]
  API --> RESEND[Resend — email]
  API --> STRIPE[Stripe — billing webhooks]
  API --> LLM[LLM providers — OpenAI / Anthropic / Vertex per config]
  API --> ASR[Transcription — AssemblyAI / Deepgram]

  OBJ --- R2[R2 or AWS S3]
```

---

## 2. Application shape (logical layers)

```mermaid
flowchart TB
  subgraph presentation [Presentation — src/app]
    PAGES["(app) routes: dashboard, meetings, integrations, settings, upload, internal/ops"]
    AUTH["auth: NextAuth"]
    TEAMS_UI["Teams manifest + sidepanel pages"]
  end

  subgraph api [HTTP API — src/app/api]
    WH["webhooks/v1: zoom/recording-completed, teams/transcript, teams/call-record"]
    OAUTH["integrations: zoom, teams, sharepoint, zoho-crm — connect + callback"]
    JOBS["jobs: process-meeting, zoom-ingest, teams-ingest, teams-ingest-call-record, sharepoint-deposit, zoho-crm-note, process-integration-queue, integration-token-refresh"]
    CRON["cron: weekly-digest"]
    REST["upload, meetings CRUD, finalize, export, flags, workspaces, invitations, billing, trial, audit-logs, search, metrics, notifications"]
  end

  subgraph server [Server domain — src/server]
    INT["integrations: BaseIntegrationAdapter, adapters zoom/teams/sharepoint/zoho-crm, token-refresh, BullMQ queue plus worker when Redis configured, webhooks verify"]
    EXP["export: PDF/CSV/TXT audit pack"]
    EXT["extraction + flags"]
    TRN["transcription"]
    STG["storage — presigned S3"]
    EM["email — Resend"]
    QSH["qstash — publish helpers"]
    AUTHCFG["auth + billing guards"]
  end

  presentation --> api
  api --> server
  server --> PG[(Prisma → PostgreSQL)]
  server --> OBJ[(S3)]
```

---

## 3. Meeting lifecycle (core vertical slice)

```mermaid
sequenceDiagram
  participant U as User / Webhook
  participant API as Next API routes
  participant S3 as Object storage
  participant Q as QStash
  participant J as process-meeting job
  participant AI as Extraction + flags
  participant SP as SharePoint deposit job

  Note over U,SP: Path A — Manual upload
  U->>API: POST upload init + complete
  API->>S3: Presigned put
  U->>S3: Upload file
  API->>Q: publishProcessMeetingJob
  Q->>J: POST /api/jobs/process-meeting
  J->>J: transcribe + extract + flags
  J->>U: Email draft-ready optional

  Note over U,SP: Path B — Zoom webhook
  U->>API: Zoom recording-completed
  API->>Q: publishZoomIngestJob
  Q->>API: zoom-ingest → file URL → process-meeting chain

  Note over U,SP: Path C — Teams transcript / call-record webhooks
  U->>API: teams/transcript or call-record
  API->>Q: Teams ingest jobs → process-meeting chain

  Note over U,SP: After finalize
  U->>API: finalize meeting
  API->>Q: sharepoint-deposit when configured
  Q->>SP: POST /api/jobs/sharepoint-deposit
  API->>Q: zoho-crm-note when Zoho connected
```

---

## 4. Integrations — implementation status

| Provider        | OAuth / connect routes | Adapter module            | Async jobs / webhooks |
|----------------|------------------------|---------------------------|------------------------|
| Zoom           | Yes                    | `adapters/zoom.ts`        | Webhook + `zoom-ingest` |
| Teams          | Yes                    | `adapters/teams.ts`       | Webhooks + ingest jobs |
| SharePoint     | Yes                    | `adapters/sharepoint.ts`  | `sharepoint-deposit` after finalize |
| Zoho CRM       | Yes                    | `adapters/zoho-crm.ts`    | `zoho-crm-note`, contact field on meeting |
| DocuSign       | No full flow           | —                         | `verifyDocuSignConnect` helper only |
| RIAB / others  | UI / enum              | —                         | Token refresh stub paths |

```mermaid
flowchart LR
  subgraph implemented [Implemented flows]
    ZOOM[Zoom]
    TEAMS[Teams]
    SP[SharePoint]
    ZOHO[Zoho CRM]
  end

  subgraph placeholder [Schema or UI only]
    DS[DocuSign]
    RIAB[RIA in a Box]
    GD[Google Drive]
    CRM2[Redtail / Wealthbox / Salesforce]
    SL[Slack / Teams Bot]
  end

  HUB[IntegrationCredential + IntegrationConfig + token-refresh + integration queue/worker]
  implemented --> HUB
  placeholder -.->|enum future| HUB
```

---

## 5. Data persistence (high level)

```mermaid
erDiagram
  Workspace ||--o{ Meeting : has
  Workspace ||--o{ IntegrationCredential : has
  Workspace ||--o{ IntegrationConfig : has
  Meeting ||--o{ Flag : has
  Meeting ||--o{ ResolutionRecord : has
  Meeting ||--o{ IntegrationSyncLog : has
  Meeting ||--o{ Version : has
  Workspace ||--o{ AuditEvent : logs
```

---

## 6. Related docs

- Target / future-state sketches: [architecture-diagrams.md](./architecture-diagrams.md)
- Product scope (not implementation status): [prd-summary.md](./prd-summary.md)
