import { requireAppAccess } from "~/server/auth/guards";
import { isEmailIntelligenceEnabled } from "~/lib/feature-flags";
import {
  buildEmailCorrespondenceSection,
  emailCorrespondenceSectionToCsv,
} from "~/server/export/email-correspondence-section";
import { db } from "~/server/db";
import { z } from "zod";
import archiver from "archiver";

const querySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  const access = await requireAppAccess();
  if (!access.ok) {
    return Response.json({ success: false, error: access.error }, { status: access.status });
  }
  if (!isEmailIntelligenceEnabled()) {
    return Response.json({ success: false, error: "Feature disabled" }, { status: 404 });
  }

  const { id: clientId } = await context.params;
  const body = querySchema.safeParse(await request.json().catch(() => ({})));
  if (!body.success) {
    return Response.json({ success: false, error: "Invalid input" }, { status: 400 });
  }

  const to = body.data.to ? new Date(body.data.to) : new Date();
  const from = body.data.from
    ? new Date(body.data.from)
    : new Date(to.getTime() - 365 * 24 * 60 * 60 * 1000);

  const section = await buildEmailCorrespondenceSection({
    workspaceId: access.workspaceId,
    clientId,
    from,
    to,
  });
  if (!section) {
    return Response.json({ success: false, error: "Not found" }, { status: 404 });
  }

  const csv = emailCorrespondenceSectionToCsv(section);
  const zipBuffer = await new Promise<Buffer>((resolve, reject) => {
    const archive = archiver("zip", { zlib: { level: 9 } });
    const buffers: Buffer[] = [];
    archive.on("data", (chunk: Buffer) => buffers.push(chunk));
    archive.on("end", () => resolve(Buffer.concat(buffers)));
    archive.on("error", reject);
    archive.append(Buffer.from(csv, "utf-8"), { name: "05_Email_Correspondence.csv" });
    archive.append(
      Buffer.from(
        `Email Correspondence Pack\nClient: ${section.clientName}\nRange: ${section.from} to ${section.to}\n`,
        "utf-8"
      ),
      { name: "README.txt" }
    );
    void archive.finalize();
  });

  await db.auditEvent.create({
    data: {
      workspaceId: access.workspaceId,
      userId: access.session.user.id,
      action: "EXPORT",
      resourceType: "client",
      resourceId: clientId,
      metadata: {
        exportFormat: "email_correspondence_zip",
        from: section.from,
        to: section.to,
        messageCount: section.coverage.messageCount,
      },
    },
  });

  const filename = `${section.clientName.replace(/\s+/g, "_")}_EmailCorrespondence.zip`;
  return new Response(new Uint8Array(zipBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
