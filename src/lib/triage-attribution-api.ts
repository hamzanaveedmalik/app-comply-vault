import type { ClientListItemDto } from "~/lib/types/clients";

type ClientsResponse =
  | { success: true; data: ClientListItemDto[] }
  | { success: false; error?: string };

type AttributionResponse = { success: boolean; error?: string };

export async function fetchWorkspaceClients(
  workspaceId: string,
): Promise<ClientsResponse> {
  const res = await fetch(`/api/workspaces/${workspaceId}/clients`);
  const json = (await res.json()) as ClientsResponse;
  if (!res.ok || !json.success) {
    return {
      success: false,
      error: "error" in json && json.error ? json.error : "Failed to load clients",
    };
  }
  return json;
}

export async function attributeMeetingToClient(
  meetingId: string,
  clientId: string,
): Promise<AttributionResponse> {
  const res = await fetch(`/api/meetings/attribution/${meetingId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientId }),
  });
  return (await res.json()) as AttributionResponse;
}

/** Map client rows to select options for attribution dialogs. */
export function clientSelectOptions(
  clients: ClientListItemDto[],
): Array<{ value: string; label: string }> {
  return clients.map((c) => ({ value: c.id, label: c.name }));
}
