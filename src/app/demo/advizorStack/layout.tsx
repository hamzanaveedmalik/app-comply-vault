import type { Metadata } from "next";
import { DemoSidebar } from "~/components/demo/advizor-stack/demo-sidebar";

export const metadata: Metadata = {
  title: "ComplyVault — AdvizorStack demo",
  description: "Illustrative partner demo of the ComplyVault review experience.",
  robots: { index: false, follow: false },
};

export default function AdvizorStackDemoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden bg-surface-page text-text-primary">
      <DemoSidebar />
      <main className="flex-1 overflow-y-auto px-6 py-7 sm:px-10">
        <div className="mx-auto max-w-3xl">{children}</div>
      </main>
    </div>
  );
}
