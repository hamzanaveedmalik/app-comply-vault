import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { uploadFile } from "~/server/storage";
import { validateFile, getContentType } from "~/server/storage-utils";
import { publishProcessMeetingJob } from "~/server/qstash";
import { sha256FromBuffer } from "~/server/hash";
import { env } from "~/env";
import { z } from "zod";
import { assertCanUpload } from "~/server/billing/guards";

const uploadSchema = z.object({
  clientName: z.string().min(1, "Client name is required"),
  meetingType: z.string().min(1, "Meeting type is required"),
  meetingDate: z.string().datetime("Meeting date must be a valid ISO datetime"),
  consent: z.boolean().refine((val) => val === true, {
    message: "You must confirm you have permission to upload this recording",
  }),
});

export async function POST(request: Request) {
  const startTime = Date.now();
  
  try {
    const session = await auth();
    if (!session?.user?.workspaceId) {
      return new Response("Unauthorized", { status: 401 });
    }

    const gate = await assertCanUpload(session.user.workspaceId);
    if (!gate.ok) {
      return Response.json({ error: gate.error }, { status: gate.status });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const clientName = formData.get("clientName") as string | null;
    const meetingType = formData.get("meetingType") as string | null;
    const meetingDate = formData.get("meetingDate") as string | null;
    const consent = formData.get("consent") === "true";

    // Validate form data
    const validation = uploadSchema.parse({
      clientName,
      meetingType,
      meetingDate,
      consent,
    });

    if (!file) {
      return Response.json({ error: "File is required" }, { status: 400 });
    }

    // Validate file
    const fileValidation = validateFile(file.name, file.size);
    if (!fileValidation.valid) {
      return Response.json(
        { error: fileValidation.error },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);
    const fileHash = sha256FromBuffer(fileBuffer);

    // Create meeting record first (to get meetingId)
    const meeting = await db.meeting.create({
      data: {
        workspaceId: session.user.workspaceId,
        clientName: validation.clientName,
        meetingType: validation.meetingType,
        meetingDate: new Date(validation.meetingDate),
        status: "UPLOADING",
        sourceFileSha256: fileHash,
        sourceFileName: file.name,
        sourceFileSize: file.size,
        sourceFileMime: getContentType(file.name),
        sourceUploadedAt: new Date(),
      },
    });

    // Upload file to S3/R2
    const { key, url } = await uploadFile(
      session.user.workspaceId,
      meeting.id,
      fileBuffer,
      file.name,
      getContentType(file.name)
    );

    // Update meeting with file key (stored as S3 key, not full URL)
    // This allows us to generate signed URLs when needed
    await db.meeting.update({
      where: { id: meeting.id },
      data: {
        fileUrl: key, // Store the key, not the S3 URL
        sourceFileSha256: fileHash,
        sourceFileName: file.name,
        sourceFileSize: file.size,
        sourceFileMime: getContentType(file.name),
        sourceUploadedAt: new Date(),
      },
    });

    // Publish QStash job for background processing
    try {
      if (!env.QSTASH_TOKEN) {
        console.warn("⚠️ QSTASH_TOKEN not configured - jobs will not be published automatically");
        console.warn("   Meeting will stay in UPLOADING status. Configure QStash or manually trigger jobs.");
      } else {
        await publishProcessMeetingJob({
          meetingId: meeting.id,
          workspaceId: session.user.workspaceId,
          fileUrl: key, // Pass the key, not the S3 URL
        });

        // Update meeting status to PROCESSING
        await db.meeting.update({
          where: { id: meeting.id },
          data: { status: "PROCESSING" },
        });

        console.log(`✅ Meeting ${meeting.id} status updated to PROCESSING`);
      }
    } catch (error) {
      console.error("❌ Error publishing QStash job:", error);
      console.error("   Meeting will stay in UPLOADING status. Check QStash configuration.");
      // Don't fail the upload if job publishing fails - job can be retried later
    }

    // Log upload event
    await db.auditEvent.create({
      data: {
        workspaceId: session.user.workspaceId,
        userId: session.user.id,
        action: "UPLOAD",
        resourceType: "meeting",
        resourceId: meeting.id,
        metadata: {
          fileName: file.name,
          fileSize: file.size,
          contentType: getContentType(file.name),
          sha256: fileHash,
        },
      },
    });

    // Ensure response is within 3 seconds (NFR7)
    const elapsed = Date.now() - startTime;
    if (elapsed > 3000) {
      console.warn(`Upload took ${elapsed}ms, exceeding 3s target`);
    }

    return Response.json(
      {
        meetingId: meeting.id,
        status: meeting.status,
        fileUrl: url,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: error.errors }, { status: 400 });
    }
    console.error("Error uploading file:", error);
    return Response.json(
      { error: "Failed to upload file" },
      { status: 500 }
    );
  }
}

