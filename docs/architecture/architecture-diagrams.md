---
tags:
  - architecture
---

# ComplyVault — Architecture Diagrams

> Mermaid diagrams for system architecture, data flow, and integration patterns.  
> Render in GitHub, VS Code (Mermaid extension), or [mermaid.live](https://mermaid.live).

---

## 1. High-Level System Architecture

```mermaid
flowchart TB
    subgraph Users["👤 Users"]
        CCO[CCO]
        Adviser[Adviser]
    end

    subgraph ComplyVault["ComplyVault (Next.js on Vercel)"]
        subgraph App["App Layer"]
            Dashboard[Dashboard]
            Integrations[Integrations UI]
            MeetingDetail[Meeting Detail]
            AuditPacks[Audit Pack]
        end

        subgraph API["API Layer"]
            Webhooks[Webhooks]
            Jobs[Jobs]
            Auth[Auth]
        end

        subgraph Core["Core Services"]
            IntegrationHub[IntegrationHub]
            Extraction[Extraction Pipeline]
            Storage[Storage]
        end

        subgraph Data["Data"]
            DB[(PostgreSQL)]
            S3[(S3/R2)]
        end
    end

    subgraph External["External Systems"]
        Zoom[Zoom]
        Teams[Microsoft Teams]
        SharePoint[SharePoint]
        Redtail[Redtail CRM]
        DocuSign[DocuSign]
        Slack[Slack]
    end

    subgraph Queue["Queue"]
        QStash[QStash]
    end

    CCO --> Dashboard
    CCO --> Integrations
    CCO --> MeetingDetail
    Adviser --> MeetingDetail

    Zoom -->|webhook| Webhooks
    Teams -->|webhook| Webhooks
    Webhooks --> QStash
    QStash --> Jobs
    Jobs --> Extraction
    Jobs --> IntegrationHub
    Extraction --> Storage
    Extraction --> DB
    IntegrationHub --> Zoom
    IntegrationHub --> Teams
    IntegrationHub --> SharePoint
    IntegrationHub --> Redtail
    IntegrationHub --> DocuSign
    IntegrationHub --> Slack
    Storage --> S3
    App --> API
    API --> DB
```

---

## 2. Meeting Ingestion Flow (Zoom)

```mermaid
sequenceDiagram
    participant Zoom as Zoom
    participant Webhook as /api/webhooks/v1/zoom/recording-completed
    participant QStash as QStash
    participant Ingest as /api/jobs/zoom-ingest
    participant S3 as S3/R2
    participant Process as /api/jobs/process-meeting
    participant DB as PostgreSQL

    Zoom->>Webhook: POST recording.completed
    Webhook->>Webhook: Verify HMAC signature
    Webhook->>QStash: publishZoomIngestionJob(payload)
    QStash->>Ingest: POST (async)

    Ingest->>Ingest: Find workspace by hostEmail
    Ingest->>Ingest: Check recording scope
    Ingest->>Ingest: Prefer VTT transcript, else MP4

    alt Has VTT transcript
        Ingest->>Zoom: fetch transcript (download_url)
        Ingest->>DB: Create Meeting, update transcript
        Ingest->>Ingest: Run extraction pipeline
        Ingest->>DB: Update status Draft Ready
    else Has MP4/M4A
        Ingest->>Zoom: fetch recording
        Ingest->>S3: uploadFile
        Ingest->>DB: Create Meeting, update fileUrl
        Ingest->>QStash: publishProcessMeetingJob
        QStash->>Process: POST (transcribe + extract)
        Process->>DB: Update status Draft Ready
    end

    Ingest->>DB: Audit event
```

---

## 3. Integration Data Flow

```mermaid
flowchart LR
    subgraph Trigger["Trigger"]
        AP[Audit Pack Complete]
    end

    subgraph Dispatcher["Dispatcher"]
        Read[Read connected integrations]
        Enqueue[Enqueue write jobs]
    end

    subgraph Queue["Queue"]
        Q[QStash / BullMQ]
    end

    subgraph Workers["Workers"]
        CRM[CRM Note]
        Share[SharePoint Upload]
        Doc[DocuSign Envelope]
        Slack[Slack Alert]
    end

    subgraph External["External Systems"]
        Redtail[Redtail]
        SP[SharePoint]
        DS[DocuSign]
        SL[Slack]
    end

    AP --> Read
    Read --> Enqueue
    Enqueue --> Q
    Q --> CRM
    Q --> Share
    Q --> Doc
    Q --> Slack
    CRM --> Redtail
    Share --> SP
    Doc --> DS
    Slack --> SL
```

---

## 4. IntegrationHub Adapter Pattern

```mermaid
classDiagram
    class BaseIntegrationAdapter {
        <<abstract>>
        +connect()
        +sync()
        +disconnect()
        +handleWebhook()
    }

    class ZoomAdapter {
        +connect()
        +sync()
        +disconnect()
        +handleWebhook()
    }

    class TeamsAdapter {
        +connect()
        +sync()
        +disconnect()
        +handleWebhook()
    }

    class SharePointAdapter {
        +connect()
        +sync()
        +disconnect()
    }

    class RedtailAdapter {
        +connect()
        +sync()
        +disconnect()
    }

    BaseIntegrationAdapter <|-- ZoomAdapter
    BaseIntegrationAdapter <|-- TeamsAdapter
    BaseIntegrationAdapter <|-- SharePointAdapter
    BaseIntegrationAdapter <|-- RedtailAdapter
```

---

## 5. Data Model (Core Entities)

```mermaid
erDiagram
    Workspace ||--o{ Meeting : has
    Workspace ||--o{ IntegrationCredential : has
    Workspace ||--o{ IntegrationConfig : has
    Workspace ||--o{ UserWorkspace : has
    Workspace ||--o{ Flag : has
    Workspace ||--o{ AuditEvent : has

    Meeting ||--o{ Flag : has
    Meeting ||--o{ AuditEvent : references

    User ||--o{ UserWorkspace : has

    IntegrationCredential {
        string id PK
        string workspaceId FK
        string provider
        string accessTokenEncrypted
        string refreshTokenEncrypted
        datetime expiresAt
        string status
    }

    IntegrationConfig {
        string id PK
        string workspaceId FK
        string provider
        json config
        datetime lastSyncAt
        string lastErrorMessage
    }

    Meeting {
        string id PK
        string workspaceId FK
        string clientName
        string meetingType
        datetime meetingDate
        string status
        string fileUrl
        json transcript
        json extraction
    }
```

---

## 6. Webhook Endpoints

```mermaid
flowchart TB
    subgraph Incoming["Incoming Webhooks"]
        Zoom[Zoom recording.completed]
        Teams[Teams transcript]
        DocuSign[DocuSign envelope]
        Slack[Slack interactivity]
    end

    subgraph Routes["API Routes"]
        R1["/api/webhooks/v1/zoom/recording-completed"]
        R2["/api/webhooks/v1/teams/transcript"]
        R3["/api/webhooks/v1/teams/call-record"]
        R4["/api/webhooks/v1/docusign/envelope-completed"]
        R5["/api/webhooks/v1/slack/interactivity"]
    end

    subgraph Verification["Verification"]
        HMAC[HMAC-SHA256]
        Validation[Validation token]
    end

    Zoom --> R1 --> HMAC
    Teams --> R2
    Teams --> R3 --> Validation
    DocuSign --> R4 --> HMAC
    Slack --> R5 --> HMAC
```

---

## 7. OAuth Flow (Zoom)

```mermaid
sequenceDiagram
    participant CCO as CCO
    participant App as ComplyVault
    participant Zoom as Zoom OAuth

    CCO->>App: Click "Connect Zoom"
    App->>App: Generate state, store in session
    App->>CCO: Redirect to Zoom authorize URL
    CCO->>Zoom: Authorize (login if needed)
    Zoom->>App: Redirect to callback with code
    App->>Zoom: Exchange code for tokens
    Zoom->>App: access_token, refresh_token
    App->>App: Encrypt token, store in IntegrationCredential
    App->>Zoom: Subscribe recording.completed webhook
    App->>CCO: Show "Connected" banner
```

---

## 8. Compliance Health Score Calculation

```mermaid
flowchart TB
    subgraph Inputs["Inputs"]
        MC[Meeting Coverage]
        DF[Documents Finalised]
        FR[Flags Resolved]
        SC[Signatures Complete]
    end

    subgraph Weights["Weights"]
        W1["30%"]
        W2["25%"]
        W3["25%"]
        W4["20%"]
    end

    subgraph Calc["Calculation"]
        Score["Health Score 0–100"]
    end

    subgraph Cache["Cache"]
        Nightly[Nightly Background Job]
    end

    MC --> W1
    DF --> W2
    FR --> W3
    SC --> W4
    W1 --> Score
    W2 --> Score
    W3 --> Score
    W4 --> Score
    Score --> Nightly
```

---

## 9. Deployment Architecture (Vercel)

```mermaid
flowchart TB
    subgraph Vercel["Vercel"]
        Edge[Edge Functions]
        Serverless[Serverless Functions]
        Static[Static Assets]
    end

    subgraph External["External"]
        Postgres[Neon / Supabase PostgreSQL]
        R2[Cloudflare R2 / S3]
        Upstash[Upstash QStash]
        Resend[Resend Email]
    end

    subgraph Providers["AI Providers"]
        Deepgram[Deepgram]
        OpenAI[OpenAI]
    end

    subgraph Integrations["Integrations"]
        Zoom[Zoom API]
        Teams[Microsoft Graph]
    end

    Edge --> Serverless
    Serverless --> Postgres
    Serverless --> R2
    Serverless --> Upstash
    Serverless --> Resend
    Serverless --> Deepgram
    Serverless --> OpenAI
    Serverless --> Zoom
    Serverless --> Teams
```
