import { requireAuthAndEmailVerified } from "~/server/auth/guards";
import { db } from "~/server/db";
import { redirect } from "next/navigation";
import { Sidebar } from "~/components/sidebar";
import { TopBar } from "~/components/top-bar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Require authentication and email verification for all app routes
  // Individual pages will enforce workspace membership and entitlements
  const authCheck = await requireAuthAndEmailVerified();
  
  if (!authCheck.ok) {
    if (authCheck.status === 401) {
      redirect("/auth/signin");
    }
    redirect(`/auth/signin?error=${encodeURIComponent(authCheck.error)}`);
  }

  const { session } = authCheck;

  // If user has a workspace, fetch it for the UI
  // If not, they'll be on the workspace creation page
  const workspace =
    session.user.workspaceId && session.user.workspaceId !== ""
      ? await db.workspace.findUnique({
          where: { id: session.user.workspaceId },
          select: { billingStatus: true },
        })
      : null;

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

