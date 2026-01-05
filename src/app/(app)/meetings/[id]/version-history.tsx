"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Separator } from "~/components/ui/separator";
import { Clock, User, FileEdit } from "lucide-react";

interface Version {
  id: string;
  version: number;
  editor: {
    id: string;
    name: string;
    email: string | null;
  };
  whatChanged: string;
  reason: string | null;
  timestamp: string; // ISO string
}

interface VersionHistoryProps {
  meetingId: string;
}

export default function VersionHistory({ meetingId }: VersionHistoryProps) {
  const [versions, setVersions] = useState<Version[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchVersions = async () => {
      try {
        const response = await fetch(`/api/meetings/${meetingId}/versions`);
        if (!response.ok) {
          throw new Error("Failed to fetch version history");
        }
        const data = await response.json();
        setVersions(data.versions || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An unknown error occurred");
      } finally {
        setIsLoading(false);
      }
    };

    fetchVersions();
  }, [meetingId]);

  if (isLoading) {
    return (
      <div className="text-sm text-muted-foreground py-4">
        Loading version history...
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-sm text-destructive py-4">
        Error: {error}
      </div>
    );
  }

  if (versions.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-4 text-center">
        No version history available. This meeting has not been edited yet.
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {versions.map((version, index) => {
        const date = new Date(version.timestamp);
        const isLast = index === versions.length - 1;
        
        return (
          <div key={version.id} className="relative">
            {/* Timeline line */}
            {!isLast && (
              <div className="absolute left-6 top-12 bottom-0 w-0.5 bg-border" />
            )}
            
            <div className="flex gap-4 pb-6">
              {/* Timeline dot */}
              <div className="relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-primary bg-background">
                <FileEdit className="h-5 w-5 text-primary" />
              </div>
              
              {/* Content */}
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono">
                    v{version.version}
                  </Badge>
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <User className="h-3.5 w-3.5" />
                    <span className="font-medium">{version.editor.name}</span>
                  </div>
                  <Separator orientation="vertical" className="h-4" />
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    <time dateTime={version.timestamp}>
                      {date.toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                      {" at "}
                      {date.toLocaleTimeString("en-US", {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </time>
                  </div>
                </div>
                
                <div className="rounded-md border bg-card p-3">
                  <p className="text-sm font-medium text-foreground">
                    {version.whatChanged}
                  </p>
                  {version.reason && (
                    <div className="mt-2 pt-2 border-t">
                      <p className="text-xs text-muted-foreground">
                        <span className="font-medium">Reason:</span> {version.reason}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
