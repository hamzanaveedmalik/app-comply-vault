import { Client } from "@upstash/qstash";
import { env } from "~/env";

// Initialize QStash client (lazy initialization to avoid errors if token is missing)
function getQStashClient() {
  if (!env.QSTASH_TOKEN) {
    throw new Error("QSTASH_TOKEN environment variable is not set");
  }
  return new Client({
    token: env.QSTASH_TOKEN,
  });
}

/**
 * Publish a job to process a meeting
 */
export async function publishProcessMeetingJob({
  meetingId,
  workspaceId,
  fileUrl,
}: {
  meetingId: string;
  workspaceId: string;
  fileUrl: string;
}) {
  // Validate QStash token
  if (!env.QSTASH_TOKEN) {
    throw new Error("QSTASH_TOKEN is not configured. Please set it in your environment variables.");
  }

  // Get webhook URL - must be publicly accessible
  const baseUrl = env.NEXT_PUBLIC_APP_URL;
  if (!baseUrl) {
    throw new Error("NEXT_PUBLIC_APP_URL is not set. QStash needs a public URL to send webhooks.");
  }

  const webhookUrl = `${baseUrl}/api/jobs/process-meeting`;
  
  // Validate webhook URL is not localhost (QStash can't reach localhost)
  if (webhookUrl.includes("localhost") || webhookUrl.includes("127.0.0.1")) {
    throw new Error(
      `QStash cannot reach localhost URLs. Set NEXT_PUBLIC_APP_URL to your Vercel deployment URL (e.g., https://intelli-vault.vercel.app)`
    );
  }

  const payload = {
    meetingId,
    workspaceId,
    fileUrl,
  };

  console.log(`📤 Publishing QStash job:`, {
    meetingId,
    webhookUrl,
    payload: { meetingId, workspaceId, fileUrl: fileUrl.substring(0, 50) + "..." },
  });

  // Publish job to QStash
  try {
    const qstash = getQStashClient();
    const messageId = await qstash.publishJSON({
      url: webhookUrl,
      body: payload,
      // Retry configuration
      retries: 3,
      // Delay before first retry (exponential backoff)
      delay: 5,
    });

    console.log(`✅ QStash job published successfully!`, {
      messageId,
      meetingId,
      webhookUrl,
    });
    return messageId;
  } catch (error) {
    console.error("❌ QStash publish error:", error);
    if (error instanceof Error) {
      console.error("Error details:", {
        message: error.message,
        stack: error.stack,
      });
    }
    throw error;
  }
}


