/**
 * Zoho CRM REST v2 — COQL search + Notes on Contacts
 */

function escapeCoqlString(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/'/g, "''");
}

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
