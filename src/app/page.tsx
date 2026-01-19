import Link from "next/link";
import Image from "next/image";
import { auth } from "~/server/auth";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const session = await auth();

  // If authenticated, redirect to dashboard or workspace creation
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
            backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.15) 1px, transparent 0)',
            backgroundSize: '40px 40px'
          }} 
        />
      </div>
      
      {/* Glow Effects */}
      <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-[#117A4B]/20 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-[#117A4B]/10 rounded-full blur-3xl" />

      <div className="container relative flex flex-col items-center justify-center gap-10 px-4 py-16">
        {/* Logo */}
        <div className="w-20 h-20 relative">
          <Image
            src="/logo-white.svg"
            alt="Comply Vault Logo"
            fill
            className="object-contain"
            priority
          />
        </div>

        {/* Heading */}
        <h1 className="text-5xl font-extrabold tracking-tight text-white sm:text-[5rem] text-center">
          Comply <span className="text-[#22C55E]">Vault</span>
        </h1>
        
        {/* Tagline */}
        <p className="text-xl text-gray-300 text-center max-w-md">
          Exam-ready client interaction records in &lt;10 minutes
        </p>
        
        {/* Sign In Button */}
        <div className="flex gap-4">
          <Link
            href="/auth/signin"
            className="rounded-xl bg-[#117A4B] px-8 py-4 text-lg font-semibold text-white hover:bg-[#0E6B3F] transition-colors shadow-lg shadow-[#117A4B]/25 hover:shadow-xl hover:shadow-[#117A4B]/30"
          >
            Get Started
          </Link>
        </div>

        {/* Trust Indicators */}
        <div className="flex flex-wrap gap-6 justify-center text-sm text-gray-400 mt-4">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-[#22C55E]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <span>256-bit Encryption</span>
          </div>
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-[#22C55E]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <span>Role-Based Access</span>
          </div>
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-[#22C55E]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            <span>Full Audit Trail</span>
          </div>
        </div>
      </div>
    </main>
  );
}
