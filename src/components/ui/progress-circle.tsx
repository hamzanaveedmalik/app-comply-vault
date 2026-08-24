"use client";

import * as React from "react";
import { cn } from "~/lib/utils";
import { useReducedMotion } from "~/hooks/use-reduced-motion";

type ProgressCircleVariant = "default" | "neutral" | "warning" | "error" | "success";

const variantStyles: Record<ProgressCircleVariant, { background: string; circle: string }> = {
  default: { background: "stroke-brand/20", circle: "stroke-brand" },
  neutral: { background: "stroke-surface-border", circle: "stroke-text-muted" },
  warning: { background: "stroke-semantic-warning/20", circle: "stroke-semantic-warning" },
  error: { background: "stroke-chart-breach/20", circle: "stroke-chart-breach" },
  success: { background: "stroke-chart-cleared/20", circle: "stroke-chart-cleared" },
};

export type ProgressCircleProps = Omit<React.SVGProps<SVGSVGElement>, "value"> & {
  value?: number;
  max?: number;
  variant?: ProgressCircleVariant;
  showAnimation?: boolean;
  radius?: number;
  strokeWidth?: number;
  children?: React.ReactNode;
};

export function ProgressCircle({
  value = 0,
  max = 100,
  radius = 32,
  strokeWidth = 6,
  showAnimation = false,
  variant = "success",
  className,
  children,
  ...props
}: ProgressCircleProps): React.JSX.Element {
  const reduceMotion = useReducedMotion();
  const safeValue = Math.min(max, Math.max(value, 0));
  const normalizedRadius = radius - strokeWidth / 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const offset = circumference - (safeValue / max) * circumference;
  const styles = variantStyles[variant];

  return (
    <svg
      role="progressbar"
      aria-valuenow={safeValue}
      aria-valuemin={0}
      aria-valuemax={max}
      className={cn("shrink-0", className)}
      width={radius * 2}
      height={radius * 2}
      viewBox={`0 0 ${radius * 2} ${radius * 2}`}
      {...props}
    >
      <circle
        className={styles.background}
        r={normalizedRadius}
        cx={radius}
        cy={radius}
        fill="transparent"
        strokeWidth={strokeWidth}
      />
      <circle
        className={cn(
          styles.circle,
          showAnimation && !reduceMotion && "transition-all duration-300 ease-in-out",
        )}
        r={normalizedRadius}
        cx={radius}
        cy={radius}
        fill="transparent"
        strokeWidth={strokeWidth}
        strokeDasharray={`${circumference} ${circumference}`}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${radius} ${radius})`}
      />
      {children ? (
        <foreignObject x={0} y={0} width={radius * 2} height={radius * 2}>
          <div className="flex h-full w-full items-center justify-center">{children}</div>
        </foreignObject>
      ) : null}
    </svg>
  );
}

// Tremor ProgressCircle [v0.0.3] — adapted for ComplyVault semantic tokens
// Source: https://github.com/tremorlabs/tremor (Apache-2.0)
