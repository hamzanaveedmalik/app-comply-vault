import { requireAppAccess } from "~/server/auth/guards";
import { redirect, notFound } from "next/navigation";
import { getClientDetail } from "~/server/clients/queries";
import { isEmailIntelligenceEnabled } from "~/lib/feature-flags";
import { isComplianceActor } from "~/lib/meeting-workflow";
import { ClientDetailClient } from "./client-detail-client";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!isEmailIntelligenceEnabled()) {
    notFound();
  }

  const access = await requireAppAccess();
  if (!access.ok) {
    if (access.status === 401) redirect("/auth/signin");
    return <div className="p-6 text-destructive">{access.error}</div>;
  }

  const { id } = await params;
  const detail = await getClientDetail({
    workspaceId: access.workspaceId,
    clientId: id,
  });
  if (!detail) {
    notFound();
  }

  return (
    <ClientDetailClient
      detail={detail}
      canEdit={isComplianceActor(access.session.user.role)}
    />
  );
}
