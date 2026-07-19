/** Hex colours for charts / inline styles (Recharts, SVG). Mirrors `globals.css` tokens. */
export const dashboardColors = {
  brand: "#117A4B",
  brandLight: "#E8F5EE",
  brandMid: "#1A9B5F",
  brandDark: "#0D5C38",
  semanticDanger: "#EF4444",
  semanticWarning: "#D97706",
  semanticOrange: "#F97316",
  semanticCritical: "#DC2626",
  textMuted: "#94A3B8",
  barTrack: "#F1F5F9",
  /**
   * Dashboard v2 palette — matches the approved dashboard mock. Kept distinct from
   * the brand tokens above so the redesigned surfaces render exactly as designed.
   */
  forest: "#12382a",
  forest2: "#1c4a37",
  accent: "#177a4c",
  accentSoft: "#e9f4ee",
  amber: "#b26a12",
  amber2: "#e0a53f",
  amberSoft: "#fdf4e6",
  red: "#c13a2a",
  redSoft: "#fcedeb",
  slate: "#6b7c86",
  slate2: "#8fa1ab",
  track: "#eff1ef",
  inkStrong: "#141f19",
  ink2: "#3f4b45",
  ink3: "#79837d",
  meetingTypes: {
    "Annual Review": "#117A4B",
    "Portfolio Review": "#3B82F6",
    "Quarterly Check-in": "#F97316",
    Onboarding: "#8B5CF6",
    Other: "#94A3B8",
  } as Record<string, string>,
  flagCategories: {
    Suitability: "#EF4444",
    Documentation: "#F97316",
    Disclosure: "#D97706",
    "Risk Tolerance": "#8B5CF6",
    "Fee Discussion": "#94A3B8",
  } as Record<string, string>,
} as const;

export function meetingTypeColor(label: string): string {
  const key = Object.keys(dashboardColors.meetingTypes).find(
    (k) => k.toLowerCase() === label.trim().toLowerCase(),
  );
  if (key) return dashboardColors.meetingTypes[key]!;
  const lower = label.toLowerCase();
  if (lower.includes("annual")) return dashboardColors.meetingTypes["Annual Review"]!;
  if (lower.includes("portfolio")) return dashboardColors.meetingTypes["Portfolio Review"]!;
  if (lower.includes("quarter")) return dashboardColors.meetingTypes["Quarterly Check-in"]!;
  if (lower.includes("onboard")) return dashboardColors.meetingTypes.Onboarding!;
  return dashboardColors.meetingTypes.Other!;
}
