import Link from "next/link";
import { cn } from "~/lib/utils";
import { dashboardType } from "~/lib/dashboard-typography";

type DashboardCardProps = {
  title: string;
  /** Optional right-aligned link in the card header */
  link?: { href: string; label: string };
  /** Larger, darker title for section-level cards (tables) */
  emphasized?: boolean;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
};

export function DashboardCard({
  title,
  link,
  emphasized = false,
  className,
  bodyClassName,
  children,
}: DashboardCardProps): React.JSX.Element {
  return (
    <section
      className={cn(
        "rounded-[10px] border border-surface-border bg-white shadow-sm",
        className,
      )}
    >
      <div className="flex items-center justify-between px-[18px] pt-4">
        <span
          className={cn(
            emphasized ? dashboardType.cardTitleEmphasis : dashboardType.cardTitle,
          )}
        >
          {title}
        </span>
        {link ? (
          <Link href={link.href} className={dashboardType.cardLink}>
            {link.label}
          </Link>
        ) : null}
      </div>
      <div className={cn("px-[18px] pb-[18px] pt-[14px]", bodyClassName)}>{children}</div>
    </section>
  );
}

type MetricProps = {
  value: React.ReactNode;
  unit?: string;
  delta?: { text: string; tone: "good" | "bad" };
};

export function Metric({ value, unit, delta }: MetricProps): React.JSX.Element {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className={dashboardType.displayFigure}>{value}</span>
      {unit ? <span className={dashboardType.metricUnit}>{unit}</span> : null}
      {delta ? (
        <span className={delta.tone === "bad" ? dashboardType.deltaBad : dashboardType.deltaGood}>
          {delta.text}
        </span>
      ) : null}
    </div>
  );
}
