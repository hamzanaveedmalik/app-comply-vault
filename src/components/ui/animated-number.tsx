"use client";
// MIT — beUI animated-number (https://beui.dev/r/animated-number)

import { animate } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "~/hooks/use-reduced-motion";
import { cn } from "~/lib/utils";
import { EASE_OUT, STATE_CHANGE_MS } from "~/components/ui/motion-config";

export type AnimatedNumberProps = {
  value: number;
  duration?: number;
  format?: (n: number) => string;
  className?: string;
  startOnView?: boolean;
};

export function AnimatedNumber({
  value,
  duration = STATE_CHANGE_MS / 1000,
  format = (n) => Math.round(n).toLocaleString(),
  className,
  startOnView = false,
}: AnimatedNumberProps): React.JSX.Element {
  const ref = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);

  useEffect(() => {
    if (reduce) {
      fromRef.current = value;
      setDisplay(value);
      return;
    }
    const controls = animate(fromRef.current, value, {
      duration,
      ease: EASE_OUT,
      onUpdate: (v) => setDisplay(v),
    });
    fromRef.current = value;
    return () => controls.stop();
  }, [value, duration, reduce]);

  return (
    <span ref={ref} className={cn("tabular-nums", className)}>
      {format(display)}
    </span>
  );
}
