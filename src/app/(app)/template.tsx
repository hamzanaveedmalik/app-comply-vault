"use client";

/**
 * Remounts on (app) segment navigations so each page enters with a short fade.
 * `cv-motion-fade-in` is disabled under prefers-reduced-motion in globals.css.
 */
export default function AppTemplate({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  return <div className="cv-motion-fade-in min-h-0">{children}</div>;
}
