import type { Metadata } from "next";
import Link from "next/link";
import { MarketingShell } from "~/components/marketing/marketing-shell";

export const metadata: Metadata = {
  title: "UK — ComplyVault",
  description:
    "ComplyVault does not currently market an FCA supervision product track.",
  robots: { index: false, follow: false },
};

/**
 * CV-WEB-04 — No FCA claim. Former /uk marketing path is retired until a UK PRD ships.
 */
export default function UkRetiredPage(): React.ReactElement {
  return (
    <MarketingShell title="United Kingdom">
      <div className="space-y-6 text-[15px] leading-relaxed text-white/80">
        <p>
          ComplyVault does not currently offer a UK data-residency path, FCA
          template set, or UK-specific retention rule as a marketed product
          track.
        </p>
        <p>
          Any prior UK or FCA supervision claim has been removed. If a UK track
          is built later, it will ship under its own PRD and marketing will
          return only then.
        </p>
        <p>
          <Link
            href="/"
            className="text-[#86EFAC] underline underline-offset-2"
          >
            Return to ComplyVault
          </Link>
        </p>
      </div>
    </MarketingShell>
  );
}
