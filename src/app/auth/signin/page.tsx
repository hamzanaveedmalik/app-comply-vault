import { auth } from "~/server/auth";
import { redirect } from "next/navigation";
import Image from "next/image";
import { SignInForm } from "./signin-form";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const session = await auth();
  const params = await searchParams;

  // If already authenticated, redirect based on workspace
  if (session?.user) {
    // Check if user has a workspace (workspaceId should be a non-empty string)
    if (session.user.workspaceId && session.user.workspaceId !== "") {
      redirect("/dashboard");
    } else {
      redirect("/workspaces/new");
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[#0A1F14] to-[#0D2818] text-white relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.15) 1px, transparent 0)",
            backgroundSize: "40px 40px",
          }}
        />
      </div>

      {/* Glow Effects */}
      <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-[#117A4B]/20 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-[#117A4B]/10 rounded-full blur-3xl" />

      <div className="container relative flex flex-col items-center justify-center gap-8 px-4 py-16 max-w-md w-full">
        {/* Logo */}
        <div className="w-16 h-16 relative">
          <Image
            src="/logo-white.svg"
            alt="Comply Vault Logo"
            fill
            className="object-contain"
            priority
          />
        </div>

        {/* Sign In Card */}
        <div className="w-full bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8 shadow-2xl">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">
              Welcome to <span className="text-[#22C55E]">Comply Vault</span>
            </h1>
          </div>

          {/* Error Message */}
          {params.error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-red-400 text-sm">
                {params.error === "Configuration"
                  ? "Authentication is not properly configured. Please contact support."
                  : "An error occurred during sign in. Please try again."}
              </p>
            </div>
          )}

          {/* Sign In / Sign Up Form */}
          <SignInForm callbackUrl={params.callbackUrl} />

          {/* Trust Indicators */}
          <div className="mt-8 pt-6 border-t border-white/10">
            <div className="flex flex-wrap gap-4 justify-center text-xs text-gray-400">
              <div className="flex items-center gap-1.5">
                <svg
                  className="w-4 h-4 text-[#22C55E]"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                  />
                </svg>
                <span>Secure</span>
              </div>
              <div className="flex items-center gap-1.5">
                <svg
                  className="w-4 h-4 text-[#22C55E]"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
                <span>Encrypted</span>
              </div>
              <div className="flex items-center gap-1.5">
                <svg
                  className="w-4 h-4 text-[#22C55E]"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                  />
                </svg>
                <span>Compliant</span>
              </div>
            </div>
          </div>
        </div>

        {/* Back to Home */}
        <a
          href="/"
          className="text-gray-400 hover:text-white text-sm transition-colors"
        >
          ← Back to home
        </a>
      </div>
    </main>
  );
}
