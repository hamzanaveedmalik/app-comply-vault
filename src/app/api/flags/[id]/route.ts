import { auth } from "~/server/auth";
import { z } from "zod";

const resolveFlagSchema = z.object({
  action: z.enum(["RESOLVE", "DISMISS", "OVERRIDE"]),
  resolutionType: z.enum([
    "ADD_CONTEXT",
    "DISMISSED_WITH_REASON",
    "DISCLOSED_ELSEWHERE",
    "FOLLOW_UP_REQUIRED",
    "OVERRIDE_APPROVED",
  ]),
  resolutionNote: z.string().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.workspaceId || !session.user.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    await params;
    const body = await request.json();
    resolveFlagSchema.parse(body);

    return Response.json(
      {
        error:
          "Legacy resolve endpoint is disabled. Use /api/flags/[id]/remediation for remediation workflows.",
      },
      { status: 410 }
    );

  } catch (error) {
    console.error("Error resolving flag:", error);
    if (error instanceof z.ZodError) {
      return Response.json(
        { error: "Invalid request body", details: error.errors },
        { status: 400 }
      );
    }
    return Response.json(
      { error: error instanceof Error ? error.message : "An unknown error occurred" },
      { status: 500 }
    );
  }
}
