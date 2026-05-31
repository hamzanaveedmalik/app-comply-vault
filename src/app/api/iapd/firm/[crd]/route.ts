import { auth } from "~/server/auth";
import { lookupFirmByCrd } from "~/server/iapd/lookup-firm-by-crd";
import { lookupFirmByCrdSecApi } from "~/server/iapd/lookup-firm-by-crd-sec-api";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ crd: string }> },
): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { crd } = await params;
  const normalized = crd.trim();
  if (!/^\d{4,7}$/.test(normalized)) {
    return Response.json({ error: "Invalid CRD number" }, { status: 400 });
  }

  try {
    let firm = await lookupFirmByCrdSecApi(normalized);
    if (!firm) {
      firm = await lookupFirmByCrd(normalized);
    }

    return Response.json({ success: true, data: firm });
  } catch {
    return Response.json({ error: "Could not look up firm in IAPD" }, { status: 502 });
  }
}
