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
  const dashboardUrl = `${baseUrl}/dashboard`;

  const roleDescription = role === "OWNER_CCO" 
    ? "Owner/CCO - You can finalize records, manage workspace settings, and invite team members."
    : "Member - You can view and edit meeting records.";

  const emailContent = {
    from: process.env.EMAIL_FROM || "noreply@ria-compliance.com",
    to: email,
    subject: `Invitation to join ${workspaceName} on Comply Vault`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; line-height: 1.6;">
        <h2>You've been invited to join ${workspaceName}</h2>
        <p>You've been invited to join the workspace <strong>${workspaceName}</strong> on Comply Vault.</p>
        
        <div style="background-color: #f3f4f6; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <p style="margin: 0;"><strong>Your Role:</strong> ${role === "OWNER_CCO" ? "Owner/CCO" : "Member"}</p>
          <p style="margin: 5px 0 0 0; font-size: 14px; color: #6b7280;">${roleDescription}</p>
        </div>
        
        <p><strong>What is Comply Vault?</strong></p>
        <p>Comply Vault helps RIA firms create exam-ready client interaction records from meeting recordings. Upload recordings, review extracted compliance data, and export audit packs.</p>
        
        <div style="margin: 30px 0;">
          <a href="${invitationUrl}" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px;">
            Accept Invitation
          </a>
        </div>
        
        <p>Or copy and paste this link into your browser:</p>
        <p style="word-break: break-all; color: #666; font-size: 12px;">${invitationUrl}</p>
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 12px;">
          <p><strong>Next Steps After Accepting:</strong></p>
          <ol style="padding-left: 20px; margin: 10px 0;">
            <li>Review your workspace settings</li>
            <li>Upload your first meeting recording</li>
            <li>Review and finalize meeting records</li>
          </ol>
          <p style="margin-top: 15px;">This invitation will expire in 7 days.</p>
        </div>
      </div>
    `,
    text: `
      You've been invited to join ${workspaceName} on Comply Vault.
      
      Your Role: ${role === "OWNER_CCO" ? "Owner/CCO" : "Member"}
      ${roleDescription}
      
      What is Comply Vault?
      Comply Vault helps RIA firms create exam-ready client interaction records from meeting recordings.
      
      Accept your invitation by visiting:
      ${invitationUrl}
      
      Next Steps After Accepting:
      1. Review your workspace settings
      2. Upload your first meeting recording
      3. Review and finalize meeting records
      
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
 * Send welcome email with onboarding checklist when workspace is provisioned
 */
export async function sendWelcomeEmail({
  email,
  workspaceName,
  userName,
}: {
  email: string;
  workspaceName: string;
  userName: string;
}) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const dashboardUrl = `${baseUrl}/dashboard`;
  const settingsUrl = `${baseUrl}/settings`;
  const uploadUrl = `${baseUrl}/upload`;

  const emailContent = {
    from: process.env.EMAIL_FROM || "noreply@ria-compliance.com",
    to: email,
    subject: `Welcome to Comply Vault - ${workspaceName} Trial`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; line-height: 1.6;">
        <h2>Welcome to Comply Vault, ${userName}!</h2>
        <p>Your trial workspace <strong>${workspaceName}</strong> has been successfully created.</p>
        <div style="background-color: #d1fae5; border-left: 4px solid #10b981; padding: 12px; margin: 20px 0;">
          <p style="margin: 0;"><strong>Trial Active:</strong> Your 7-day free trial has started.</p>
        </div>
        
        <h3 style="margin-top: 30px 0 15px 0;">Onboarding Checklist</h3>
        <p>Get started with these steps:</p>
        <ol style="padding-left: 20px;">
          <li style="margin-bottom: 10px;">
            <strong>Complete Workspace Setup</strong><br>
            <a href="${settingsUrl}" style="color: #2563eb;">Configure retention settings and legal hold</a>
          </li>
          <li style="margin-bottom: 10px;">
            <strong>Invite Team Members</strong><br>
            Add your team members and assign roles (Owner/CCO or Member)
          </li>
          <li style="margin-bottom: 10px;">
            <strong>Upload Your First Meeting</strong><br>
            <a href="${uploadUrl}" style="color: #2563eb;">Upload a meeting recording</a> to see the system in action
          </li>
          <li style="margin-bottom: 10px;">
            <strong>Review and Finalize</strong><br>
            Review the extracted fields, make any edits, and finalize your first record
          </li>
        </ol>
        
        <div style="margin: 30px 0;">
          <a href="${dashboardUrl}" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px;">
            Go to Dashboard
          </a>
        </div>
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 12px;">
          <p><strong>Trial Period:</strong> Your 7-day free trial starts today and includes access to core features.</p>
          <p><strong>Support:</strong> If you need help, reply to this email or contact support@complyvault.com</p>
        </div>
      </div>
    `,
    text: `
      Welcome to Comply Vault, ${userName}!
      
      Your trial workspace ${workspaceName} has been successfully created.
      
      Trial Active: Your 7-day free trial has started.
      
      Onboarding Checklist:
      1. Complete Workspace Setup: ${settingsUrl}
      2. Invite Team Members: Add your team members and assign roles
      3. Upload Your First Meeting: ${uploadUrl}
      4. Review and Finalize: Review the extracted fields and finalize your first record
      
      Go to Dashboard: ${dashboardUrl}
      
      Trial Period: Your 7-day free trial starts today and includes access to core features.
      Support: If you need help, reply to this email or contact support@complyvault.com
    `,
  };

  // In development without Resend API key, log the email instead
  if (!resend) {
    console.log("📧 [DEV MODE] Welcome email would be sent:");
    console.log("To:", email);
    console.log("Subject:", emailContent.subject);
    console.log("Workspace:", workspaceName);
    return { success: true, id: "dev-mode" };
  }

  try {
    const result = await resend.emails.send(emailContent);
    if (result.error) {
      throw new Error(result.error.message);
    }
    return { success: true, id: result.data?.id || "sent" };
  } catch (error) {
    console.error("Error sending welcome email:", error);
    // Don't throw - email failures shouldn't block the workflow
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
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

