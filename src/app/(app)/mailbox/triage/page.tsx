import { requireAppAccess } from "~/server/auth/guards";
import { redirect } from "next/navigation";
import { TriageClient } from "./triage-client";

export default async function TriagePage() {
  const access = await requireAppAccess();
  if (!access.ok) {
    if (access.status === 401) redirect("/auth/signin");
    return <div className="p-6 text-destructive">{access.error}</div>;
  }
  return <TriageClient />;
}
