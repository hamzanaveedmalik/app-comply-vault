import type { Metadata } from "next";
import Link from "next/link";
import { MarketingShell } from "~/components/marketing/marketing-shell";
import {
  CERTIFICATION_STATUS,
  IMPLEMENTED_CONTROLS,
  SECURITY_OVERVIEW_PATH,
  SUBPROCESSORS,
} from "~/lib/marketing/trust-content";
import {
  LIVE_CAPTURE_LEAD_COPY,
  MANUAL_UPLOAD_COPY,
  MARKETING_LIVE_INTEGRATIONS,
  MARKETING_ROADMAP_INTEGRATIONS,
} from "~/lib/marketing/live-integrations";

export const metadata: Metadata = {
  title: "Trust — ComplyVault",
  description:
    "Implemented controls, certification status, and subprocessors for ComplyVault. No form gate.",
};

export default function TrustPage(): React.ReactElement {
  return (
    <MarketingShell title="Trust">
      <div className="space-y-12 text-[15px] leading-relaxed text-white/80">
        <p>
          Controls and certification status below reflect what is implemented
          today. Nothing here requires a form or sales call.
        </p>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-white">Certification status</h2>
          <ul className="space-y-4">
            {CERTIFICATION_STATUS.map((c) => (
              <li
                key={c.name}
                className="rounded-lg border border-white/10 bg-white/[0.03] p-4"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium text-white">{c.name}</span>
                  <span className="text-sm text-[#86EFAC]">{c.status}</span>
                </div>
                <p className="mt-2 text-sm text-white/65">{c.detail}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-white">Implemented controls</h2>
          <p className="text-sm text-white/55">
            Legal hold is not listed here as an implemented marketed control
            until that capability ships as a completed product story.
          </p>
          <ul className="space-y-4">
            {IMPLEMENTED_CONTROLS.map((control) => (
              <li key={control.id} className="border-b border-white/10 pb-4">
                <h3 className="font-medium text-white">{control.title}</h3>
                <p className="mt-1 text-sm text-white/65">{control.summary}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-white">Capture paths</h2>
          <p>{LIVE_CAPTURE_LEAD_COPY}</p>
          <p>{MANUAL_UPLOAD_COPY}</p>
          <div>
            <h3 className="text-sm font-medium uppercase tracking-wide text-white/50">
              Live
            </h3>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {MARKETING_LIVE_INTEGRATIONS.map((i) => (
                <li key={i.registryKey}>
                  {i.label} ({i.capture})
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-medium uppercase tracking-wide text-white/50">
              Roadmap (not live — no ship dates)
            </h3>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {MARKETING_ROADMAP_INTEGRATIONS.map((i) => (
                <li key={i.label}>
                  {i.label} — {i.note}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-white">
            Subprocessors{" "}
            <span className="text-sm font-normal text-white/50">
              v{SUBPROCESSORS.version} · effective {SUBPROCESSORS.effectiveDate}
            </span>
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-white/50">
                <tr>
                  <th className="py-2 pr-4 font-medium">Name</th>
                  <th className="py-2 pr-4 font-medium">Purpose</th>
                  <th className="py-2 font-medium">Location</th>
                </tr>
              </thead>
              <tbody>
                {SUBPROCESSORS.subprocessors.map((s) => (
                  <tr key={s.name} className="border-t border-white/10">
                    <td className="py-2 pr-4 text-white">{s.name}</td>
                    <td className="py-2 pr-4">{s.purpose}</td>
                    <td className="py-2">{s.location}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-white">Security overview</h2>
          <p>
            Download the current security overview directly — no email gate.
          </p>
          <Link
            href={SECURITY_OVERVIEW_PATH}
            className="inline-flex rounded-lg bg-[#117A4B] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0E6B3F]"
          >
            Download security overview
          </Link>
        </section>
      </div>
    </MarketingShell>
  );
}
