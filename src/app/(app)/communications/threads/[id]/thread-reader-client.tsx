"use client";

import Link from "next/link";
import { Button } from "~/components/ui/button";
import { toast } from "sonner";
import type {
  CommunicationMessageDto,
  CommunicationThreadDto,
} from "~/lib/types/evidence";

const TAGS = [
  "ADVICE",
  "COMPLAINT",
  "FEE",
  "PERFORMANCE",
  "OFF_CHANNEL",
] as const;

export function ThreadReaderClient({
  thread,
  messages,
}: {
  thread: CommunicationThreadDto;
  messages: CommunicationMessageDto[];
}) {
  async function tagThread(category: (typeof TAGS)[number]): Promise<void> {
    const res = await fetch(`/api/mailbox/threads/${thread.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category }),
    });
    const json = (await res.json()) as { success: boolean; error?: string };
    if (!json.success) {
      toast.error(json.error ?? "Tag failed");
      return;
    }
    toast.success(`Tagged as ${category}`);
  }

  async function exportThread(): Promise<void> {
    const res = await fetch(`/api/mailbox/threads/${thread.id}/export`, {
      method: "POST",
    });
    if (!res.ok) {
      toast.error("Export failed");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `thread-${thread.id}.zip`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Export downloaded");
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/communications" className="text-sm text-muted-foreground hover:underline">
            ← Communications
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-[#0D2818]">
            {thread.subject ?? "(no subject)"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {thread.messageCount} messages
            {thread.clientName ? ` · Client: ${thread.clientName}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {TAGS.map((tag) => (
            <Button key={tag} size="sm" variant="outline" onClick={() => void tagThread(tag)}>
              Tag {tag}
            </Button>
          ))}
          <Button
            size="sm"
            className="bg-[#2ECC71] text-[#0D2818]"
            onClick={() => void exportThread()}
          >
            Export ZIP
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {messages.map((m) => (
          <article key={m.id} className="rounded-lg border p-4">
            <header className="mb-2 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{m.fromAddress}</span>
              {" · "}
              {new Date(m.sentAt).toLocaleString()} · {m.direction}
            </header>
            {m.bodyHtml ? (
              <div
                className="prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: m.bodyHtml }}
              />
            ) : (
              <pre className="whitespace-pre-wrap text-sm">{m.bodyText}</pre>
            )}
            {m.attachments.length > 0 && (
              <ul className="mt-3 text-xs text-muted-foreground">
                {m.attachments.map((a) => (
                  <li key={a.id}>
                    {a.filename} ({a.mimeType}) · sha256:{a.contentSha256.slice(0, 12)}…
                  </li>
                ))}
              </ul>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
