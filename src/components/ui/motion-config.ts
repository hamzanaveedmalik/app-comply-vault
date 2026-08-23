/**
 * Central Motion timings for ComplyVault UI primitives (adapted from beUI ease tokens).
 * MIT — beUI (https://beui.dev), registry ease.ts
 *
 * Durations capped per product guardrails: 200ms state changes, 300ms surface transitions.
 */

/** Max duration for idle → loading → success/error state changes (ms). */
export const STATE_CHANGE_MS = 200;

/** Max duration for drawer/modal/palette surface transitions (ms). */
export const SURFACE_TRANSITION_MS = 300;

export const EASE_OUT = [0.16, 1, 0.3, 1] as const;
export const EASE_IN_OUT = [0.77, 0, 0.175, 1] as const;
export const EASE_DRAWER = [0.32, 0.72, 0, 1] as const;

export const EASE_OUT_CSS = "cubic-bezier(0.16, 1, 0.3, 1)";

/** Snappy press — no hover scale in app surfaces. */
export const SPRING_PRESS = {
  type: "spring" as const,
  stiffness: 600,
  damping: 35,
  mass: 0.5,
};

/** Label/icon slot swaps inside controls — capped for queue-clearing speed. */
export const SPRING_SWAP = {
  type: "spring" as const,
  stiffness: 520,
  damping: 38,
  mass: 0.45,
};

/** Overlay panel entrances — drawers and sheets. */
export const SPRING_PANEL = {
  type: "spring" as const,
  stiffness: 480,
  damping: 42,
  mass: 0.48,
};

/** Shared-layout glides — tab indicators. */
export const SPRING_LAYOUT = {
  type: "spring" as const,
  stiffness: 400,
  damping: 34,
  mass: 0.55,
};

export const STATE_TRANSITION = {
  duration: STATE_CHANGE_MS / 1000,
  ease: EASE_OUT,
} as const;

export const SURFACE_TRANSITION = {
  duration: SURFACE_TRANSITION_MS / 1000,
  ease: EASE_OUT,
} as const;
