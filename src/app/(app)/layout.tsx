import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { redirect } from "next/navigation";
import { Sidebar } from "~/components/sidebar";
import { TopBar } from "~/components/top-bar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/auth/signin");
  }

  const workspace =
    session.user.workspaceId && session.user.workspaceId !== ""
      ? await db.workspace.findUnique({
          where: { id: session.user.workspaceId },
          select: { billingStatus: true },
        })
      : null;

  // Note: Workspace check is handled in middleware
  // This layout only checks authentication
  // The workspace creation page is allowed to render without a workspace

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar
        userEmail={session.user.email}
        userName={session.user.name}
        userRole={session.user.role}
      />
      {/* Top bar with global search and user menu */}
      <div className="lg:pl-64">
        <TopBar
          userEmail={session.user.email}
          userName={session.user.name}
          userImage={session.user.image}
          userRole={session.user.role}
          billingStatus={workspace?.billingStatus ?? null}
        />
      </div>
      {/* Main content with left padding for desktop sidebar and top padding for mobile */}
      <main className="lg:pl-64 pt-14">
        {children}
      </main>
    </div>
  );
}

