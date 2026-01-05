import { Suspense } from "react";
import AcceptInvitationClient from "./accept-client";

// Force dynamic rendering to prevent static generation
export const dynamic = "force-dynamic";

export default function AcceptInvitationPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gray-50">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900">Loading...</h1>
            <p className="mt-2 text-gray-600">Please wait while we load your invitation.</p>
          </div>
        </div>
      }
    >
      <AcceptInvitationServer searchParams={searchParams} />
    </Suspense>
  );
}

async function AcceptInvitationServer({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  const token = params.token;

  return <AcceptInvitationClient token={token} />;
}
