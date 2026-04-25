/**
 * GET /api/integrations/sharepoint/connect — Epic 2.1
 */

import { requireAppAccess } from "~/server/auth/guards";
import { getSharePointAuthorizeUrl } from "~/server/integrations/adapters/sharepoint";
import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";

const STATE_COOKIE = "sharepoint_oauth_state";
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
  const url = getSharePointAuthorizeUrl(state);

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
