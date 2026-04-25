/**
 * Microsoft Teams app-level token (client credentials)
 * Used for CallRecords.Read.All — required for fetching call records (application permission only)
 */

const AZURE_AUTH_BASE = "https://login.microsoftonline.com";
const GRAPH_BASE = "https://graph.microsoft.com/v1.0";
const CALL_RECORDS_SCOPE = "https://graph.microsoft.com/.default";

let cachedToken: { token: string; expiresAt: number } | null = null;

function getTeamsConfig() {
  const clientId = process.env.TEAMS_CLIENT_ID;
  const clientSecret = process.env.TEAMS_CLIENT_SECRET;
  const tenantId = process.env.TEAMS_TENANT_ID ?? "common";
  if (!clientId || !clientSecret) {
    throw new Error("TEAMS_CLIENT_ID and TEAMS_CLIENT_SECRET must be set for call record access");
  }
  return { clientId, clientSecret, tenantId };
}

/**
 * Get app-level access token for Microsoft Graph (CallRecords.Read.All)
 * Requires Azure AD app registration with client credentials and CallRecords.Read.All (application)
 */
export async function getTeamsAppToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 60_000) {
    return cachedToken.token;
  }

  const { clientId, clientSecret, tenantId } = getTeamsConfig();
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: CALL_RECORDS_SCOPE,
    grant_type: "client_credentials",
  }).toString();

  const res = await fetch(`${AZURE_AUTH_BASE}/${tenantId}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Teams app token failed: ${res.status} ${err}`);
  }

  const data = (await res.json()) as { access_token: string; expires_in?: number };
  const expiresIn = (data.expires_in ?? 3600) * 1000;
  cachedToken = {
    token: data.access_token,
    expiresAt: now + expiresIn,
  };
  return cachedToken.token;
}

export async function fetchCallRecord(callRecordId: string): Promise<{
  id: string;
  organizerId: string;
  endDateTime: string;
  startDateTime: string;
} | null> {
  const token = await getTeamsAppToken();
  const url = `${GRAPH_BASE}/communications/callRecords/${encodeURIComponent(callRecordId)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    if (res.status === 404) return null;
    const err = await res.text();
    throw new Error(`Call record fetch failed: ${res.status} ${err}`);
  }

  const data = (await res.json()) as {
    id?: string;
    startDateTime?: string;
    endDateTime?: string;
    organizer_v2?: { id?: string; identity?: { user?: { id?: string } } };
  };

  const organizerId =
    data.organizer_v2?.identity?.user?.id ?? data.organizer_v2?.id ?? "";
  if (!organizerId) return null;

  return {
    id: data.id ?? callRecordId,
    organizerId,
    startDateTime: data.startDateTime ?? new Date().toISOString(),
    endDateTime: data.endDateTime ?? new Date().toISOString(),
  };
}
