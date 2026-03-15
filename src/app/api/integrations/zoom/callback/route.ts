/**
 * GET /api/integrations/zoom/callback
 * Epic 1 Story 1.1: Zoom OAuth callback — exchange code, store tokens, redirect to integrations
 */

import { requireAppAccess } from "~/server/auth/guards";
import { zoomAdapter } from "~/server/integrations/adapters/zoom";
import { NextRequest, NextResponse } from "next/server";

const STATE_COOKIE = "zoom_oauth_state";

function redirectToIntegrations(baseUrl: string, params?: Record<string, string>) {
  const url = new URL("/integrations", baseUrl);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
  }
  const response = NextResponse.redirect(url);
  response.cookies.delete(STATE_COOKIE);
  return response;
}

export async function GET(request: NextRequest) {
  const requestUrl = request.nextUrl ?? new URL(request.url);
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? requestUrl.origin).replace(/\/$/, "");

  try {
    const access = await requireAppAccess();
    if (!access.ok) {
      return NextResponse.redirect(new URL("/auth/signin", baseUrl));
    }

    if (access.session.user.role !== "OWNER_CCO") {
      return redirectToIntegrations(baseUrl, {
        zoom_error: "forbidden",
        zoom_error_description: "Only workspace owners can connect integrations.",
      });
    }

    const { searchParams } = requestUrl;
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    const storedState = request.cookies.get(STATE_COOKIE)?.value;

    if (error) {
      return redirectToIntegrations(baseUrl, {
        zoom_error: error,
        zoom_error_description: searchParams.get("error_description") ?? "",
      });
    }

    if (!code || !state || state !== storedState) {
      return redirectToIntegrations(baseUrl, {
        zoom_error: "invalid_callback",
        zoom_error_description: "Invalid or expired connection request. Please try again.",
      });
    }

    const redirectUri = `${baseUrl}/api/integrations/zoom/callback`;

    const result = await zoomAdapter.connect({
      workspaceId: access.workspaceId,
      userId: access.session.user.id,
      authCode: code,
      redirectUri,
    });

    if (!result.success) {
      return redirectToIntegrations(baseUrl, {
        zoom_error: result.error ?? "connection_failed",
      });
    }

    const params: Record<string, string> = { zoom_connected: "1" };
    if (result.accountDisplayName) {
      params.zoom_email = result.accountDisplayName;
    }
    return redirectToIntegrations(baseUrl, params);
  } catch (err) {
    console.error("[Zoom callback] Error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return redirectToIntegrations(baseUrl, {
      zoom_error: "connection_failed",
      zoom_error_description: message.slice(0, 200),
    });
  }
}
