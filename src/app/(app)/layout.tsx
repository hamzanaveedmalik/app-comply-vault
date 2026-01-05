import { auth } from "~/server/auth";
import { redirect } from "next/navigation";
import { Sidebar } from "~/components/sidebar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/api/auth/signin");
  }

  // Note: Workspace check is handled in middleware
  // This layout only checks authentication
  // The workspace creation page is allowed to render without a workspace

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar
        userEmail={session.user.email}
        userName={session.user.name}
      />
      {/* Main content with left padding for desktop sidebar and top padding for mobile */}
      <main className="lg:pl-64 pt-16 lg:pt-0">
        {children}
      </main>
    </div>
  );
}

