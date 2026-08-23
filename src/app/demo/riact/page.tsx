import type { Metadata } from "next";
import { RiactDemoLoginClient } from "~/components/demo/riact/demo-login-client";

export const metadata: Metadata = {
  title: "ComplyVault — RIACT demo",
  description: "Partner demo for Sonoran Compliance Partners and client firms.",
  robots: { index: false, follow: false },
};

export default function RiactDemoPage(): React.JSX.Element {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6 py-12">
      <header className="mb-8 text-center">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          ComplyVault
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">RIACT demo</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Isolated tenant for live partner rehearsal
        </p>
      </header>
      <RiactDemoLoginClient />
    </main>
  );
}
