/**
 * Thread export — PDF + EML/ZIP + custody manifest.
 * Epic B CV-B-08
 */

import archiver from "archiver";
import PDFDocument from "pdfkit";
import { db } from "~/server/db";
import { getMailboxDownloadUrl } from "~/server/mailbox/storage";
import { sha256FromBuffer } from "~/server/hash";

export type ThreadExportResult = {
  zipBuffer: Buffer;
  manifestSha256: string;
  itemCount: number;
};

export async function buildThreadExport(args: {
  workspaceId: string;
  threadId: string;
  userId: string;
}): Promise<ThreadExportResult> {
  const thread = await db.communicationThread.findFirst({
    where: {
      id: args.threadId,
      workspaceId: args.workspaceId,
      deletedAt: null,
    },
    include: {
      messages: {
        where: { deletedAt: null },
        orderBy: { sentAt: "asc" },
        include: {
          evidenceItem: true,
          attachments: { where: { deletedAt: null } },
        },
      },
    },
  });

  if (!thread) throw new Error("Thread not found");

  const manifestItems: Array<Record<string, string>> = [];

  const archive = archiver("zip", { zlib: { level: 9 } });
  const chunks: Buffer[] = [];
  archive.on("data", (chunk: Buffer) => chunks.push(chunk));

  const done = new Promise<Buffer>((resolve, reject) => {
    archive.on("end", () => resolve(Buffer.concat(chunks)));
    archive.on("error", reject);
  });

  for (const msg of thread.messages) {
    const item = {
      evidenceItemId: msg.evidenceItemId,
      sourceType: msg.evidenceItem.sourceType,
      occurredAt: msg.evidenceItem.occurredAt.toISOString(),
      ingestedAt: msg.evidenceItem.ingestedAt.toISOString(),
      fromAddress: msg.fromAddress,
      contentSha256: msg.evidenceItem.contentSha256,
      storageUri: msg.evidenceItem.storageUri ?? "",
    };
    manifestItems.push({
      evidenceItemId: item.evidenceItemId,
      sourceType: item.sourceType,
      occurredAt: item.occurredAt,
      ingestedAt: item.ingestedAt,
      fromAddress: item.fromAddress,
      contentSha256: item.contentSha256,
    });

    if (msg.evidenceItem.storageUri) {
      const url = await getMailboxDownloadUrl(msg.evidenceItem.storageUri);
      const res = await fetch(url);
      if (res.ok) {
        const eml = Buffer.from(await res.arrayBuffer());
        archive.append(eml, {
          name: `messages/${msg.sentAt.toISOString()}-${msg.id}.eml`,
        });
      }
    }

    for (const att of msg.attachments) {
      const url = await getMailboxDownloadUrl(att.storageUri);
      const res = await fetch(url);
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        archive.append(buf, {
          name: `attachments/${msg.id}/${att.filename}`,
        });
        manifestItems.push({
          evidenceItemId: msg.evidenceItemId,
          attachmentId: att.id,
          filename: att.filename,
          contentSha256: att.contentSha256,
        });
      }
    }
  }

  const pdf = await buildIndexPdf({
    threadSubject: thread.subject ?? "(no subject)",
    threadId: thread.id,
    manifestItems,
    exportedAt: new Date().toISOString(),
  });
  archive.append(pdf, { name: "index.pdf" });

  const manifestJson = JSON.stringify(
    {
      threadId: thread.id,
      items: [...manifestItems].sort((a, b) =>
        (a.evidenceItemId ?? "").localeCompare(b.evidenceItemId ?? "")
      ),
    },
    null,
    0
  );
  archive.append(manifestJson, { name: "manifest.json" });
  const manifestSha256 = sha256FromBuffer(Buffer.from(manifestJson, "utf8"));
  archive.append(manifestSha256, { name: "manifest.sha256" });

  await archive.finalize();
  const zipBuffer = await done;

  for (const msg of thread.messages) {
    await db.auditEvent.create({
      data: {
        workspaceId: args.workspaceId,
        userId: args.userId,
        action: "THREAD_EXPORT",
        resourceType: "evidence_item",
        resourceId: msg.evidenceItemId,
        metadata: { threadId: thread.id, manifestSha256 },
      },
    });
  }

  return {
    zipBuffer,
    manifestSha256,
    itemCount: thread.messages.length,
  };
}

async function buildIndexPdf(args: {
  threadSubject: string;
  threadId: string;
  manifestItems: Array<Record<string, string>>;
  exportedAt: string;
}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(18).text("ComplyVault — Email Thread Export", { underline: true });
    doc.moveDown();
    doc.fontSize(12).text(`Subject: ${args.threadSubject}`);
    doc.text(`Thread ID: ${args.threadId}`);
    doc.text(`Exported at: ${args.exportedAt}`);
    doc.moveDown();
    doc.text("Chain of custody manifest:");
    doc.moveDown(0.5);

    for (const item of args.manifestItems) {
      doc.fontSize(10).text(
        `- ${item.evidenceItemId} | ${item.occurredAt ?? ""} | sha256:${item.contentSha256 ?? ""}`
      );
    }

    doc.end();
  });
}
