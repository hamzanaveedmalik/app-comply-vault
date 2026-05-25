import { auth } from "~/server/auth";
import { redirect } from "next/navigation";
import { db } from "~/server/db";
import { activeUserWorkspaceWhere } from "~/lib/user-workspace-filters";

export default async function InviteLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ workspaceId: string }>;
}): Promise<React.ReactElement> {
  const session = await auth();
  const { workspaceId } = await params;

  if (!session?.user) {
    redirect("/auth/signin");
  }

  const membership = await db.userWorkspace.findFirst({
    where: {
      userId: session.user.id,
      workspaceId,
      role: "OWNER_CCO",
      ...activeUserWorkspaceWhere,
    },
  });

  if (!membership) {
    redirect("/dashboard");
  }

  return <>{children}</>;
}
