import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { generatePresignedUploadUrl } from "~/server/storage";
import { validateFile, getContentType } from "~/server/storage-utils";
import { z } from "zod";

const initUploadSchema = z.object({
  clientName: z.string().min(1, "Client name is required"),
  meetingType: z.string().min(1, "Meeting type is required"),
  meetingDate: z.string().datetime("Meeting date must be a valid ISO datetime"),
  consent: z.boolean().refine((val) => val === true, {
    message: "You must confirm you have permission to upload this recording",
  }),
  fileName: z.string().min(1, "File name is required"),
  fileSize: z.number().min(1, "File size must be greater than 0"),
});

/**
 * Initialize upload: Create meeting record and generate presigned URL for direct S3 upload
 * This bypasses Vercel's 4.5 MB function payload limit
 */
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.workspaceId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validation = initUploadSchema.parse(body);

    // Validate file
    const fileValidation = validateFile(validation.fileName, validation.fileSize);
    if (!fileValidation.valid) {
      return Response.json(
        { error: fileValidation.error },
        { status: 400 }
      );
    }

    // Create meeting record
    const meeting = await db.meeting.create({
      data: {
        workspaceId: session.user.workspaceId,
        clientName: validation.clientName,
        meetingType: validation.meetingType,
        meetingDate: new Date(validation.meetingDate),
        status: "UPLOADING",
      },
    });

    // Generate presigned URL for direct S3 upload
    const { key, uploadUrl } = await generatePresignedUploadUrl(
      session.user.workspaceId,
      meeting.id,
      validation.fileName,
      getContentType(validation.fileName)
    );

    // Store the key in the meeting record
    await db.meeting.update({
      where: { id: meeting.id },
      data: { fileUrl: key },
    });

    // Log upload initiation
    await db.auditEvent.create({
      data: {
        workspaceId: session.user.workspaceId,
        userId: session.user.id,
        action: "UPLOAD",
        resourceType: "meeting",
        resourceId: meeting.id,
        metadata: {
          fileName: validation.fileName,
          fileSize: validation.fileSize,
          contentType: getContentType(validation.fileName),
          action: "upload_initiated",
        },
      },
    });

    return Response.json({
      meetingId: meeting.id,
      uploadUrl,
      key,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: error.errors }, { status: 400 });
    }
    console.error("Error initializing upload:", error);
    return Response.json(
      { error: "Failed to initialize upload" },
      { status: 500 }
    );
  }
}

