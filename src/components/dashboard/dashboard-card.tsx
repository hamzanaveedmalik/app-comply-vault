import Link from "next/link";
import { cn } from "~/lib/utils";

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
        "rounded-[10px] border border-[#e6e8e6] bg-white shadow-[0_1px_2px_rgba(20,31,25,0.04)]",
        className,
      )}
    >
      <div className="flex items-center justify-between px-[18px] pt-4">
        <span
          className={cn(
            "font-semibold",
            emphasized ? "text-[13.5px] text-[#141f19]" : "text-[12px] text-[#3f4b45]",
          )}
        >
          {title}
        </span>
        {link ? (
          <Link
            href={link.href}
            className="text-[12px] font-semibold text-[#177a4c] hover:underline"
          >
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
      <span className="text-[26px] font-[650] leading-none tracking-[-0.02em] tabular-nums text-[#141f19]">
        {value}
      </span>
      {unit ? <span className="text-[12.5px] text-[#79837d]">{unit}</span> : null}
      {delta ? (
        <span
          className={cn(
            "ml-1 text-[11.5px] font-semibold",
            delta.tone === "bad" ? "text-[#c13a2a]" : "text-[#177a4c]",
          )}
        >
          {delta.text}
        </span>
      ) : null}
    </div>
  );
}
