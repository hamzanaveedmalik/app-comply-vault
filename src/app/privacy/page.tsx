import type { Metadata } from "next";
import { MarketingShell } from "~/components/marketing/marketing-shell";

export const metadata: Metadata = {
  title: "Privacy — ComplyVault",
  description: "ComplyVault privacy practices overview.",
};

export default function PrivacyPage(): React.ReactElement {
  return (
    <MarketingShell title="Privacy">
      <div className="space-y-6 text-[15px] leading-relaxed text-white/80">
        <p>
          ComplyVault processes meeting recordings, transcripts, and related
          compliance documentation on behalf of Registered Investment Advisor
          firms that use the product.
        </p>
        <p>
          Customer content is stored in the firm’s workspace tenancy. We do not
          sell customer content. Access is gated by workspace membership and
          role. Operational logs use entity identifiers and avoid client personal
          data where practicable.
        </p>
        <p>
          For the current list of subprocessors and implemented security
          controls, see the{" "}
          <a href="/trust" className="text-[#86EFAC] underline underline-offset-2">
            Trust
          </a>{" "}
          page. For a downloadable overview, use the security overview link
          there.
        </p>
        <p className="text-sm text-white/50">
          This page is a concise product privacy overview. Contact your firm
          administrator for workspace-specific retention and media posture
          settings.
        </p>
      </div>
    </MarketingShell>
  );
}
