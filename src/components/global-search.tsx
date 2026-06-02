"use client";

import { Fragment, useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "~/components/ui/command";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";
import {
  AnswerCard,
  type AnswerCardProps,
  type AnswerCitation,
} from "~/components/global-search/AnswerCard";

interface SearchResult {
  id: string;
  clientName: string;
  meetingDate: string;
  status: string;
  type: string;
  matchType?: "client" | "date" | "keyword" | "transcript" | "field";
  snippet?: string;
}

interface GlobalSearchProps {
  className?: string;
}

const EXAMPLE_QUERIES = [
  "Did Rob discuss fee changes?",
  "Show suitability flags from last week",
] as const;

const EXAMPLE_CHIP_CLASS =
  "inline-flex max-w-full rounded-full border border-border bg-muted/50 px-3 py-1.5 text-left text-xs font-medium text-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const ASK_PREFIX = /^ask:\s*/i;

/**
 * Detect Ask mode (PRD §4.1):
 *   - leading `ask:` prefix
 *   - trailing `?` on a query of any length ≥3
 *   - explicit force flag (used by the "Ask" chip — Phase 1.1)
 */
function shouldUseAskMode(rawQuery: string, forceAsk: boolean): {
  ask: boolean;
  cleanedQuery: string;
} {
  const trimmed = rawQuery.trim();
  if (forceAsk && trimmed.length >= 3) {
    return { ask: true, cleanedQuery: trimmed.replace(ASK_PREFIX, "").trim() };
  }
  if (ASK_PREFIX.test(trimmed)) {
    const cleaned = trimmed.replace(ASK_PREFIX, "").trim();
    return { ask: cleaned.length >= 3, cleanedQuery: cleaned };
  }
  if (trimmed.endsWith("?") && trimmed.length >= 4) {
    return { ask: true, cleanedQuery: trimmed };
  }
  return { ask: false, cleanedQuery: trimmed };
}

type AskState = AnswerCardProps["state"];

export function GlobalSearch({ className }: GlobalSearchProps): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [askState, setAskState] = useState<AskState | null>(null);
  const [askedQuestion, setAskedQuestion] = useState<string>("");
  const askAbortRef = useRef<AbortController | null>(null);
  const router = useRouter();

  // Keyboard shortcut to open search (Cmd/Ctrl + K)
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  // Reset Ask state when query changes (user is typing a new question)
  useEffect(() => {
    if (askState && query !== askedQuestion) {
      setAskState(null);
    }
  }, [query, askState, askedQuestion]);

  // Debounced keyword search (default mode)
  useEffect(() => {
    if (!open || query.length < 2) {
      setResults([]);
      return;
    }

    const timeoutId = setTimeout(() => {
      performSearch(query);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [query, open]);

  // Cancel any in-flight Ask request when the dialog closes
  useEffect(() => {
    if (!open && askAbortRef.current) {
      askAbortRef.current.abort();
      askAbortRef.current = null;
    }
  }, [open]);

  const performSearch = useCallback(async (searchQuery: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/search?q=${encodeURIComponent(searchQuery)}`,
        {
          credentials: "include",
        }
      );
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("Search failed:", response.status, errorData);
        throw new Error(errorData.error || "Search failed");
      }
      const data = await response.json();
      setResults(data.results || []);
    } catch (error) {
      console.error("Search error:", error);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const performAsk = useCallback(
    async (question: string) => {
      if (askAbortRef.current) {
        askAbortRef.current.abort();
      }
      const controller = new AbortController();
      askAbortRef.current = controller;
      setAskedQuestion(question);
      setAskState({ kind: "loading" });

      try {
        const response = await fetch("/api/ask", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question }),
          signal: controller.signal,
        });
        const data = await response.json().catch(() => ({}));

        if (response.status === 429) {
          const retryAfterSec =
            typeof data?.retryAfterSec === "number" ? data.retryAfterSec : 30;
          setAskState({ kind: "rate-limited", retryAfterSec });
          return;
        }

        if (!response.ok || data?.success !== true) {
          setAskState({
            kind: "error",
            message: typeof data?.message === "string" ? data.message : "Failed",
          });
          return;
        }

        const inner = data.data as {
          answer: string;
          citations: AnswerCitation[];
          retrieval: { candidatesScanned: number; candidatesUsed: number; mode: string };
          model: string;
          latencyMs: number;
        };

        if (inner.citations.length === 0) {
          setAskState({ kind: "no-evidence", answer: inner.answer });
          return;
        }

        setAskState({
          kind: "answer",
          answer: inner.answer,
          citations: inner.citations,
          retrieval: inner.retrieval,
          model: inner.model,
          latencyMs: inner.latencyMs,
        });
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        console.error("Ask error:", err);
        setAskState({ kind: "error", message: "Network error" });
      }
    },
    []
  );

  const handleAskFromQuery = useCallback(() => {
    const { ask, cleanedQuery } = shouldUseAskMode(query, false);
    if (!ask) return;
    void performAsk(cleanedQuery);
  }, [query, performAsk]);

  const handleSelect = (meetingId: string) => {
    setOpen(false);
    setQuery("");
    setAskState(null);
    router.push(`/meetings/${meetingId}`);
  };

  const handleExampleClick = (example: string) => {
    setQuery(example);
    // Examples are all questions — submit immediately.
    void performAsk(example);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter") {
      const { ask } = shouldUseAskMode(query, false);
      if (ask) {
        e.preventDefault();
        handleAskFromQuery();
      }
    }
  };

  const getStatusVariant = (
    status: string
  ): "default" | "secondary" | "outline" | "destructive" => {
    switch (status) {
      case "FINALIZED":
        return "default";
      case "DRAFT_READY":
      case "DRAFT":
        return "secondary";
      case "PROCESSING":
        return "outline";
      case "ERROR":
        return "destructive";
      default:
        return "secondary";
    }
  };

  const getStatusLabel = (status: string): string => {
    switch (status) {
      case "FINALIZED":
        return "Finalized";
      case "DRAFT_READY":
        return "Draft Ready";
      case "DRAFT":
        return "Draft";
      case "PROCESSING":
        return "Processing";
      case "ERROR":
        return "Error";
      default:
        return status;
    }
  };

  const askActive = askState !== null;
  // Show the fallback keyword results below the answer card whenever Ask
  // returned an error (per PRD §4.3) — otherwise the dialog reads as a
  // dead-end on transient failures.
  const showKeywordResults =
    !askActive ||
    (askState?.kind !== "loading" &&
      askState?.kind !== "answer" &&
      askState?.kind !== "no-evidence");

  return (
    <>
      {/* Search Button/Input in Top Bar */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "flex h-9 w-full items-center gap-2 rounded-md border border-input bg-background px-3 text-sm text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          className
        )}
      >
        <Sparkles className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="flex-1 text-left">Ask ComplyVault...</span>
        <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>

      {/* Search Dialog */}
      <CommandDialog open={open} onOpenChange={setOpen} className="sm:max-w-5xl">
        <div onKeyDownCapture={handleKeyDown}>
          <CommandInput
            placeholder="Ask anything across your meetings... (end with ? to ask)"
            value={query}
            onValueChange={setQuery}
          />
        </div>
        <CommandList>
          {askActive && askState && (
            <AnswerCard
              question={askedQuestion}
              state={askState}
              onOpenMeeting={handleSelect}
            />
          )}

          {isLoading && !askActive && (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          )}
          {!isLoading && !askActive && query.length < 2 && (
            <CommandEmpty>
              <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-2 px-4 py-6 text-sm text-muted-foreground">
                <span className="shrink-0">Try</span>
                {EXAMPLE_QUERIES.map((example, index) => (
                  <Fragment key={example}>
                    {index > 0 ? <span className="shrink-0">or</span> : null}
                    <button
                      type="button"
                      className={EXAMPLE_CHIP_CLASS}
                      onClick={() => handleExampleClick(example)}
                    >
                      {example}
                    </button>
                  </Fragment>
                ))}
              </div>
            </CommandEmpty>
          )}
          {!isLoading &&
            showKeywordResults &&
            query.length >= 2 &&
            results.length === 0 && (
              <CommandEmpty>No meetings found.</CommandEmpty>
            )}
          {showKeywordResults && results.length > 0 && (
            <CommandGroup heading={askActive ? "Related meetings" : "Meetings"}>
              {results.map((result) => (
                <CommandItem
                  key={result.id}
                  value={`${result.clientName} ${result.type} ${result.id}`}
                  onSelect={() => handleSelect(result.id)}
                  className="flex flex-col gap-2 py-3"
                  keywords={[result.clientName, result.type, result.matchType || ""]}
                >
                  <div className="flex items-center justify-between gap-2 w-full">
                    <div className="flex flex-col gap-1 flex-1 min-w-0">
                      <div className="font-medium truncate">{result.clientName}</div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{new Date(result.meetingDate).toLocaleDateString()}</span>
                        <span>•</span>
                        <span>{result.type}</span>
                        {result.matchType && (
                          <>
                            <span>•</span>
                            <Badge variant="outline" className="text-xs">
                              {result.matchType === "client" && "Client"}
                              {result.matchType === "date" && "Date"}
                              {result.matchType === "transcript" && "Transcript"}
                              {result.matchType === "field" && "Field"}
                            </Badge>
                          </>
                        )}
                      </div>
                    </div>
                    <Badge variant={getStatusVariant(result.status)} className="shrink-0">
                      {getStatusLabel(result.status)}
                    </Badge>
                  </div>
                  {result.snippet && (
                    <div className="text-xs text-muted-foreground line-clamp-2 pl-1">
                      &ldquo;{result.snippet}...&rdquo;
                    </div>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
