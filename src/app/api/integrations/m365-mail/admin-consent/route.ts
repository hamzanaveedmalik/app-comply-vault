/**
 * GET /api/integrations/m365-mail/admin-consent — tenant admin consent
 */

import { requireAppAccess } from "~/server/auth/guards";
import { getM365AdminConsentUrl } from "~/server/mailbox/m365-auth";
import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";

const ADMIN_STATE_COOKIE = "m365_mail_admin_state";

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
  const url = getM365AdminConsentUrl(state);
  const response = NextResponse.redirect(url);
  response.cookies.set(ADMIN_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return response;
}

export { ADMIN_STATE_COOKIE };
