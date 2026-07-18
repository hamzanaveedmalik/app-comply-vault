import { ArrowRight, Mail, Users, Video } from "lucide-react";
import { ConnectButton } from "~/components/demo/advizor-stack/connect-button";
import {
  CAPTURE_SOURCES,
  HADRIUS_PAYOFF,
  TOTAL_CAPTURED,
} from "~/components/demo/advizor-stack/demo-data";

const SOURCE_ICONS: Record<string, React.ComponentType<{ className?: string }>> =
  {
    Zocks: Video,
    "Email (M365)": Mail,
    Teams: Users,
  };

export default function DemoSourcesPage() {
  return (
    <div>
      <p className="mb-1.5 text-[13px] text-text-secondary">
        {TOTAL_CAPTURED} interactions captured this month from
      </p>
      <h1 className="text-2xl font-semibold tracking-tight">Sources</h1>

      <div className="mt-6 flex flex-col gap-2.5">
        {CAPTURE_SOURCES.map((source) => {
          const Icon = SOURCE_ICONS[source.name] ?? Video;
          return (
            <div
              key={source.name}
              className="flex items-center gap-3.5 rounded-lg border bg-surface-card px-4 py-3.5"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-surface-muted text-text-secondary">
                <Icon className="h-4 w-4" />
              </span>
              <div className="flex-1">
                <div className="text-sm font-semibold">{source.name}</div>
                <div className="mt-0.5 text-xs text-text-secondary">
                  {source.detail}
                </div>
              </div>
              {source.connected ? (
                <span className="text-xs text-brand">Connected</span>
              ) : (
                <ConnectButton source={source.name} />
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex items-center gap-3.5 border-t pt-4">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-surface-muted text-text-secondary">
          <ArrowRight className="h-4 w-4" />
        </span>
        <div className="flex-1">
          <div className="text-xs text-text-secondary">
            Reviewed decisions sync to
          </div>
          <div className="text-sm font-semibold">Hadrius</div>
        </div>
        <span className="text-xs text-text-muted">Not connected</span>
      </div>

      <p className="mt-4 max-w-md text-[13px] leading-relaxed text-text-secondary">
        {HADRIUS_PAYOFF}
      </p>
    </div>
  );
}
