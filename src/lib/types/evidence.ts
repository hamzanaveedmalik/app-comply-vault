/**
 * Evidence + mailbox DTOs — never expose raw Prisma models to the client.
 */

export type EvidenceItemDto = {
  id: string;
  workspaceId: string;
  clientId: string | null;
  sourceType: string;
  title: string;
  occurredAt: string;
  ingestedAt: string;
  contentSha256: string;
  tags: Array<{ category: string; addedBy: string; addedAt: string }>;
};

export type CommunicationThreadDto = {
  id: string;
  subject: string | null;
  channel: string;
  participantCount: number;
  messageCount: number;
  lastMessageAt: string | null;
  clientId: string | null;
  clientName: string | null;
};

export type CommunicationMessageDto = {
  id: string;
  evidenceItemId: string;
  direction: string;
  sentAt: string;
  fromAddress: string;
  toAddresses: string[];
  ccAddresses: string[];
  bodyText: string;
  bodyHtml: string | null;
  classificationStatus: "PENDING" | "COMPLETE" | "FAILED" | null;
  attachments: Array<{
    id: string;
    filename: string;
    mimeType: string;
    contentSha256: string;
    sizeBytes: number | null;
  }>;
};

export type MailboxConnectionDto = {
  id: string;
  mailboxAddress: string;
  provider: string;
  consentMode: string;
  scopeFolders: string[];
  backfillFrom: string | null;
  status: string;
  lastSyncAt: string | null;
  lastErrorMessage: string | null;
};

export type MailFolderDto = {
  id: string;
  displayName: string;
  parentFolderId: string | null;
};

export type EmailTriageItemDto = {
  id: string;
  address: string;
  status: string;
  userId: string | null;
  clientId: string | null;
  createdAt: string;
  /** Threads that include this address (for confirm preview). */
  historicalThreadCount: number;
};

export type M365WorkspaceStatus = {
  connected: boolean;
  consentMode: "APPLICATION" | "DELEGATED" | null;
  tenantId: string | null;
  expiresAt: string | null;
  oauthConfigured: boolean;
};

export type GmailWorkspaceStatus = {
  connected: boolean;
  expiresAt: string | null;
  oauthConfigured: boolean;
};
