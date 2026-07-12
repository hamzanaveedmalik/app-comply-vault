/**
 * Immutable storage for mailbox content (MIME + attachments).
 */

import {
  PutObjectCommand,
  GetObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "~/env";
import { sha256FromBuffer } from "~/server/hash";

function getS3Client(): S3Client {
  if (!env.S3_ACCESS_KEY_ID || !env.S3_SECRET_ACCESS_KEY) {
    throw new Error("S3 credentials required for mailbox storage");
  }
  const isR2Endpoint = !!env.S3_ENDPOINT?.includes("r2.cloudflarestorage.com");
  return new S3Client({
    region: env.S3_REGION || "auto",
    endpoint: env.S3_ENDPOINT,
    forcePathStyle: isR2Endpoint,
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    },
  });
}

const BUCKET = env.S3_BUCKET_NAME;

export function mailboxStorageKey(
  workspaceId: string,
  connectionId: string,
  messageId: string,
  suffix: string
): string {
  const safe = suffix.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `workspaces/${workspaceId}/mailbox/${connectionId}/${messageId}/${safe}`;
}

export async function uploadMailboxContent(args: {
  workspaceId: string;
  connectionId: string;
  messageId: string;
  filename: string;
  content: Buffer;
  contentType: string;
}): Promise<{ storageUri: string; contentSha256: string }> {
  if (!BUCKET) throw new Error("S3_BUCKET_NAME not set");

  const key = mailboxStorageKey(
    args.workspaceId,
    args.connectionId,
    args.messageId,
    args.filename
  );
  const contentSha256 = sha256FromBuffer(args.content);
  const s3 = getS3Client();

  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: args.content,
      ContentType: args.contentType,
      Metadata: {
        workspaceId: args.workspaceId,
        contentSha256,
      },
    })
  );

  return { storageUri: key, contentSha256 };
}

export async function getMailboxDownloadUrl(
  storageUri: string,
  expiresIn = 3600
): Promise<string> {
  if (!BUCKET) throw new Error("S3_BUCKET_NAME not set");
  const s3 = getS3Client();
  return getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: BUCKET, Key: storageUri }),
    { expiresIn }
  );
}
