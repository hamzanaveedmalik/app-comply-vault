# RIA Compliance Tool

Exam-ready client interaction records in <10 minutes.

## Overview

The RIA Compliance Tool is a standalone SaaS product that turns Zoom meeting recordings into Exam-Ready Client Interaction Records—a structured documentation pack designed to support an RIA's books-and-records workflow.

## Features

- ✅ Multi-tenant workspace architecture
- ✅ User authentication & role management (Owner/CCO, Member)
- ✅ File upload (Zoom recordings: mp3, mp4, wav, m4a)
- ✅ Async transcription pipeline (Deepgram/AssemblyAI)
- ✅ Transcript viewer with timestamps and speaker labels
- ✅ Email notifications (draft ready)
- ✅ Audit trail logging

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Database**: PostgreSQL + Prisma ORM
- **Authentication**: Auth.js v5 (NextAuth)
- **Storage**: S3/R2 compatible (Cloudflare R2 recommended)
- **Background Jobs**: Upstash QStash
- **Styling**: Tailwind CSS

## Getting Started

See [SETUP_GUIDE.md](./SETUP_GUIDE.md) for detailed setup instructions.

### Quick Start

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd ria-compliance-tool
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

See [SETUP_GUIDE.md](./SETUP_GUIDE.md) for complete environment variable setup.

Required:
- `DATABASE_URL` - PostgreSQL connection string
- `AUTH_SECRET` - NextAuth secret (generate with `openssl rand -base64 32`)
- `AUTH_DISCORD_ID` - Discord OAuth client ID
- `AUTH_DISCORD_SECRET` - Discord OAuth client secret
- `S3_BUCKET_NAME` - S3/R2 bucket name
- `S3_ACCESS_KEY_ID` - S3/R2 access key
- `S3_SECRET_ACCESS_KEY` - S3/R2 secret key

Optional:
- `QSTASH_TOKEN` - Upstash QStash token (for background jobs)
- `TRANSCRIPTION_PROVIDER` - "deepgram" or "assemblyai"
- `DEEPGRAM_API_KEY` - Deepgram API key
- `RESEND_API_KEY` - Resend API key (for emails)

## Project Structure

```
ria-compliance-tool/
├── prisma/
│   └── schema.prisma          # Database schema
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (app)/              # Protected app routes
│   │   │   ├── dashboard/      # Dashboard page
│   │   │   ├── meetings/       # Meeting detail pages
│   │   │   ├── upload/         # Upload page
│   │   │   └── settings/       # Settings page
│   │   └── api/                # API routes
│   │       ├── upload/         # File upload endpoint
│   │       ├── jobs/           # QStash job handlers
│   │       └── workspaces/     # Workspace management
│   ├── server/                 # Server-side utilities
│   │   ├── auth/               # Auth.js configuration
│   │   ├── transcription/      # Transcription providers
│   │   ├── storage.ts          # S3/R2 storage
│   │   └── qstash.ts          # QStash client
│   └── middleware.ts           # Next.js middleware
└── .env                        # Environment variables (not committed)
```

## Development

### Database

```bash
# Generate Prisma client
npm run postinstall

# Push schema changes
npm run db:push

# Open Prisma Studio (visual DB browser)
npm run db:studio
```

### Type Checking

```bash
npm run typecheck
```

### Build

```bash
npm run build
```

## Deployment

See [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) for deployment instructions.

### Vercel Deployment

1. Push to GitHub
2. Import repository in Vercel
3. Add environment variables in Vercel dashboard
4. Deploy

## Documentation

- [SETUP_GUIDE.md](./SETUP_GUIDE.md) - Complete setup instructions
- [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) - GitHub + Vercel deployment
- [EPIC2_SUMMARY.md](./EPIC2_SUMMARY.md) - EPIC 2 implementation summary
- [TESTING_GUIDE.md](./TESTING_GUIDE.md) - Testing scenarios

## License

Private - All rights reserved
