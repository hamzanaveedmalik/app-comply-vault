# Comply Vault Architecture

## System Architecture Diagram

```mermaid
graph TB
    subgraph "Client Layer"
        Browser[Browser/React Client]
        UI[Next.js Pages<br/>Dashboard, Meetings, Upload, Settings]
    end

    subgraph "Next.js Application (Vercel)"
        Middleware[Middleware<br/>Auth & Route Protection]
        API[API Routes<br/>REST Endpoints]
        Auth[Auth.js v5<br/>NextAuth]
    end

    subgraph "Core Services"
        DB[(PostgreSQL<br/>Prisma ORM)]
        Storage[S3/R2 Storage<br/>Cloudflare R2]
        QStash[Upstash QStash<br/>Background Jobs]
    end

    subgraph "External Services"
        Transcription[Transcription<br/>Deepgram/AssemblyAI]
        Extraction[LLM Extraction<br/>OpenAI/Anthropic/Vertex]
        Email[Email Service<br/>Resend]
        Stripe[Stripe<br/>Billing & Payments]
    end

    Browser --> UI
    UI --> API
    Browser --> Middleware
    Middleware --> Auth
    Middleware --> API
    API --> Auth
    API --> DB
    API --> Storage
    API --> QStash
    API --> Stripe
    QStash --> API
    QStash --> Transcription
    QStash --> Extraction
    API --> Email

    style Browser fill:#e1f5ff
    style UI fill:#e1f5ff
    style Middleware fill:#fff4e1
    style API fill:#fff4e1
    style Auth fill:#fff4e1
    style DB fill:#e8f5e9
    style Storage fill:#e8f5e9
    style QStash fill:#e8f5e9
    style Transcription fill:#f3e5f5
    style Extraction fill:#f3e5f5
    style Email fill:#f3e5f5
    style Stripe fill:#f3e5f5
```

## Data Flow: Meeting Upload & Processing

```mermaid
sequenceDiagram
    participant User
    participant UI
    participant API
    participant DB
    participant Storage
    participant QStash
    participant Transcription
    participant Extraction
    participant Email

    User->>UI: Upload meeting recording
    UI->>API: POST /api/upload/init
    API->>DB: Create Meeting (status: UPLOADING)
    API->>Storage: Generate presigned upload URL
    API-->>UI: Return meetingId + uploadUrl
    
    UI->>Storage: PUT file (direct upload)
    Storage-->>UI: Upload complete
    
    UI->>API: POST /api/upload/complete
    API->>DB: Update meeting (status: PROCESSING)
    API->>QStash: Publish process-meeting job
    API-->>UI: Upload confirmed
    
    QStash->>API: POST /api/jobs/process-meeting
    API->>DB: Fetch meeting record
    API->>Storage: Get signed file URL
    API->>Transcription: Transcribe audio
    Transcription-->>API: Return transcript
    
    API->>DB: Update meeting (store transcript)
    API->>Extraction: Extract compliance fields
    Extraction-->>API: Return extraction data
    
    API->>DB: Update meeting (store extraction, status: DRAFT_READY)
    API->>DB: Create compliance flags
    API->>Email: Send draft ready notification
    API-->>QStash: Processing complete
```

## Component Architecture

```mermaid
graph LR
    subgraph "Frontend (React/Next.js)"
        Pages[Pages<br/>- Dashboard<br/>- Meetings<br/>- Upload<br/>- Settings]
        Components[Components<br/>- UI Library<br/>- Forms<br/>- Navigation]
        Hooks[Hooks<br/>- useMeetingStatus<br/>- useNotifications]
    end

    subgraph "API Layer"
        AuthAPI[Auth API<br/>/api/auth/*]
        UploadAPI[Upload API<br/>/api/upload/*]
        MeetingAPI[Meeting API<br/>/api/meetings/*]
        WorkspaceAPI[Workspace API<br/>/api/workspaces/*]
        BillingAPI[Billing API<br/>/api/billing/*]
        JobAPI[Job API<br/>/api/jobs/*]
    end

    subgraph "Server Services"
        AuthService[Auth Service<br/>Auth.js Config]
        StorageService[Storage Service<br/>S3/R2 Operations]
        TranscriptionService[Transcription Service<br/>Provider Abstraction]
        ExtractionService[Extraction Service<br/>LLM Provider Abstraction]
        ExportService[Export Service<br/>PDF/CSV/TXT/ZIP]
        EmailService[Email Service<br/>Resend Integration]
        FlagService[Flag Service<br/>Compliance Detection]
    end

    subgraph "Data Layer"
        Prisma[Prisma Client]
        Models[Database Models<br/>- Workspace<br/>- Meeting<br/>- User<br/>- AuditEvent<br/>- Flag]
    end

    Pages --> AuthAPI
    Pages --> UploadAPI
    Pages --> MeetingAPI
    Pages --> WorkspaceAPI
    Pages --> BillingAPI
    
    UploadAPI --> StorageService
    UploadAPI --> JobAPI
    MeetingAPI --> ExportService
    MeetingAPI --> FlagService
    JobAPI --> TranscriptionService
    JobAPI --> ExtractionService
    JobAPI --> EmailService
    
    AuthAPI --> AuthService
    BillingAPI --> Stripe[Stripe API]
    
    UploadAPI --> Prisma
    MeetingAPI --> Prisma
    WorkspaceAPI --> Prisma
    JobAPI --> Prisma
    
    Prisma --> Models
    
    TranscriptionService --> Deepgram[Deepgram API]
    TranscriptionService --> AssemblyAI[AssemblyAI API]
    ExtractionService --> OpenAI[OpenAI API]
    ExtractionService --> Anthropic[Anthropic API]
    ExtractionService --> Vertex[Vertex AI API]
```

## Database Schema Overview

```mermaid
erDiagram
    Workspace ||--o{ UserWorkspace : has
    Workspace ||--o{ Meeting : contains
    Workspace ||--o{ AuditEvent : logs
    Workspace ||--o{ Flag : flags
    Workspace ||--o{ Invitation : invites
    
    User ||--o{ UserWorkspace : belongs_to
    User ||--o{ Account : authenticates
    User ||--o{ Session : sessions
    
    Meeting ||--o{ Version : versions
    Meeting ||--o{ Flag : has
    Meeting ||--o{ ResolutionRecord : resolves
    
    Flag ||--|| ResolutionRecord : resolved_by
    ResolutionRecord ||--o{ ActionItem : tasks
    ResolutionRecord ||--o{ EvidenceLink : evidence
    ResolutionRecord ||--o{ Verification : verified_by
```

## Authentication & Authorization Flow

```mermaid
sequenceDiagram
    participant User
    participant Browser
    participant Middleware
    participant Auth
    participant DB
    participant API

    User->>Browser: Access protected route
    Browser->>Middleware: Request
    Middleware->>Auth: Check session token
    Auth->>DB: Validate session
    alt No session
        Auth-->>Middleware: Unauthorized
        Middleware-->>Browser: Redirect to /auth/signin
    else Valid session
        Auth-->>Middleware: User + workspace context
        Middleware->>API: Forward request with user context
        API->>DB: Verify workspace membership
        API->>DB: Check role permissions
        alt Authorized
            API->>DB: Execute operation
            API-->>Browser: Success response
        else Unauthorized
            API-->>Browser: 403 Forbidden
        end
    end
```

## Multi-Tenant Isolation

```mermaid
graph TB
    subgraph "Workspace Isolation"
        W1[Workspace 1<br/>RIA Firm A]
        W2[Workspace 2<br/>RIA Firm B]
        W3[Workspace 3<br/>RIA Firm C]
    end

    subgraph "Database Queries"
        Q1[All queries filtered<br/>by workspaceId]
        Q2[Foreign keys enforce<br/>workspace relationships]
        Q3[Indexes optimize<br/>workspace-scoped queries]
    end

    subgraph "Storage Isolation"
        S1[workspaces/w1/meetings/...]
        S2[workspaces/w2/meetings/...]
        S3[workspaces/w3/meetings/...]
    end

    W1 --> Q1
    W2 --> Q1
    W3 --> Q1
    
    Q1 --> Q2
    Q2 --> Q3
    
    W1 --> S1
    W2 --> S2
    W3 --> S3
```

## Processing Pipeline

```mermaid
flowchart TD
    Start[User Uploads File] --> Init[Create Meeting Record<br/>Status: UPLOADING]
    Init --> Upload[Direct S3 Upload<br/>via Presigned URL]
    Upload --> Complete[Mark Upload Complete<br/>Status: PROCESSING]
    Complete --> Queue[Publish QStash Job]
    
    Queue --> Process[QStash Webhook<br/>/api/jobs/process-meeting]
    
    Process --> Transcribe[Transcribe Audio<br/>Deepgram/AssemblyAI]
    Transcribe --> StoreTranscript[Store Transcript<br/>in Database]
    
    StoreTranscript --> Extract[Extract Compliance Fields<br/>OpenAI/Anthropic/Vertex]
    Extract --> StoreExtraction[Store Extraction Data<br/>in Database]
    
    StoreExtraction --> DetectFlags[Detect Compliance Flags<br/>Missing disclosures, etc.]
    DetectFlags --> StoreFlags[Create Flag Records]
    
    StoreFlags --> GenerateSearch[Generate Searchable Text]
    GenerateSearch --> Ready[Update Status: DRAFT_READY]
    
    Ready --> Notify[Send Email Notification]
    Notify --> End[User Can Review & Finalize]
    
    style Start fill:#e1f5ff
    style End fill:#e8f5e9
    style Process fill:#fff4e1
    style Transcribe fill:#f3e5f5
    style Extract fill:#f3e5f5
```

## Technology Stack

### Frontend
- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **UI Library**: Radix UI + Tailwind CSS
- **State Management**: React Hooks + Server Components
- **Forms**: React Hook Form + Zod validation

### Backend
- **Runtime**: Next.js API Routes (Node.js)
- **ORM**: Prisma
- **Database**: PostgreSQL
- **Authentication**: Auth.js v5 (NextAuth)
- **Background Jobs**: Upstash QStash

### Storage & Infrastructure
- **File Storage**: S3-compatible (Cloudflare R2)
- **Hosting**: Vercel
- **Database Hosting**: Vercel Postgres / Neon

### External Services
- **Transcription**: Deepgram, AssemblyAI
- **LLM Extraction**: OpenAI, Anthropic, Google Vertex AI
- **Email**: Resend
- **Payments**: Stripe
- **Background Jobs**: Upstash QStash

## Key Architectural Patterns

### 1. Multi-Tenant Architecture
- **Workspace-based isolation**: All data scoped to workspace
- **Database-level enforcement**: Foreign keys ensure isolation
- **API-level validation**: All routes verify workspace membership
- **Storage isolation**: Files organized by workspace ID

### 2. Async Processing
- **QStash for background jobs**: Long-running tasks (transcription, extraction)
- **Webhook-based processing**: QStash calls API endpoint when ready
- **Status tracking**: Meeting status reflects processing state
- **Error handling**: Failed jobs can be retried

### 3. Direct File Upload
- **Presigned URLs**: Client uploads directly to S3/R2
- **Bypasses Vercel limits**: No 4.5MB function payload limit
- **Provenance tracking**: SHA-256 hashes for file integrity

### 4. Audit Trail
- **Append-only logs**: Immutable audit events
- **Comprehensive tracking**: All user actions logged
- **Workspace-scoped**: Audit logs isolated per workspace
- **Retention compliance**: Meets SEC 5-year requirement

### 5. Compliance Flags
- **Automated detection**: System flags compliance issues
- **Remediation workflow**: Track resolution of flags
- **Evidence linking**: Connect flags to transcript evidence
- **Verification process**: CCO can verify resolutions

## Security Architecture

### Authentication
- **OAuth providers**: Discord (primary), Google (optional)
- **Session management**: Secure HTTP-only cookies
- **Token-based**: JWT tokens for API authentication

### Authorization
- **Role-based access control**: OWNER_CCO vs MEMBER roles
- **Workspace membership**: Users belong to workspaces
- **Permission checks**: API routes verify role permissions

### Data Protection
- **Encryption in transit**: TLS 1.2+
- **Encryption at rest**: AES-256 for database and storage
- **Tenant isolation**: Strict workspace boundaries
- **Audit logging**: All actions tracked

## Deployment Architecture

```
┌─────────────────────────────────────────┐
│         Vercel Edge Network            │
│  (Global CDN + Edge Functions)          │
└─────────────────────────────────────────┘
                    │
        ┌───────────┴───────────┐
        │                       │
┌───────▼────────┐      ┌───────▼────────┐
│  Next.js App   │      │  API Routes    │
│  (SSR/SSG)     │      │  (Serverless)   │
└───────┬────────┘      └───────┬────────┘
        │                       │
        └───────────┬───────────┘
                    │
        ┌───────────▼───────────┐
        │   Vercel Postgres     │
        │   (Primary Database)   │
        └────────────────────────┘
                    │
        ┌───────────▼───────────┐
        │   Cloudflare R2        │
        │   (File Storage)        │
        └────────────────────────┘
                    │
        ┌───────────▼───────────┐
        │   Upstash QStash      │
        │   (Job Queue)          │
        └────────────────────────┘
```

## API Endpoints Overview

### Authentication
- `POST /api/auth/signin` - Sign in
- `POST /api/auth/signup` - Sign up
- `GET /api/auth/[...nextauth]` - NextAuth handlers

### Workspaces
- `POST /api/workspaces` - Create workspace
- `GET /api/workspaces` - List workspaces
- `PATCH /api/workspaces/[id]/settings` - Update settings

### Upload
- `POST /api/upload/init` - Initialize upload (get presigned URL)
- `POST /api/upload/complete` - Complete upload
- `POST /api/upload/transcript` - Upload transcript only

### Meetings
- `GET /api/meetings` - List meetings
- `GET /api/meetings/[id]` - Get meeting details
- `PATCH /api/meetings/[id]/edit` - Edit meeting
- `POST /api/meetings/[id]/finalize` - Finalize meeting
- `POST /api/meetings/[id]/export` - Export audit pack
- `POST /api/meetings/[id]/reprocess` - Reprocess meeting

### Background Jobs
- `POST /api/jobs/process-meeting` - Process meeting (QStash webhook)

### Billing
- `POST /api/billing/checkout` - Create Stripe checkout
- `POST /api/billing/webhook` - Stripe webhook handler
- `GET /api/billing/status` - Get billing status

### Compliance
- `GET /api/flags` - List flags
- `POST /api/flags/[id]/remediation` - Resolve flag

### Audit
- `GET /api/audit-logs` - List audit logs
- `GET /api/audit-logs/export` - Export audit logs

## Data Models

### Core Entities
- **Workspace**: Multi-tenant container
- **User**: Application user
- **UserWorkspace**: Many-to-many relationship (with role)
- **Meeting**: Client interaction record
- **Version**: Edit history for meetings
- **Flag**: Compliance issue
- **ResolutionRecord**: Flag resolution workflow
- **AuditEvent**: Immutable audit log

### Relationships
- Workspace → Meetings (1:N)
- Workspace → Users (N:M via UserWorkspace)
- Meeting → Versions (1:N)
- Meeting → Flags (1:N)
- Flag → ResolutionRecord (1:1)
- ResolutionRecord → ActionItems (1:N)
- ResolutionRecord → EvidenceLinks (1:N)

## Performance Considerations

### Database
- **Indexes**: Optimized for workspace-scoped queries
- **Connection pooling**: Managed by Vercel Postgres
- **Query optimization**: Prisma query optimization

### Storage
- **Presigned URLs**: Direct client-to-storage uploads
- **CDN**: Cloudflare R2 with global CDN
- **Compression**: ZIP exports use maximum compression

### Background Processing
- **Async jobs**: Long-running tasks offloaded to QStash
- **Retry logic**: Failed jobs automatically retried
- **Status tracking**: Real-time status updates

## Monitoring & Observability

### Logging
- **Console logs**: Structured logging for debugging
- **Error tracking**: Error responses with context
- **Audit logs**: All user actions logged to database

### Metrics
- `GET /api/metrics` - Application metrics endpoint
- Processing times tracked
- Error rates monitored

## Future Architecture Considerations

### Scalability
- **Horizontal scaling**: Stateless API routes
- **Database scaling**: Read replicas for reporting
- **Storage scaling**: S3-compatible storage scales automatically

### Extensibility
- **Provider abstraction**: Transcription and extraction providers are swappable
- **Flag system**: New compliance rules can be added
- **Export formats**: Additional formats can be added

### Compliance
- **Multi-jurisdiction**: Architecture supports SEC/FCA (see UK_US_MARKET_READINESS.md)
- **Retention policies**: Configurable per workspace
- **Legal hold**: Prevents deletion when active
