import { verifyInvitationToken } from "~/server/invitations/verify-invitation";

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token) {
    return Response.json(
      { valid: false, errorType: "invalid", message: "Token is required" },
      { status: 400 },
    );
  }

  const result = await verifyInvitationToken(token);

  if (!result.valid) {
    const status =
      result.errorType === "invalid"
        ? 404
        : result.errorType === "error"
          ? 500
          : 400;
    return Response.json(result, { status });
  }

  return Response.json(result);
}
