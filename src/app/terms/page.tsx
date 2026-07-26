import type { Metadata } from "next";
import { MarketingShell } from "~/components/marketing/marketing-shell";

export const metadata: Metadata = {
  title: "Terms — ComplyVault",
  description: "ComplyVault terms of use overview.",
};

export default function TermsPage(): React.ReactElement {
  return (
    <MarketingShell title="Terms">
      <div className="space-y-6 text-[15px] leading-relaxed text-white/80">
        <p>
          ComplyVault provides software for documenting client interactions and
          related compliance workflows. The product assists human reviewers; it
          does not replace legal advice or regulatory judgment.
        </p>
        <p>
          AI-assisted extraction and classification produce triage signals for
          human review. Finalised and sealed records reflect actions taken by
          authorised workspace users.
        </p>
        <p>
          External copies (for example SharePoint deposits) are convenience
          filings. Where a sealed Object Lock record exists, that sealed record
          is the system of record.
        </p>
        <p className="text-sm text-white/50">
          Paid workspace use is also governed by the commercial agreement with
          your firm. See{" "}
          <a href="/trust" className="text-[#86EFAC] underline underline-offset-2">
            Trust
          </a>{" "}
          for current control and certification disclosures.
        </p>
      </div>
    </MarketingShell>
  );
}
