/**
 * Topics can be stored as string[] (legacy) or {title, description}[]
 * Helper to normalize for display.
 */
export type TopicEntry = string | { title: string; description: string };

/** Normalize topic to {title, description} for consistent use */
export function normalizeTopic(topic: TopicEntry): { title: string; description: string } {
  if (typeof topic === "string") {
    const title = topic.length > 55 ? topic.slice(0, 52).trim() + "..." : topic;
    return { title, description: topic };
  }
  return { title: topic.title, description: topic.description };
}

export function getTopicTitle(topic: TopicEntry): string {
  if (typeof topic === "string") return topic.length > 55 ? topic.slice(0, 52).trim() + "..." : topic;
  if ("title" in topic && topic.title) return topic.title;
  if ("text" in topic && typeof (topic as { text?: string }).text === "string") return (topic as { text: string }).text;
  return (topic as { description?: string }).description ?? "";
}

export function getTopicDescription(topic: TopicEntry): string {
  if (typeof topic === "string") return topic;
  if ("description" in topic && topic.description) return topic.description;
  if ("text" in topic && typeof (topic as { text?: string }).text === "string") return (topic as { text: string }).text;
  return (topic as { title?: string }).title ?? "";
}

export function topicToString(topic: TopicEntry): string {
  if (typeof topic === "string") return topic;
  return (
    (topic as { description?: string }).description ||
    (topic as { text?: string }).text ||
    (topic as { title?: string }).title ||
    ""
  );
}
