/**
 * Zoho CRM activity orchestrator
 *
 * Reads Open Tasks + Upcoming Meetings (Events) for the connected Zoho org
 * and returns DTOs ready for the /integrations/zoho server page.
 *
 * - Resolves a valid access token via `getValidZohoCrmContext`
 * - Filters by current user email (Owner.email) when `scope === "mine"`
 * - Maps `ZohoScopeError` -> `reconnectRequired: true` so the UI can prompt
 *   the workspace owner to disconnect+reconnect for the newly-added scopes
 * - Never logs the access token, contact, or task content (PII)
 */

import { getValidZohoCrmContext } from "./crm-token";
import {
  listOpenTasks,
  listUpcomingMeetings,
  ZohoScopeError,
  type ZohoMeetingDto,
  type ZohoTaskDto,
} from "./crm-api";

export type ZohoActivityScope = "mine" | "all";

export type ZohoActivityResult =
  | {
      state: "not_connected";
    }
  | {
      state: "reconnect_required";
      missingScopes: string[];
    }
  | {
      state: "error";
      message: string;
    }
  | {
      state: "ok";
      scope: ZohoActivityScope;
      tasks: ZohoTaskDto[];
      meetings: ZohoMeetingDto[];
      fetchedAtIso: string;
      filterEmail: string | null;
    };

const TASKS_SCOPE = "ZohoCRM.modules.tasks.READ";
const EVENTS_SCOPE = "ZohoCRM.modules.events.READ";

export async function loadZohoActivity(args: {
  workspaceId: string;
  scope: ZohoActivityScope;
  currentUserEmail: string | null;
  limit?: number;
}): Promise<ZohoActivityResult> {
  const { workspaceId, scope, currentUserEmail } = args;
  const limit = args.limit ?? 25;

  const ctx = await getValidZohoCrmContext(workspaceId);
  if (!ctx) {
    return { state: "not_connected" };
  }

  const ownerEmail =
    scope === "mine" && currentUserEmail ? currentUserEmail : undefined;

  try {
    const [tasks, meetings] = await Promise.all([
      listOpenTasks({
        apiDomain: ctx.apiDomain,
        accessToken: ctx.accessToken,
        ownerEmail,
        limit,
      }),
      listUpcomingMeetings({
        apiDomain: ctx.apiDomain,
        accessToken: ctx.accessToken,
        ownerEmail,
        limit,
      }),
    ]);

    return {
      state: "ok",
      scope,
      tasks,
      meetings,
      fetchedAtIso: new Date().toISOString(),
      filterEmail: ownerEmail ?? null,
    };
  } catch (err) {
    if (err instanceof ZohoScopeError) {
      const missing: string[] = [];
      if (err.module === "Tasks") missing.push(TASKS_SCOPE);
      if (err.module === "Events") missing.push(EVENTS_SCOPE);
      return {
        state: "reconnect_required",
        missingScopes: missing.length > 0 ? missing : [TASKS_SCOPE, EVENTS_SCOPE],
      };
    }
    const message = err instanceof Error ? err.message : "Failed to load Zoho activity";
    return { state: "error", message };
  }
}
