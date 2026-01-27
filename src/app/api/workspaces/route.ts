import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { z } from "zod";
import { sendWelcomeEmail } from "~/server/email";

const createWorkspaceSchema = z.object({
  name: z.string().min(1, "Workspace name is required").max(100),
  pilotCode: z.string().optional(), // Optional pilot code for free setup
});

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return new Response("Unauthorized", { status: 401 });
    }

    const body = await request.json();
    const { name, pilotCode } = createWorkspaceSchema.parse(body);

    await db.user.upsert({
      where: { id: session.user.id },
      create: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        image: session.user.image,
      },
      update: {
        email: session.user.email,
        name: session.user.name,
        image: session.user.image,
      },
    });

    const ipAddress =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip");
    const userAgent = request.headers.get("user-agent");

    // Validate pilot code if provided (for free setup)
    // In production, this would check against a database of valid codes
    const setupFee = pilotCode === "FREEPILOT" ? 0 : 500;
    const pilotStartDate = new Date();

    // Create workspace with pilot provisioning
    const workspace = await db.workspace.create({
      data: {
        name,
        retentionYears: 6, // Default per SEC requirement + buffer
        legalHold: false,
        billingStatus: "PILOT",
        pilotStartDate,
        users: {
          create: {
            userId: session.user.id,
            role: "OWNER_CCO",
          },
        },
      },
    });

    // Log workspace creation and pilot provisioning in audit event
    await db.auditEvent.create({
      data: {
        workspaceId: workspace.id,
        userId: session.user.id,
        action: "WORKSPACE_CREATED",
        resourceType: "workspace",
        resourceId: workspace.id,
        metadata: {
          workspaceName: name,
          action: "workspace_created",
          pilotProvisioned: true,
          setupFee,
          pilotCode: pilotCode || null,
          pilotStartDate: pilotStartDate.toISOString(),
          ipAddress,
          userAgent,
        },
      },
    });

    // Send welcome email with onboarding checklist
    if (session.user.email) {
      try {
        await sendWelcomeEmail({
          email: session.user.email,
          workspaceName: name,
          userName: session.user.name || "there",
          setupFee,
          pilotCode: pilotCode || null,
        });
      } catch (emailError) {
        // Don't fail workspace creation if email fails
        console.error("Error sending welcome email:", emailError);
      }
    }

    return Response.json(
      {
        workspace: {
          id: workspace.id,
          name: workspace.name,
          retentionYears: workspace.retentionYears,
          billingStatus: workspace.billingStatus,
          pilotStartDate: workspace.pilotStartDate,
        },
        setupFee,
        message: setupFee === 0 
          ? "Pilot workspace created successfully! Check your email for onboarding instructions." 
          : "Pilot workspace created! Please complete payment of $500 to activate your 60-day free period. Check your email for next steps.",
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: error.errors }, { status: 400 });
    }
    console.error("Error creating workspace:", error);
    return Response.json(
      { error: "Failed to create workspace" },
      { status: 500 }
    );
  }
}

