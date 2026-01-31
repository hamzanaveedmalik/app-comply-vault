import { db } from "~/server/db";
import { z } from "zod";
import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const requestTrialSchema = z.object({
  email: z.string().email("Invalid email address"),
  name: z.string().min(1, "Name is required").max(200).optional(),
  company: z.string().max(200).optional(),
  source: z.enum(["complyvault.co", "complyvault.co/uk"]).optional(),
});

/**
 * Simple in-memory rate limiting (in production, use Redis or similar)
 * Key: IP address, Value: { count: number, resetAt: Date }
 */
const rateLimitStore = new Map<string, { count: number; resetAt: Date }>();

function checkRateLimit(ipAddress: string | null): { allowed: boolean; resetAt?: Date } {
  if (!ipAddress) {
    // If no IP, allow but log warning
    return { allowed: true };
  }

  const now = new Date();
  const record = rateLimitStore.get(ipAddress);

  // Clean up expired records
  if (record && record.resetAt < now) {
    rateLimitStore.delete(ipAddress);
  }

  const current = rateLimitStore.get(ipAddress);

  if (!current) {
    // First request from this IP
    const resetAt = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour
    rateLimitStore.set(ipAddress, { count: 1, resetAt });
    return { allowed: true, resetAt };
  }

  // Check limit: 5 requests per hour per IP
  const MAX_REQUESTS_PER_HOUR = 5;
  if (current.count >= MAX_REQUESTS_PER_HOUR) {
    return { allowed: false, resetAt: current.resetAt };
  }

  // Increment count
  current.count++;
  rateLimitStore.set(ipAddress, current);
  return { allowed: true, resetAt: current.resetAt };
}

/**
 * Send trial request notification email to internal team
 */
async function sendTrialRequestNotification({
  email,
  name,
  company,
  source,
}: {
  email: string;
  name?: string;
  company?: string;
  source?: string;
}) {
  const notificationEmail = process.env.TRIAL_NOTIFICATION_EMAIL || "support@complyvault.com";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.complyvault.co";

  const emailContent = {
    from: process.env.EMAIL_FROM || "noreply@complyvault.co",
    to: notificationEmail,
    subject: `New Free Trial Request: ${email}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; line-height: 1.6;">
        <h2>New Free Trial Request</h2>
        <div style="background-color: #f3f4f6; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>Email:</strong> ${email}</p>
          ${name ? `<p style="margin: 5px 0;"><strong>Name:</strong> ${name}</p>` : ""}
          ${company ? `<p style="margin: 5px 0;"><strong>Company:</strong> ${company}</p>` : ""}
          ${source ? `<p style="margin: 5px 0;"><strong>Source:</strong> ${source}</p>` : ""}
          <p style="margin: 5px 0;"><strong>Requested At:</strong> ${new Date().toISOString()}</p>
        </div>
        <p>This lead has been stored in the database. They will receive a verification email with instructions to sign up at <a href="${appUrl}">${appUrl}</a>.</p>
      </div>
    `,
    text: `
      New Free Trial Request
      
      Email: ${email}
      ${name ? `Name: ${name}` : ""}
      ${company ? `Company: ${company}` : ""}
      ${source ? `Source: ${source}` : ""}
      Requested At: ${new Date().toISOString()}
      
      This lead has been stored in the database. They will receive a verification email with instructions to sign up at ${appUrl}.
    `,
  };

  if (!resend) {
    console.log("📧 [DEV MODE] Trial request notification would be sent:");
    console.log("To:", notificationEmail);
    console.log("Subject:", emailContent.subject);
    return { success: true, id: "dev-mode" };
  }

  try {
    const result = await resend.emails.send(emailContent);
    if (result.error) {
      throw new Error(result.error.message);
    }
    return { success: true, id: result.data?.id || "sent" };
  } catch (error) {
    console.error("Error sending trial request notification:", error);
    // Don't throw - notification failure shouldn't block lead storage
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

/**
 * Send verification email to the lead
 */
async function sendTrialVerificationEmail({
  email,
  name,
}: {
  email: string;
  name?: string;
}) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.complyvault.co";
  const signUpUrl = `${appUrl}/auth/signup`;

  const emailContent = {
    from: process.env.EMAIL_FROM || "noreply@complyvault.co",
    to: email,
    subject: "Start Your Free Trial - Comply Vault",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; line-height: 1.6;">
        <h2>Thank you for your interest, ${name || "there"}!</h2>
        <p>We've received your request for a free trial of Comply Vault.</p>
        <p>To get started, please create your account and set up your workspace:</p>
        <div style="margin: 30px 0;">
          <a href="${signUpUrl}" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px;">
            Create Account & Start Trial
          </a>
        </div>
        <p>Or copy and paste this link into your browser:</p>
        <p style="word-break: break-all; color: #666; font-size: 12px;">${signUpUrl}</p>
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 12px;">
          <p><strong>What's Next?</strong></p>
          <ol style="padding-left: 20px; margin: 10px 0;">
            <li>Create your account at the link above</li>
            <li>Set up your workspace</li>
            <li>Start your 7-day free trial</li>
            <li>Upload your first meeting recording</li>
          </ol>
          <p style="margin-top: 15px;">If you have any questions, reply to this email or contact support@complyvault.com</p>
        </div>
      </div>
    `,
    text: `
      Thank you for your interest, ${name || "there"}!
      
      We've received your request for a free trial of Comply Vault.
      
      To get started, please create your account and set up your workspace:
      ${signUpUrl}
      
      What's Next?
      1. Create your account at the link above
      2. Set up your workspace
      3. Start your 7-day free trial
      4. Upload your first meeting recording
      
      If you have any questions, reply to this email or contact support@complyvault.com
    `,
  };

  if (!resend) {
    console.log("📧 [DEV MODE] Trial verification email would be sent:");
    console.log("To:", email);
    console.log("Subject:", emailContent.subject);
    console.log("Sign Up URL:", signUpUrl);
    return { success: true, id: "dev-mode" };
  }

  try {
    const result = await resend.emails.send(emailContent);
    if (result.error) {
      throw new Error(result.error.message);
    }
    return { success: true, id: result.data?.id || "sent" };
  } catch (error) {
    console.error("Error sending trial verification email:", error);
    // Don't throw - email failure shouldn't block lead storage
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

/**
 * POST /api/trial/request
 * 
 * Public endpoint for marketing domain (complyvault.co) to request a free trial.
 * 
 * This endpoint:
 * - Does NOT create an authenticated session
 * - Stores the lead in the database
 * - Sends verification email to the lead
 * - Sends notification to internal team (email/Slack)
 * - Includes rate limiting and email validation
 */
export async function POST(request: Request) {
  try {
    // Get IP address for rate limiting
    const ipAddress =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip") ??
      null;

    // Check rate limit
    const rateLimit = checkRateLimit(ipAddress);
    if (!rateLimit.allowed) {
      return Response.json(
        {
          error: "Rate limit exceeded",
          message: "Too many requests. Please try again later.",
          resetAt: rateLimit.resetAt?.toISOString(),
        },
        { status: 429 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validated = requestTrialSchema.parse(body);

    // Validate email format (zod already does this, but double-check)
    if (!validated.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(validated.email)) {
      return Response.json(
        { error: "Invalid email address" },
        { status: 400 }
      );
    }

    // Store lead in database (upsert to prevent duplicates)
    await db.lead.upsert({
      where: { email: validated.email },
      create: {
        email: validated.email,
        name: validated.name,
        company: validated.company,
        source: validated.source,
        ipAddress: ipAddress ?? undefined,
      },
      update: {
        // Update if lead already exists (update timestamp, source, etc.)
        name: validated.name ?? undefined,
        company: validated.company ?? undefined,
        source: validated.source ?? undefined,
        ipAddress: ipAddress ?? undefined,
      },
    });

    // Send emails in parallel (don't await - fire and forget for better UX)
    Promise.all([
      sendTrialVerificationEmail({
        email: validated.email,
        name: validated.name,
      }),
      sendTrialRequestNotification({
        email: validated.email,
        name: validated.name,
        company: validated.company,
        source: validated.source,
      }),
    ]).catch((error) => {
      console.error("Error sending trial request emails:", error);
      // Don't throw - email failures shouldn't block the response
    });

    // Return success response
    // IMPORTANT: Do NOT create an authenticated session here
    return Response.json(
      {
        success: true,
        message: "Trial request received. Please check your email for next steps.",
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        {
          error: "Validation failed",
          details: error.errors,
        },
        { status: 400 }
      );
    }

    console.error("Error processing trial request:", error);
    return Response.json(
      {
        error: "Internal server error",
        message: "Failed to process trial request. Please try again later.",
      },
      { status: 500 }
    );
  }
}
