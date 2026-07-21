/**
 * GET /api/integrations/gmail-mail/connect — delegated Google OAuth
 */

import { requireAppAccess } from "~/server/auth/guards";
import { getGmailAuthorizeUrl } from "~/server/mailbox/gmail-auth";
import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";

const STATE_COOKIE = "gmail_mail_oauth_state";

export async function GET() {
  const access = await requireAppAccess();
  if (!access.ok) {
    return NextResponse.redirect(
      new URL("/auth/signin", process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000")
    );
  }
  if (access.session.user.role !== "OWNER_CCO") {
    return new NextResponse("Only workspace owners can connect mail", { status: 403 });
  }

  const state = randomBytes(32).toString("hex");
  const url = getGmailAuthorizeUrl(state);
  const response = NextResponse.redirect(url);
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return response;
}

export { STATE_COOKIE };
