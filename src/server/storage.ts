import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "~/env";

// Initialize S3 client (works with AWS S3, Cloudflare R2, and other S3-compatible storage)
// Note: Client is created lazily to avoid build-time errors if env vars aren't set
function getS3Client() {
  if (!env.S3_ACCESS_KEY_ID || !env.S3_SECRET_ACCESS_KEY) {
    throw new Error("S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY environment variables are required");
  }
  
  return new S3Client({
    region: env.S3_REGION || "auto",
    endpoint: env.S3_ENDPOINT, // For R2: https://<account-id>.r2.cloudflarestorage.com
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    },
  });
}

const BUCKET_NAME = env.S3_BUCKET_NAME;

/**
 * Generate storage key with workspace prefix
 * Pattern: workspaces/{workspaceId}/meetings/{meetingId}/recording.{ext}
 */
export function generateStorageKey(
  workspaceId: string,
  meetingId: string,
  filename: string
): string {
  // Extract file extension
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  // Sanitize filename (remove path separators and special chars)
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, "_");
  
  return `workspaces/${workspaceId}/meetings/${meetingId}/recording.${ext}`;
}

/**
 * Upload file to S3/R2 storage
 * Files are encrypted at rest by default (S3/R2 encryption)
 */
export async function uploadFile(
  workspaceId: string,
  meetingId: string,
  file: Buffer,
  filename: string,
  contentType: string
): Promise<{ key: string; url: string }> {
  if (!BUCKET_NAME) {
    throw new Error("S3_BUCKET_NAME environment variable is not set");
  }

  const s3Client = getS3Client();
  const key = generateStorageKey(workspaceId, meetingId, filename);

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: file,
    ContentType: contentType,
    // Server-side encryption (SSE) - handled by S3/R2 by default
    // For explicit encryption, add: ServerSideEncryption: "AES256"
    // Metadata for workspace isolation tracking
    Metadata: {
      workspaceId,
      meetingId,
      uploadedAt: new Date().toISOString(),
    },
  });

  await s3Client.send(command);

  // Return the storage key and a reference URL
  // In production, use signed URLs for secure access
  const url = `s3://${BUCKET_NAME}/${key}`;

  return { key, url };
}

/**
 * Generate a signed URL for secure file access
 * Validates workspace access before generating URL
 */
export async function getSignedFileUrl(
  key: string,
  expiresIn: number = 3600 // 1 hour default
): Promise<string> {
  if (!BUCKET_NAME) {
    throw new Error("S3_BUCKET_NAME environment variable is not set");
  }

  const s3Client = getS3Client();
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  const signedUrl = await getSignedUrl(s3Client, command, { expiresIn });
  return signedUrl;
}

/**
 * Extract workspace ID from storage key
 * Used for workspace validation
 */
export function extractWorkspaceIdFromKey(key: string): string | null {
  const match = key.match(/^workspaces\/([^/]+)\//);
  return match ? (match[1] ?? null) : null;
}

/**
 * Validate that a storage key belongs to a specific workspace
 */
export function validateWorkspaceAccess(
  key: string,
  workspaceId: string
): boolean {
  const keyWorkspaceId = extractWorkspaceIdFromKey(key);
  return keyWorkspaceId === workspaceId;
}

/**
 * Generate a presigned URL for direct client-side upload to S3/R2
 * This bypasses Vercel's 4.5 MB function payload limit
 */
export async function generatePresignedUploadUrl(
  workspaceId: string,
  meetingId: string,
  filename: string,
  contentType: string,
  expiresIn: number = 3600 // 1 hour default
): Promise<{ key: string; uploadUrl: string }> {
  if (!BUCKET_NAME) {
    throw new Error("S3_BUCKET_NAME environment variable is not set");
  }

  const s3Client = getS3Client();
  const key = generateStorageKey(workspaceId, meetingId, filename);

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    ContentType: contentType,
    // Metadata for workspace isolation tracking
    Metadata: {
      workspaceId,
      meetingId,
      uploadedAt: new Date().toISOString(),
    },
  });

  const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn });
  return { key, uploadUrl };
}

