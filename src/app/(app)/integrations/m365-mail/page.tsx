import { requireAppAccess } from "~/server/auth/guards";
import { redirect } from "next/navigation";
import { M365MailClient } from "./m365-mail-client";

export default async function M365MailPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const access = await requireAppAccess();
  if (!access.ok) {
    if (access.status === 401) redirect("/auth/signin");
    return <div className="p-6 text-destructive">{access.error}</div>;
  }
  if (access.session.user.role !== "OWNER_CCO") {
    return (
      <div className="p-6 text-destructive">
        Only workspace owners can manage mailbox connections.
      </div>
    );
  }

  const params = await searchParams;
  const str = (k: string): string | undefined => {
    const v = params[k];
    return typeof v === "string" ? v : undefined;
  };

  return (
    <M365MailClient
      connected={str("connected") === "1"}
      adminConsent={str("admin_consent") === "1"}
      mailbox={str("mailbox")}
      error={str("error")}
    />
  );
}
