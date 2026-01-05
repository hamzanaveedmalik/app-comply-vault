import Link from "next/link";
import { auth } from "~/server/auth";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const session = await auth();

  // If authenticated, redirect to dashboard or workspace creation
  if (session?.user) {
    if (session.user.workspaceId) {
      redirect("/dashboard");
    } else {
      redirect("/workspaces/new");
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[#2e026d] to-[#15162c] text-white">
      <div className="container flex flex-col items-center justify-center gap-12 px-4 py-16">
        <h1 className="text-5xl font-extrabold tracking-tight text-white sm:text-[5rem]">
          Comply <span className="text-[hsl(280,100%,70%)]">Vault</span>
        </h1>
        <p className="text-xl text-gray-300">
          Exam-ready client interaction records in &lt;10 minutes
        </p>
        <div className="flex gap-4">
          <Link
            href="/api/auth/signin"
            className="rounded-xl bg-white/10 px-6 py-3 text-lg font-semibold text-white hover:bg-white/20"
          >
            Sign In
          </Link>
        </div>
      </div>
    </main>
  );
}
