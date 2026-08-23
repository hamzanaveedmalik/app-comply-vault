"use client";

import { useReducedMotion as useMotionReducedMotion } from "motion/react";
import { useEffect, useState } from "react";

/**
 * Shared reduced-motion gate for ComplyVault UI.
 * Combines Motion's hook with OS `prefers-reduced-motion` for CSS-only surfaces.
 */
export function useReducedMotion(): boolean {
  const motionReduce = useMotionReducedMotion() ?? false;
  const [mediaReduce, setMediaReduce] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = (): void => setMediaReduce(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return motionReduce || mediaReduce;
}
