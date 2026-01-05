import { Resend } from "resend";

// Initialize Resend client (fallback to mock in development if no API key)
const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

export async function sendInvitationEmail({
  email,
  workspaceName,
  invitationToken,
  role,
}: {
  email: string;
  workspaceName: string;
  invitationToken: string;
  role: "OWNER_CCO" | "MEMBER";
}) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const invitationUrl = `${baseUrl}/invitations/accept?token=${invitationToken}`;

  const emailContent = {
    from: process.env.EMAIL_FROM || "noreply@ria-compliance.com",
    to: email,
    subject: `Invitation to join ${workspaceName} on Comply Vault`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>You've been invited to join ${workspaceName}</h2>
        <p>You've been invited to join the workspace <strong>${workspaceName}</strong> on Comply Vault with the role: <strong>${role === "OWNER_CCO" ? "Owner/CCO" : "Member"}</strong>.</p>
        <p>Click the button below to accept the invitation:</p>
        <a href="${invitationUrl}" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0;">
          Accept Invitation
        </a>
        <p>Or copy and paste this link into your browser:</p>
        <p style="word-break: break-all; color: #666;">${invitationUrl}</p>
        <p style="color: #999; font-size: 12px; margin-top: 30px;">This invitation will expire in 7 days.</p>
      </div>
    `,
    text: `
      You've been invited to join ${workspaceName} on Comply Vault.
      
      Role: ${role === "OWNER_CCO" ? "Owner/CCO" : "Member"}
      
      Accept your invitation by visiting:
      ${invitationUrl}
      
      This invitation will expire in 7 days.
    `,
  };

  // In development without Resend API key, log the email instead
  if (!resend) {
    console.log("📧 [DEV MODE] Invitation email would be sent:");
    console.log("To:", email);
    console.log("Subject:", emailContent.subject);
    console.log("Invitation URL:", invitationUrl);
    return { success: true, id: "dev-mode" };
  }

  try {
    const result = await resend.emails.send(emailContent);
    if (result.error) {
      throw new Error(result.error.message);
    }
    return { success: true, id: result.data?.id || "sent" };
  } catch (error) {
    console.error("Error sending invitation email:", error);
    throw new Error("Failed to send invitation email");
  }
}

/**
 * Send email notification when meeting draft is ready for review
 */
export async function sendDraftReadyEmail({
  email,
  clientName,
  meetingDate,
  meetingId,
}: {
  email: string;
  clientName: string;
  meetingDate: Date;
  meetingId: string;
}) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const meetingUrl = `${baseUrl}/meetings/${meetingId}`;

  const emailContent = {
    from: process.env.EMAIL_FROM || "noreply@ria-compliance.com",
    to: email,
    subject: `Draft Ready for Review: ${clientName} - ${meetingDate.toLocaleDateString()}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Your Meeting Draft is Ready for Review</h2>
        <p>The transcription for your meeting with <strong>${clientName}</strong> on <strong>${meetingDate.toLocaleDateString()}</strong> is complete and ready for your review.</p>
        <p>Click the button below to review and finalize the meeting record:</p>
        <a href="${meetingUrl}" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0;">
          Review Meeting
        </a>
        <p>Or copy and paste this link into your browser:</p>
        <p style="word-break: break-all; color: #666;">${meetingUrl}</p>
        <p style="color: #999; font-size: 12px; margin-top: 30px;">This is an automated notification from Comply Vault.</p>
      </div>
    `,
    text: `
      Your Meeting Draft is Ready for Review
      
      The transcription for your meeting with ${clientName} on ${meetingDate.toLocaleDateString()} is complete and ready for your review.
      
      Review the meeting: ${meetingUrl}
      
      This is an automated notification from Comply Vault.
    `,
  };

  // In development without Resend API key, log the email instead
  if (!resend) {
    console.log("📧 [DEV MODE] Draft ready email would be sent:");
    console.log("To:", email);
    console.log("Subject:", emailContent.subject);
    console.log("Meeting URL:", meetingUrl);
    return { success: true, id: "dev-mode" };
  }

  try {
    const result = await resend.emails.send(emailContent);
    if (result.error) {
      throw new Error(result.error.message);
    }
    return { success: true, id: result.data?.id || "sent" };
  } catch (error) {
    console.error("Error sending draft ready email:", error);
    // Don't throw - email failures shouldn't block the workflow
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

