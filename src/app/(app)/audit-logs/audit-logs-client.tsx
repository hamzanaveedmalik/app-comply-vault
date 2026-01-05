"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Badge } from "~/components/ui/badge";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Download } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";

interface AuditEvent {
  id: string;
  timestamp: string;
  action: string;
  resourceType: string;
  resourceId: string;
  metadata: any;
  user: {
    id: string;
    name: string | null;
    email: string | null;
  };
  meeting: {
    id: string;
    clientName: string;
    meetingDate: string;
  } | null;
}

interface AuditLogsClientProps {
  initialEvents: AuditEvent[];
  initialTotal: number;
  initialFilters: {
    userId: string;
    action: string;
    resourceType: string;
    dateFrom: string;
    dateTo: string;
  };
  error: string | null;
}

const getActionVariant = (action: string): "default" | "secondary" | "destructive" | "outline" => {
  switch (action) {
    case "UPLOAD":
      return "default";
    case "VIEW":
      return "secondary";
    case "EDIT":
      return "outline";
    case "FINALIZE":
      return "default";
    case "EXPORT":
      return "secondary";
    case "DELETE":
      return "destructive";
    default:
      return "secondary";
  }
};

export default function AuditLogsClient({
  initialEvents,
  initialTotal,
  initialFilters,
  error,
}: AuditLogsClientProps) {
  const router = useRouter();
  const [filters, setFilters] = useState(initialFilters);
  const [isExporting, setIsExporting] = useState(false);

  const handleFilterChange = (key: string, value: string) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);

    const params = new URLSearchParams();
    Object.entries(newFilters).forEach(([k, v]) => {
      if (v) params.set(k, v);
    });

    router.push(`/audit-logs?${params.toString()}`);
  };

  const clearFilters = () => {
    setFilters({
      userId: "",
      action: "",
      resourceType: "",
      dateFrom: "",
      dateTo: "",
    });
    router.push("/audit-logs");
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([k, v]) => {
        if (v) params.set(k, v);
      });

      const response = await fetch(`/api/audit-logs/export?${params.toString()}`);
      if (!response.ok) {
        throw new Error("Failed to export audit logs");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit-logs-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error("Error exporting audit logs:", err);
      alert("Failed to export audit logs. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <Label htmlFor="action">Action</Label>
              <Select
                value={filters.action || "all"}
                onValueChange={(value) => handleFilterChange("action", value === "all" ? "" : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All actions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All actions</SelectItem>
                  <SelectItem value="UPLOAD">Upload</SelectItem>
                  <SelectItem value="VIEW">View</SelectItem>
                  <SelectItem value="EDIT">Edit</SelectItem>
                  <SelectItem value="FINALIZE">Finalize</SelectItem>
                  <SelectItem value="EXPORT">Export</SelectItem>
                  <SelectItem value="DELETE">Delete</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="resourceType">Resource Type</Label>
              <Input
                id="resourceType"
                value={filters.resourceType}
                onChange={(e) => handleFilterChange("resourceType", e.target.value)}
                placeholder="e.g., meeting"
              />
            </div>
            <div>
              <Label htmlFor="dateFrom">Date From</Label>
              <Input
                id="dateFrom"
                type="date"
                value={filters.dateFrom}
                onChange={(e) => handleFilterChange("dateFrom", e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="dateTo">Date To</Label>
              <Input
                id="dateTo"
                type="date"
                value={filters.dateTo}
                onChange={(e) => handleFilterChange("dateTo", e.target.value)}
              />
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={clearFilters} className="w-full sm:w-auto">
              Clear Filters
            </Button>
            <Button onClick={handleExport} disabled={isExporting} className="w-full sm:w-auto">
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Audit Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            Audit Events ({initialTotal})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {initialEvents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No audit events found matching your filters.
            </div>
          ) : (
            <div className="overflow-x-auto -mx-6 sm:mx-0">
              <div className="inline-block min-w-full align-middle px-6 sm:px-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="whitespace-nowrap">Timestamp</TableHead>
                      <TableHead className="whitespace-nowrap">User</TableHead>
                      <TableHead className="whitespace-nowrap">Action</TableHead>
                      <TableHead className="whitespace-nowrap">Resource</TableHead>
                      <TableHead className="whitespace-nowrap">Meeting</TableHead>
                      <TableHead className="whitespace-nowrap">Metadata</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {initialEvents.map((event) => (
                      <TableRow key={event.id}>
                        <TableCell className="font-mono text-xs whitespace-nowrap">
                          {new Date(event.timestamp).toLocaleString()}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <div className="text-sm">
                            {event.user.name || event.user.email || event.user.id}
                          </div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <Badge variant={getActionVariant(event.action)}>
                            {event.action}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm min-w-[100px]">
                            <div className="font-medium">{event.resourceType}</div>
                            <div className="text-xs text-muted-foreground font-mono truncate max-w-[120px]">
                              {event.resourceId}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {event.meeting ? (
                            <div className="text-sm min-w-[120px]">
                              <div className="font-medium">{event.meeting.clientName}</div>
                              <div className="text-xs text-muted-foreground">
                                {new Date(event.meeting.meetingDate).toLocaleDateString()}
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {event.metadata ? (
                            <details className="text-xs">
                              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                                View metadata
                              </summary>
                              <pre className="mt-2 whitespace-pre-wrap break-words max-w-md text-xs bg-muted p-2 rounded">
                                {JSON.stringify(event.metadata, null, 2)}
                              </pre>
                            </details>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

