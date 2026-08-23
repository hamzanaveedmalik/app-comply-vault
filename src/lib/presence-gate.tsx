"use client";
// MIT — beUI presence-gate (https://beui.dev/r/drawer)

import { useIsPresent } from "motion/react";
import type { ReactNode } from "react";

export type PresenceGateRenderProps = {
  isPresent: boolean;
  gate: {
    inert: boolean;
    style: { pointerEvents: "auto" | "none" };
  };
};

export type PresenceGateProps = {
  children: (props: PresenceGateRenderProps) => ReactNode;
};

export function PresenceGate({ children }: PresenceGateProps): ReactNode {
  const isPresent = useIsPresent();

  return children({
    isPresent,
    gate: {
      inert: !isPresent,
      style: { pointerEvents: isPresent ? "auto" : "none" },
    },
  });
}
