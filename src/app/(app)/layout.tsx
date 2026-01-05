import { auth } from "~/server/auth";
import { redirect } from "next/navigation";
import { Navigation } from "~/components/navigation";

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
      <Navigation
        userEmail={session.user.email}
        userName={session.user.name}
      />
      <main>{children}</main>
    </div>
  );
}

