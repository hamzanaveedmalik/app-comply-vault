/**
 * Zoho CRM REST v2 — COQL search + Notes on Contacts + Tasks / Events reads
 */

function escapeCoqlString(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/'/g, "''");
}

/**
 * Thrown when the access token lacks the scope a CRM endpoint requires —
 * typically because the workspace connected before the scope was added to
 * the adapter. UI should prompt the user to reconnect.
 */
export class ZohoScopeError extends Error {
  constructor(public readonly module: string, public readonly code: string) {
    super(`Zoho ${module}: missing scope (${code})`);
    this.name = "ZohoScopeError";
  }
}

const SCOPE_ERROR_CODES = new Set([
  "OAUTH_SCOPE_MISMATCH",
  "INVALID_TOKEN",
  "INVALID_OAUTHTOKEN",
  "AUTHENTICATION_FAILURE",
]);

/**
 * Find a single Contact id by exact Full_Name match, or null if 0 / many.
 */
export async function findContactIdByFullName(args: {
  apiDomain: string;
  accessToken: string;
  fullName: string;
}): Promise<{ contactId: string } | { error: "none" | "ambiguous" }> {
  const { apiDomain, accessToken, fullName } = args;
  const q = `select id, Full_Name from Contacts where Full_Name = '${escapeCoqlString(fullName)}' limit 5`;
  const res = await fetch(`${apiDomain}/crm/v2/coql`, {
    method: "POST",
    headers: {
      Authorization: `Zoho-oauthtoken ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ select_query: q }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Zoho COQL failed: ${res.status} ${t}`);
  }
  const data = (await res.json()) as {
    data?: Array<{ id: string; Full_Name?: string }>;
  };
  const rows = data.data ?? [];
  if (rows.length === 0) {
    return { error: "none" };
  }
  if (rows.length > 1) {
    return { error: "ambiguous" };
  }
  return { contactId: rows[0]!.id };
}

export async function createContactNote(args: {
  apiDomain: string;
  accessToken: string;
  contactId: string;
  title: string;
  content: string;
}): Promise<string> {
  const { apiDomain, accessToken, contactId, title, content } = args;
  const url = `${apiDomain}/crm/v2/Contacts/${encodeURIComponent(contactId)}/Notes`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Zoho-oauthtoken ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      data: [
        {
          Note_Title: title,
          Note_Content: content,
        },
      ],
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Zoho create Note failed: ${res.status} ${t}`);
  }
  const out = (await res.json()) as {
    data?: Array<{
      code?: string;
      message?: string;
      details?: { id?: string };
    }>;
  };
  const row = out.data?.[0];
  const id = row?.details?.id;
  if (row?.code && row.code !== "SUCCESS" && !id) {
    throw new Error(row.message ?? row.code);
  }
  if (!id) {
    throw new Error("Zoho create Note: missing id in response");
  }
  return id;
}

export type ZohoTaskDto = {
  id: string;
  subject: string;
  dueDate: string | null;
  status: string;
  priority: string | null;
  ownerEmail: string | null;
  ownerName: string | null;
};

export type ZohoMeetingDto = {
  id: string;
  title: string;
  startIso: string | null;
  endIso: string | null;
  venue: string | null;
  ownerEmail: string | null;
  ownerName: string | null;
};

type ZohoOwnerField = { id?: string; name?: string; email?: string };

type ZohoTaskRecord = {
  id: string;
  Subject?: string;
  Due_Date?: string | null;
  Status?: string;
  Priority?: string | null;
  Owner?: ZohoOwnerField;
};

type ZohoEventRecord = {
  id: string;
  Event_Title?: string;
  Start_DateTime?: string | null;
  End_DateTime?: string | null;
  Venue?: string | null;
  Owner?: ZohoOwnerField;
};

type ZohoErrorPayload = {
  code?: string;
  message?: string;
  details?: Record<string, unknown>;
};

async function readZohoListResponse<TRecord>(
  res: Response,
  module: string
): Promise<TRecord[]> {
  if (res.status === 204) return [];
  if (res.status === 401 || res.status === 403) {
    let code = "UNAUTHORIZED";
    try {
      const j = (await res.clone().json()) as ZohoErrorPayload;
      if (j.code) code = j.code;
    } catch {}
    if (SCOPE_ERROR_CODES.has(code)) {
      throw new ZohoScopeError(module, code);
    }
    throw new Error(`Zoho ${module} list failed: ${res.status} ${code}`);
  }
  if (!res.ok) {
    let code = String(res.status);
    try {
      const j = (await res.clone().json()) as ZohoErrorPayload;
      if (j.code) code = j.code;
    } catch {}
    if (SCOPE_ERROR_CODES.has(code)) {
      throw new ZohoScopeError(module, code);
    }
    throw new Error(`Zoho ${module} list failed: ${res.status} ${code}`);
  }
  const data = (await res.json()) as { data?: TRecord[] };
  return data.data ?? [];
}

function mapOwner(owner: ZohoOwnerField | undefined): {
  ownerEmail: string | null;
  ownerName: string | null;
} {
  return {
    ownerEmail: owner?.email ?? null,
    ownerName: owner?.name ?? null,
  };
}

function toYmd(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const QUERY_FALLBACK_CODES = new Set([
  "INVALID_QUERY",
  "INVALID_DATA",
  "INVALID_REQUEST",
  "INVALID_MODULE",
]);

/**
 * Internal helper: GET a Zoho list URL.
 *
 * Returns:
 *   - `TRecord[]` on success (incl. 204 -> []).
 *   - The literal "fallback" sentinel on 400 / `INVALID_QUERY`-like codes so the
 *     caller can retry with a simpler request shape.
 *
 * Throws:
 *   - `ZohoScopeError` on 401/403 with an OAuth-scope-style code.
 *   - Generic `Error` on any other non-OK response.
 */
async function fetchListOrFallback<TRecord>(
  module: string,
  url: string,
  accessToken: string
): Promise<TRecord[] | "fallback"> {
  const res = await fetch(url, {
    headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
    cache: "no-store",
  });
  if (res.status === 204) return [];
  if (res.status === 401 || res.status === 403) {
    return readZohoListResponse<TRecord>(res, module);
  }
  if (res.status === 400) {
    let code = "BAD_REQUEST";
    try {
      const j = (await res.clone().json()) as ZohoErrorPayload;
      if (j.code) code = j.code;
    } catch {}
    if (QUERY_FALLBACK_CODES.has(code)) {
      return "fallback";
    }
    throw new Error(`Zoho ${module} list failed: 400 ${code}`);
  }
  if (!res.ok) {
    throw new Error(`Zoho ${module} list failed: ${res.status}`);
  }
  const data = (await res.json()) as { data?: TRecord[] };
  return data.data ?? [];
}

/**
 * List the open Tasks on the connected Zoho CRM org, ordered by due date.
 * Filters `Status != Completed` and (optionally) `Owner.email` **client-side**
 * because the Zoho `/Tasks/search` endpoint rejects datetime/enum criteria
 * with 400 INVALID_QUERY on some org configurations. Mirrors Zoho Home's
 * "My Open Tasks" widget when `ownerEmail` is supplied.
 */
export async function listOpenTasks(args: {
  apiDomain: string;
  accessToken: string;
  ownerEmail?: string;
  limit?: number;
}): Promise<ZohoTaskDto[]> {
  const { apiDomain, accessToken, ownerEmail } = args;
  const limit = Math.min(Math.max(args.limit ?? 25, 1), 200);
  const fetchPerPage = Math.min(200, Math.max(limit * 4, 50));

  const params = new URLSearchParams({
    fields: "Subject,Due_Date,Status,Priority,Owner",
    sort_by: "Due_Date",
    sort_order: "asc",
    per_page: String(fetchPerPage),
  });

  const url = `${apiDomain}/crm/v2/Tasks?${params.toString()}`;
  const result = await fetchListOrFallback<ZohoTaskRecord>("Tasks", url, accessToken);
  const rows = result === "fallback" ? [] : result;

  const ownerEmailLc = ownerEmail?.toLowerCase();

  return rows
    .filter((r) => (r.Status ?? "").toLowerCase() !== "completed")
    .filter((r) => {
      if (!ownerEmailLc) return true;
      return (r.Owner?.email ?? "").toLowerCase() === ownerEmailLc;
    })
    .slice(0, limit)
    .map((r) => ({
      id: r.id,
      subject: r.Subject ?? "(no subject)",
      dueDate: r.Due_Date ?? null,
      status: r.Status ?? "Not Started",
      priority: r.Priority ?? null,
      ...mapOwner(r.Owner),
    }));
}

/**
 * List upcoming Zoho CRM Events (= "Meetings" in the UI) starting from
 * `fromIso` (defaults to now), ordered by start time. When `ownerEmail`
 * is supplied, restricts to that Zoho user's meetings (filtered client-side
 * because the plain Events list endpoint doesn't accept Owner.email criteria).
 *
 * Strategy (the search endpoint's datetime `criteria` filter is brittle on
 * some Zoho org configurations and returns 400 INVALID_QUERY):
 *   1. Primary: `GET /crm/v2/Events?from_date=YYYY-MM-DD&to_date=YYYY-MM-DD&…`
 *   2. Fallback (on 400 INVALID_QUERY): plain `GET /crm/v2/Events?…` with no
 *      date params; client-side filter to start times >= `from`.
 */
export async function listUpcomingMeetings(args: {
  apiDomain: string;
  accessToken: string;
  ownerEmail?: string;
  fromIso?: string;
  limit?: number;
}): Promise<ZohoMeetingDto[]> {
  const { apiDomain, accessToken, ownerEmail } = args;
  const limit = Math.min(Math.max(args.limit ?? 25, 1), 200);
  const from = args.fromIso ? new Date(args.fromIso) : new Date();
  const fromMs = from.getTime();
  const to = new Date(fromMs + 30 * 24 * 60 * 60 * 1000);

  const baseParams = new URLSearchParams({
    fields: "Event_Title,Start_DateTime,End_DateTime,Venue,Owner",
    sort_by: "Start_DateTime",
    sort_order: "asc",
    per_page: String(limit),
  });

  const primaryParams = new URLSearchParams(baseParams);
  primaryParams.set("from_date", toYmd(from));
  primaryParams.set("to_date", toYmd(to));

  const primaryUrl = `${apiDomain}/crm/v2/Events?${primaryParams.toString()}`;
  const fallbackUrl = `${apiDomain}/crm/v2/Events?${baseParams.toString()}`;

  let rows = await fetchListOrFallback<ZohoEventRecord>("Events", primaryUrl, accessToken);
  if (rows === "fallback") {
    const second = await fetchListOrFallback<ZohoEventRecord>("Events", fallbackUrl, accessToken);
    rows = second === "fallback" ? [] : second;
  }

  const ownerEmailLc = ownerEmail?.toLowerCase();

  return rows
    .filter((r) => {
      if (!ownerEmailLc) return true;
      return (r.Owner?.email ?? "").toLowerCase() === ownerEmailLc;
    })
    .filter((r) => {
      if (!r.Start_DateTime) return true;
      const t = new Date(r.Start_DateTime).getTime();
      return Number.isNaN(t) ? true : t >= fromMs;
    })
    .map((r) => ({
      id: r.id,
      title: r.Event_Title ?? "(untitled)",
      startIso: r.Start_DateTime ?? null,
      endIso: r.End_DateTime ?? null,
      venue: r.Venue ?? null,
      ...mapOwner(r.Owner),
    }));
}
