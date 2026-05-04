import { db } from "~/server/db";
import { publishZohoCrmNoteJob } from "~/server/qstash";

/**
 * When a meeting reaches DRAFT_READY, push a Zoho note (3.0a) if Zoho CRM is connected.
 */
export async function enqueueZohoCrmNoteIfConnected(
  workspaceId: string,
  meetingId: string
): Promise<void> {
  const cred = await db.integrationCredential.findUnique({
    where: { workspaceId_provider: { workspaceId, provider: "ZOHO_CRM" } },
  });
  if (!cred || cred.status !== "CONNECTED") {
    return;
  }
  void publishZohoCrmNoteJob({ workspaceId, meetingId }).catch((e) => {
    console.error("Zoho CRM note job publish failed:", e);
  });
}
