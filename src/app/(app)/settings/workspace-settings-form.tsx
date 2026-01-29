"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";

type Workspace = {
  id: string;
  name: string;
  retentionYears: number;
  legalHold: boolean;
  billingStatus: string;
};

export function WorkspaceSettingsForm({
  workspace,
  members,
  currentUserId,
}: {
  workspace: Workspace;
  members: Array<{
    userId: string;
    role: "OWNER_CCO" | "MEMBER";
    name: string | null;
    email: string | null;
  }>;
  currentUserId: string;
}) {
  const router = useRouter();
  const [retentionYears, setRetentionYears] = useState(workspace.retentionYears);
  const [legalHold, setLegalHold] = useState(workspace.legalHold);
  const [isSaving, setIsSaving] = useState(false);
  const [isRemoving, setIsRemoving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await fetch(`/api/workspaces/${workspace.id}/settings`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          retentionYears,
          legalHold,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update settings");
      }

      setSuccess(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    setIsRemoving(userId);
    setError(null);
    try {
      const response = await fetch(`/api/workspaces/${workspace.id}/members/${userId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to remove member");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsRemoving(null);
    }
  };

  const billingLabel =
    workspace.billingStatus === "PILOT"
      ? "Pilot"
      : workspace.billingStatus === "TRIALING"
      ? "Trialing"
      : workspace.billingStatus === "ACTIVE"
      ? "Active"
      : workspace.billingStatus === "PAST_DUE"
      ? "Past Due"
      : "Canceled";

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Workspace Information</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Workspace Name</dt>
              <dd className="mt-1 text-sm">{workspace.name}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Billing Status</dt>
              <dd className="mt-1">
                <Badge variant="secondary">
                  {billingLabel}
                </Badge>
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Team Members</CardTitle>
          <CardDescription>
            Invite team members and assign roles for this workspace.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Button asChild>
              <Link href={`/workspaces/${workspace.id}/invite`}>Invite Team Members</Link>
            </Button>
            <div className="space-y-2">
              {members.map((member) => {
                const label = member.name || member.email || member.userId;
                const isCurrentUser = member.userId === currentUserId;
                return (
                  <div
                    key={member.userId}
                    className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                  >
                    <div>
                      <div className="font-medium">
                        {label} {isCurrentUser ? "(You)" : ""}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {member.role === "OWNER_CCO" ? "Owner/CCO" : "Member"}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {member.role === "OWNER_CCO" && (
                        <Badge variant="secondary">Owner</Badge>
                      )}
                      {!isCurrentUser && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isRemoving === member.userId}
                          onClick={() => handleRemoveMember(member.userId)}
                        >
                          {isRemoving === member.userId ? "Removing..." : "Remove"}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Retention & Legal Hold</CardTitle>
          <CardDescription>
            Configure data retention and legal hold settings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="retentionYears">Retention Years (Minimum 5)</Label>
              <Input
                id="retentionYears"
                type="number"
                min={5}
                max={10}
                value={retentionYears}
                onChange={(e) => setRetentionYears(parseInt(e.target.value, 10))}
              />
              <p className="text-xs text-muted-foreground">
                SEC requires minimum 5 years retention. Default is 6 years.
              </p>
            </div>

            <div className="flex items-start space-x-2">
              <input
                id="legalHold"
                type="checkbox"
                checked={legalHold}
                onChange={(e) => setLegalHold(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <div className="space-y-1">
                <Label htmlFor="legalHold" className="font-normal">
                  Legal Hold
                </Label>
                <p className="text-xs text-muted-foreground">
                  When enabled, prevents deletion of workspace data
                </p>
              </div>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {success && (
              <Alert>
                <AlertDescription>Settings updated successfully</AlertDescription>
              </Alert>
            )}

            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Saving..." : "Save Settings"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

