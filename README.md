# ComplyVault

Exam-ready client interaction records for Registered Investment Advisers (RIAs) — turned around in minutes, not hours.

## Overview

ComplyVault is a compliance documentation platform for RIAs. It turns raw client interactions — meeting recordings, transcripts, and email threads — into exam-ready, human-reviewed compliance records, and pushes those records into the tools firms already use (document storage, CRM).

Guiding principle: **AI surfaces what needs attention; a human decides; every decision is preserved for an SEC exam.**

```
Capture  →  AI triage  →  Human review & sign-off  →  Audit pack  →  Sync out
(meetings,   (transcribe,   (advisor / CM / CCO       (PDF/CSV/TXT   (SharePoint,
 email)       extract,       three-layer workflow)      + manifest)    Zoho CRM)
              flag)
```

## Features

- **Multi-source capture** — manual upload, Zoom (OAuth + webhooks), Microsoft Teams (transcripts/call records), and M365 mailbox sync, all converging on one processing pipeline.
- **AI processing pipeline** — pluggable ASR (AssemblyAI, Deepgram) for transcription and pluggable LLM providers (OpenAI, Anthropic, Vertex) for extracting topics, disclosures, decisions, and follow-ups.
- **Compliance flagging** — rules + AI detect missing disclosures, conflict language, and missing suitability basis, with severity levels and firm-profile-aware suppression.
- **Three-layer sign-off workflow** — Advisor certification → Compliance Manager (CM) flag triage → CCO final sign-off, with every transition timestamped and audit-logged.
- **Communications & email triage** — client-centric view of email threads captured as compliance evidence.
- **Audit packs** — exam-ready export bundles (PDF/CSV/TXT + manifest) per meeting.
- **Integrations** — SharePoint deposit, Zoho CRM sync, SEC IAPD/CRD lookup.
- **Multi-tenant workspaces** — role-based access (Owner/CCO, Member), invitation-based onboarding, audit trail on every consequential action.
- **Ask ComplyVault** — hybrid-retrieval Q&A over a workspace's compliance records.
- **Billing, notifications (email/in-app), and search** built in.

See [`docs/product/app-functionality-overview.md`](./docs/product/app-functionality-overview.md) for the full functional breakdown and implementation status, and [`docs/README.md`](./docs/README.md) for the documentation index.

## Tech Stack

- **Framework**: Next.js 15 (App Router), React 19, TypeScript
- **Database**: PostgreSQL + Prisma ORM
- **Authentication**: Auth.js v5 (NextAuth)
- **Storage**: S3/R2 compatible (Cloudflare R2 recommended)
- **Background jobs**: Upstash QStash / BullMQ + Redis
- **AI providers**: OpenAI, Anthropic, AssemblyAI, Deepgram
- **Styling**: Tailwind CSS, Radix UI
- **Testing**: Vitest (unit), Cypress (e2e)

## Getting Started

See [SETUP_GUIDE.md](./SETUP_GUIDE.md) for detailed setup instructions.

### Quick Start

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd app-comply-vault
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   ```

4. **Set up database**
   ```bash
   npm run db:push
   ```

5. **Start development server**
   ```bash
   npm run dev
   ```

## Environment Variables

See [`.env.example`](./.env.example) and [SETUP_GUIDE.md](./SETUP_GUIDE.md) for the complete list.

Core (required):
- `DATABASE_URL` / `DIRECT_URL` — PostgreSQL connection strings
- `AUTH_SECRET` — NextAuth secret (generate with `openssl rand -base64 32`)
- `AUTH_DISCORD_ID` / `AUTH_DISCORD_SECRET` — OAuth credentials
- `S3_BUCKET_NAME`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` — S3/R2 storage
- `INTEGRATION_ENCRYPTION_KEY` — encryption key for stored integration credentials

Optional, feature-gated:
- `REDIS_URL` — background job queue
- `ZOOM_CLIENT_ID` / `ZOOM_CLIENT_SECRET` / `ZOOM_WEBHOOK_SECRET` — Zoom integration
- `TEAMS_CLIENT_ID` / `TEAMS_CLIENT_SECRET` / `TEAMS_TENANT_ID` — Microsoft Teams integration
- `GMAIL_MAIL_CLIENT_ID` / `GMAIL_MAIL_CLIENT_SECRET` — Gmail mailbox sync
- `ZOHO_CRM_CLIENT_ID` / `ZOHO_CRM_CLIENT_SECRET` — Zoho CRM sync
- `SEC_API_KEY` — SEC IAPD/CRD lookups
- `TRANSCRIPTION_PROVIDER`, `DEEPGRAM_API_KEY` — transcription provider config
- `RESEND_API_KEY` — transactional email
- `EMAIL_INTELLIGENCE_ENABLED`, `NEXT_PUBLIC_EMAIL_INTELLIGENCE`, `ASK_HYBRID_RETRIEVAL` — feature flags

## Project Structure

```
app-comply-vault/
├── prisma/
│   ├── schema.prisma            # Database schema
│   └── migrations/              # Migration history
├── src/
│   ├── app/                     # Next.js App Router
│   │   ├── (app)/                # Protected app routes (dashboard, meetings,
│   │   │                         #   review, upload, communications, integrations, ...)
│   │   └── api/                  # API routes (upload, meetings, flags, mailbox,
│   │                              #   integrations, webhooks, cron, billing, ...)
│   ├── server/                  # Server-side utilities
│   │   ├── auth/                 # Auth.js configuration
│   │   ├── transcription/        # ASR provider abstraction
│   │   ├── extraction/           # LLM-based compliance extraction
│   │   ├── integrations/         # Zoom, Teams, M365, Zoho, SharePoint
│   │   ├── storage.ts            # S3/R2 storage
│   │   └── qstash.ts             # Background job client
│   ├── components/              # UI components
│   └── middleware.ts             # Next.js middleware
├── cypress/                     # E2E tests
└── docs/                        # Product, architecture, and UX documentation
```

## Development

### Database

```bash
# Generate Prisma client
npm run postinstall

# Push schema changes (dev)
npm run db:push

# Create/apply a migration
npm run db:create-migration
npm run db:migrate

# Open Prisma Studio (visual DB browser)
npm run db:studio
```

### Testing

```bash
npm run typecheck   # TypeScript
npm run test        # Vitest unit tests
npm run test:e2e    # Cypress e2e tests (headless)
```

### Build

```bash
npm run build
```

## Deployment

See [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) for full deployment instructions. Docker and docker-compose configs are also provided (`Dockerfile`, `docker-compose.yml`).

### Vercel Deployment

1. Push to GitHub
2. Import repository in Vercel
3. Add environment variables in Vercel dashboard
4. Deploy

## Documentation

- [docs/README.md](./docs/README.md) — full documentation index (product, architecture, user journeys)
- [docs/product/app-functionality-overview.md](./docs/product/app-functionality-overview.md) — what's implemented today vs. planned
- [SETUP_GUIDE.md](./SETUP_GUIDE.md) — complete setup instructions
- [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) — GitHub + Vercel deployment

## License

Private — All rights reserved
