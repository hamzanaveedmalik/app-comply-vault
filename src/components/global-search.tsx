"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2 } from "lucide-react";
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
}

interface GlobalSearchProps {
  className?: string;
}

export function GlobalSearch({ className }: GlobalSearchProps) {
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
        `/api/search?q=${encodeURIComponent(searchQuery)}`
      );
      if (!response.ok) {
        throw new Error("Search failed");
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
        onClick={() => setOpen(true)}
        className={cn(
          "flex h-9 w-full items-center gap-2 rounded-md border border-input bg-background px-3 text-sm text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          className
        )}
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="flex-1 text-left">Search meetings...</span>
        <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>

      {/* Search Dialog */}
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Search by client name, date, or keywords..."
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
              <div className="py-6 text-center text-sm text-muted-foreground">
                Type at least 2 characters to search...
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
                  value={result.id}
                  onSelect={() => handleSelect(result.id)}
                  className="flex items-center justify-between gap-2"
                >
                  <div className="flex flex-col gap-1 flex-1 min-w-0">
                    <div className="font-medium truncate">{result.clientName}</div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{new Date(result.meetingDate).toLocaleDateString()}</span>
                      <span>•</span>
                      <span>{result.type}</span>
                    </div>
                  </div>
                  <Badge variant={getStatusVariant(result.status)} className="shrink-0">
                    {getStatusLabel(result.status)}
                  </Badge>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}

