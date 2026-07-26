import Link from "next/link";
import Image from "next/image";
import { auth } from "~/server/auth";
import { redirect } from "next/navigation";
import { resolvePostAuthRedirect } from "~/lib/auth-redirect";
import {
  LIVE_CAPTURE_LEAD_COPY,
  MANUAL_UPLOAD_COPY,
  MARKETING_LIVE_INTEGRATIONS,
  MARKETING_ROADMAP_INTEGRATIONS,
} from "~/lib/marketing/live-integrations";

export default async function HomePage(): Promise<React.ReactElement> {
  const session = await auth();

  if (session?.user) {
    if (session.user.workspaceId && session.user.workspaceId !== "") {
      redirect("/dashboard");
    }
    redirect(
      await resolvePostAuthRedirect({
        userId: session.user.id,
        email: session.user.email,
        workspaceId: session.user.workspaceId,
      }),
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-b from-[#0A1F14] to-[#0D2818] text-white">
      <div className="pointer-events-none absolute inset-0 opacity-10">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.15) 1px, transparent 0)",
            backgroundSize: "40px 40px",
          }}
        />
      </div>
      <div className="pointer-events-none absolute left-1/4 top-1/4 h-[500px] w-[500px] rounded-full bg-[#117A4B]/20 blur-3xl" />
      <div className="pointer-events-none absolute bottom-1/4 right-1/4 h-[400px] w-[400px] rounded-full bg-[#117A4B]/10 blur-3xl" />

      {/* First viewport: brand, one headline, one sentence, one CTA */}
      <section className="relative flex min-h-[100svh] flex-col items-center justify-center px-4 py-16">
        <div className="flex max-w-xl flex-col items-center gap-8 text-center">
          <div className="relative h-20 w-20">
            <Image
              src="/logo-white.svg"
              alt="ComplyVault"
              fill
              className="object-contain"
              priority
            />
          </div>
          <h1 className="text-5xl font-extrabold tracking-tight sm:text-[4.5rem]">
            Comply<span className="text-[#22C55E]">Vault</span>
          </h1>
          <p className="max-w-md text-lg text-white/70">
            Meeting records your CCO can seal for exam documentation — with
            human review before anything is final.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/auth/signin"
              className="rounded-xl bg-[#117A4B] px-8 py-4 text-lg font-semibold text-white shadow-lg shadow-[#117A4B]/25 transition-colors hover:bg-[#0E6B3F]"
            >
              Get started
            </Link>
            <Link
              href="/trust"
              className="rounded-xl border border-white/20 px-6 py-3.5 text-sm font-medium text-white/80 hover:border-white/40 hover:text-white"
            >
              Trust &amp; controls
            </Link>
          </div>
        </div>
      </section>

      {/* Below fold: honest capture narrative (CV-WEB-02) */}
      <section className="relative border-t border-white/10 px-4 py-20">
        <div className="mx-auto max-w-2xl space-y-10">
          <div className="space-y-3">
            <h2 className="text-2xl font-semibold tracking-tight">How capture works</h2>
            <p className="text-white/70">{LIVE_CAPTURE_LEAD_COPY}</p>
            <p className="text-white/70">{MANUAL_UPLOAD_COPY}</p>
          </div>

          <div className="grid gap-8 sm:grid-cols-2">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-[#86EFAC]">
                Live today
              </h3>
              <ul className="mt-3 space-y-2 text-sm text-white/80">
                {MARKETING_LIVE_INTEGRATIONS.map((i) => (
                  <li key={i.registryKey}>
                    {i.label} — {i.capture}
                  </li>
                ))}
                <li>Manual upload — any platform</li>
              </ul>
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-white/45">
                Roadmap — not live, no dates
              </h3>
              <ul className="mt-3 space-y-2 text-sm text-white/55">
                {MARKETING_ROADMAP_INTEGRATIONS.map((i) => (
                  <li key={i.label}>{i.label}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/45">
            <span>Encryption at rest and in transit</span>
            <span>Role-based access</span>
            <span>Append-only audit events</span>
            <Link href="/trust" className="text-[#86EFAC] hover:underline">
              Full trust page →
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
