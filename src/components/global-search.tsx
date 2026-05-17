"use client";

import { Fragment, useState, useEffect, useCallback } from "react";
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

export function GlobalSearch({ className }: GlobalSearchProps): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
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

  // Debounced search
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

  const performSearch = useCallback(async (searchQuery: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/search?q=${encodeURIComponent(searchQuery)}`,
        {
          credentials: "include", // Ensure cookies are sent
        }
      );
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("Search failed:", response.status, errorData);
        throw new Error(errorData.error || "Search failed");
      }
      const data = await response.json();
      console.log("[GlobalSearch] Results received:", data.results?.length || 0, "for query:", searchQuery);
      if (data.results && data.results.length > 0) {
        console.log("[GlobalSearch] Sample results:", data.results.slice(0, 3).map((r: SearchResult) => ({
          id: r.id,
          clientName: r.clientName,
          matchType: r.matchType,
        })));
      }
      setResults(data.results || []);
    } catch (error) {
      console.error("Search error:", error);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleSelect = (meetingId: string) => {
    setOpen(false);
    setQuery("");
    router.push(`/meetings/${meetingId}`);
  };

  const getStatusVariant = (status: string): "default" | "secondary" | "outline" | "destructive" => {
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
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Ask anything across your meetings..."
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          {isLoading && (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          )}
          {!isLoading && query.length < 2 && (
            <CommandEmpty>
              <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-2 px-4 py-6 text-sm text-muted-foreground">
                <span className="shrink-0">Try</span>
                {EXAMPLE_QUERIES.map((example, index) => (
                  <Fragment key={example}>
                    {index > 0 ? <span className="shrink-0">or</span> : null}
                    <button
                      type="button"
                      className={EXAMPLE_CHIP_CLASS}
                      onClick={() => setQuery(example)}
                    >
                      {example}
                    </button>
                  </Fragment>
                ))}
              </div>
            </CommandEmpty>
          )}
          {!isLoading && query.length >= 2 && results.length === 0 && (
            <CommandEmpty>No meetings found.</CommandEmpty>
          )}
          {!isLoading && results.length > 0 && (
            <CommandGroup heading="Meetings">
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
                      "{result.snippet}..."
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

