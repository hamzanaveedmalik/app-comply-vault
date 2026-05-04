/**
 * GET /api/integrations/zoho-crm/connect — Epic 3.0
 */

import { requireAppAccess } from "~/server/auth/guards";
import { getZohoCrmAuthorizeUrl } from "~/server/integrations/adapters/zoho-crm";
import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";

const STATE_COOKIE = "zoho_crm_oauth_state";
const STATE_MAX_AGE = 600;

export async function GET(): Promise<Response> {
  const access = await requireAppAccess();
  if (!access.ok) {
    return NextResponse.redirect(
      new URL("/auth/signin", process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000")
    );
  }
  if (access.session.user.role !== "OWNER_CCO") {
    return new NextResponse("Only workspace owners can connect integrations", { status: 403 });
  }

  const state = randomBytes(32).toString("hex");
  const url = getZohoCrmAuthorizeUrl(state);
  const response = NextResponse.redirect(url);
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: STATE_MAX_AGE,
    path: "/",
  });
  return response;
}
