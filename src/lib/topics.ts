/**
 * Helper to split a topic string into a concise title and a longer description.
 * Used in PDF export and web app for consistent display.
 */
export function topicToTitleDescription(topic: string): { title: string; description: string } {
  const t = topic.trim();
  const periodIdx = t.indexOf(".");
  if (periodIdx > 0 && periodIdx <= 80) {
    return {
      title: t.slice(0, periodIdx + 1).trim(),
      description: t.slice(periodIdx + 1).trim(),
    };
  }
  if (t.length <= 50) return { title: t, description: "" };
  return {
    title: t.slice(0, 50).trim() + (t.length > 50 ? "…" : ""),
    description: t.slice(50).trim(),
  };
}
