import { auth } from "~/server/auth";
import { redirect } from "next/navigation";
import { db } from "~/server/db";

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

  const membership = await db.userWorkspace.findUnique({
    where: {
      userId_workspaceId: {
        userId: session.user.id,
        workspaceId,
      },
    },
  });

  if (membership?.role !== "OWNER_CCO") {
    redirect("/dashboard");
  }

  return <>{children}</>;
}
