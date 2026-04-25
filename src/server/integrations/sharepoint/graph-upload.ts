/**
 * Microsoft Graph — upload files to a drive under a path (creates intermediate folders)
 */

const GRAPH = "https://graph.microsoft.com/v1.0";
const SIMPLE_UPLOAD_MAX_BYTES = 3 * 1024 * 1024; // stay under 4 MB Graph simple upload limit
const CHUNK_SIZE = 8 * 1024 * 1024; // 8 MB

function encodeGraphItemPath(path: string): string {
  return path
    .split("/")
    .map((p) => encodeURIComponent(p))
    .join("/");
}

type GraphDriveItem = {
  id: string;
  webUrl?: string;
  name?: string;
};

async function simpleUpload(
  accessToken: string,
  driveId: string,
  itemPath: string,
  content: Buffer
): Promise<GraphDriveItem> {
  const enc = encodeGraphItemPath(itemPath);
  const url = `${GRAPH}/drives/${encodeURIComponent(driveId)}/root:/${enc}:/content`;
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/octet-stream",
    },
    body: new Uint8Array(content),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Graph simple upload failed: ${res.status} ${err}`);
  }
  return (await res.json()) as GraphDriveItem;
}

async function resumableUpload(
  accessToken: string,
  driveId: string,
  itemPath: string,
  content: Buffer
): Promise<GraphDriveItem> {
  const enc = encodeGraphItemPath(itemPath);
  const sessionUrl = `${GRAPH}/drives/${encodeURIComponent(driveId)}/root:/${enc}:/createUploadSession`;
  const start = await fetch(sessionUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      item: { "@microsoft.graph.conflictBehavior": "replace" },
    }),
  });
  if (!start.ok) {
    const err = await start.text();
    throw new Error(`Graph createUploadSession failed: ${start.status} ${err}`);
  }
  const session = (await start.json()) as { uploadUrl?: string };
  if (!session.uploadUrl) {
    throw new Error("Graph createUploadSession missing uploadUrl");
  }
  const uploadUrl = session.uploadUrl;
  const size = content.length;
  let offset = 0;
  while (offset < size) {
    const end = Math.min(offset + CHUNK_SIZE, size);
    const chunk = content.subarray(offset, end);
    const res = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Length": String(chunk.length),
        "Content-Range": `bytes ${offset}-${end - 1}/${size}`,
      },
      body: new Uint8Array(chunk),
    });
    if (res.status === 200 || res.status === 201) {
      return (await res.json()) as GraphDriveItem;
    }
    if (res.status === 202) {
      offset = end;
      continue;
    }
    const err = await res.text();
    throw new Error(`Graph chunk upload failed: ${res.status} ${err}`);
  }
  throw new Error("Graph resumable upload completed without final item");
}

export type UploadItemResult = { webUrl: string; itemId: string };

/**
 * Upload a file so the path is root-relative (e.g. `ComplyVault/AuditPacks/2026/04/pack.zip`)
 */
export async function uploadDriveItem(
  accessToken: string,
  driveId: string,
  itemPath: string,
  content: Buffer
): Promise<UploadItemResult> {
  const item: GraphDriveItem =
    content.length < SIMPLE_UPLOAD_MAX_BYTES
      ? await simpleUpload(accessToken, driveId, itemPath, content)
      : await resumableUpload(accessToken, driveId, itemPath, content);
  if (!item.id) {
    throw new Error("Graph upload response missing id");
  }
  return { webUrl: item.webUrl ?? "", itemId: item.id };
}
