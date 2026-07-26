/**
 * CV-WEB-01 — Trust page content (honest certification status; no legal hold claim).
 */

export type CertificationStatus = {
  name: string;
  /** Honest status string shown on the trust page. */
  status: string;
  detail: string;
};

export type ImplementedControl = {
  id: string;
  title: string;
  summary: string;
};

export type Subprocessor = {
  name: string;
  purpose: string;
  location: string;
};

export type SubprocessorList = {
  version: string;
  effectiveDate: string;
  subprocessors: Subprocessor[];
};

/** SOC 2 not purchased / not started — never "in progress" without an observation date. */
export const CERTIFICATION_STATUS: CertificationStatus[] = [
  {
    name: "SOC 2 Type II",
    status: "Not started",
    detail:
      "No observation window has been opened and no SOC 2 report has been issued. We will publish a dated observation-window start here before any other status language.",
  },
];

/**
 * Controls that are implemented in product today.
 * Legal hold is intentionally omitted until CV-TR-05 ships (CV-WEB-01).
 */
export const IMPLEMENTED_CONTROLS: ImplementedControl[] = [
  {
    id: "object-lock-seal",
    title: "Sealed audit packs (Object Lock)",
    summary:
      "Finalised meeting packs are written to a dedicated sealed bucket keyed by SHA-256, with retention set to the firm’s fiscal-year expiry. Sealed bytes are not watermarked by billing status.",
  },
  {
    id: "hash-ledger",
    title: "Append-only seal ledger",
    summary:
      "Each seal records pack hash, seal timestamp, sealing user, storage URI, and expiry. Application privileges are designed for SELECT/INSERT only on the seal table.",
  },
  {
    id: "fiscal-retention",
    title: "Fiscal-year retention policy",
    summary:
      "Retention years and fiscal year-end are workspace policy. Expiry is computed from fiscal year end, not from an ad-hoc calendar offset.",
  },
  {
    id: "media-posture",
    title: "Documented media retention posture",
    summary:
      "Source media RETAIN vs DISCARD is a recorded CCO decision. Ingest is blocked until the decision exists. Discard deletes media only after transcript hash readback.",
  },
  {
    id: "supersession",
    title: "Supersession without erasure",
    summary:
      "Incorrect sealed records are corrected by creating a new draft that supersedes the original. The original seal and flags remain; the chain appears in the audit pack.",
  },
  {
    id: "custody-deposit",
    title: "External deposit custody labeling",
    summary:
      "SharePoint (and similar) deposits are labeled as convenience copies. The sealed Object Lock record is the system of record.",
  },
  {
    id: "encryption-rbac-audit",
    title: "Encryption, RBAC, and audit events",
    summary:
      "Integration tokens are encrypted at rest (AES-256). Workspace roles gate privileged actions. Compliance mutations write audit events (entity IDs; no client PII in logs).",
  },
];

export const SUBPROCESSORS: SubprocessorList = {
  version: "2026-07-26",
  effectiveDate: "2026-07-26",
  subprocessors: [
    {
      name: "Vercel",
      purpose: "Application hosting and edge delivery",
      location: "United States (primary)",
    },
    {
      name: "Neon",
      purpose: "Managed PostgreSQL database",
      location: "United States (primary)",
    },
    {
      name: "Cloudflare R2 / Amazon S3",
      purpose: "Object storage for working media and sealed packs",
      location: "United States (primary)",
    },
    {
      name: "Resend",
      purpose: "Transactional email",
      location: "United States",
    },
    {
      name: "Stripe",
      purpose: "Billing and payments",
      location: "United States",
    },
    {
      name: "Upstash",
      purpose: "QStash job delivery and Redis where configured",
      location: "United States",
    },
    {
      name: "Deepgram / AssemblyAI",
      purpose: "Speech-to-text transcription (when media is processed)",
      location: "United States",
    },
    {
      name: "Anthropic / OpenAI",
      purpose: "AI-assisted extraction and classification (triage signals)",
      location: "United States",
    },
  ],
};

export const SECURITY_OVERVIEW_PATH =
  "/security/complyvault-security-overview.txt";
