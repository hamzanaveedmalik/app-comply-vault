"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Textarea } from "~/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Badge } from "~/components/ui/badge";

export default function InviteUserPage() {
  const router = useRouter();
  const params = useParams();
  const workspaceId = params.workspaceId as string;

  const [mode, setMode] = useState<"single" | "bulk">("single");
  
  // Single invite state
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"OWNER_CCO" | "MEMBER" | "ADVISOR">("MEMBER");
  
  // Bulk invite state
  const [bulkEmails, setBulkEmails] = useState("");
  const [bulkRole, setBulkRole] = useState<"OWNER_CCO" | "MEMBER" | "ADVISOR">("MEMBER");
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [bulkResults, setBulkResults] = useState<{
    created: number;
    resent: number;
    skipped: number;
  } | null>(null);

  const handleSingleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/invitations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, role }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to send invitation");
      }

      setSuccess("Invitation sent successfully!");
      setEmail("");
      setTimeout(() => {
        router.push("/dashboard");
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setIsLoading(false);
    }
  };

  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    setBulkResults(null);

    try {
      // Parse emails from textarea (one per line, comma-separated, or space-separated)
      const emailLines = bulkEmails
        .split(/[\n,;]/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

      // Validate emails
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const validEmails = emailLines.filter((email) => emailRegex.test(email));
      const invalidEmails = emailLines.filter((email) => !emailRegex.test(email));

      if (invalidEmails.length > 0) {
        throw new Error(`Invalid email addresses: ${invalidEmails.join(", ")}`);
      }

      if (validEmails.length === 0) {
        throw new Error("Please enter at least one valid email address");
      }

      if (validEmails.length > 50) {
        throw new Error("Maximum 50 invitations at once");
      }

      // Create invitations array
      const invitations = validEmails.map((email) => ({
        email,
        role: bulkRole,
      }));

      const response = await fetch(`/api/workspaces/${workspaceId}/invitations/bulk`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ invitations }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to send invitations");
      }

      const data = await response.json();
      setBulkResults({
        created: data.summary.created,
        resent: data.summary.resent,
        skipped: data.summary.skipped,
      });
      setSuccess(`Successfully processed ${data.summary.created + data.summary.resent} invitation(s)!`);
      setBulkEmails("");
      setIsLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Invite Team Members</CardTitle>
          <CardDescription>
            Invite users to join your workspace. You can invite one at a time or multiple users at once.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={mode} onValueChange={(value) => setMode(value as "single" | "bulk")} variant="underline">
            <TabsList className="w-full">
              <TabsTrigger value="single">Single Invite</TabsTrigger>
              <TabsTrigger value="bulk">Bulk Invite</TabsTrigger>
            </TabsList>

            {error && (
              <Alert variant="destructive" className="mt-4">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {success && (
              <Alert className="mt-4">
                <AlertDescription>{success}</AlertDescription>
              </Alert>
            )}

            {bulkResults && (
              <Alert className="mt-4">
                <AlertDescription>
                  <div className="space-y-2">
                    <p><strong>Results:</strong></p>
                    <div className="flex gap-4">
                      <Badge variant="default">{bulkResults.created} Created</Badge>
                      <Badge variant="secondary">{bulkResults.resent} Resent</Badge>
                      {bulkResults.skipped > 0 && (
                        <Badge variant="outline">{bulkResults.skipped} Skipped</Badge>
                      )}
                    </div>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            <TabsContent value="single" className="space-y-6 mt-6">
              <form onSubmit={handleSingleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="user@example.com"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Select value={role} onValueChange={(value) => setRole(value as "OWNER_CCO" | "MEMBER" | "ADVISOR")}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MEMBER">Compliance Manager</SelectItem>
                      <SelectItem value="ADVISOR">Advisor</SelectItem>
                      <SelectItem value="OWNER_CCO">Owner/CCO</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Advisors certify transcripts. Compliance Managers triage flags. Owners/CCOs sign off and finalize.
                  </p>
                </div>

                <div className="flex gap-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.back()}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isLoading || !email.trim()}
                    className="flex-1"
                  >
                    {isLoading ? "Sending..." : "Send Invitation"}
                  </Button>
                </div>
              </form>
            </TabsContent>

            <TabsContent value="bulk" className="space-y-6 mt-6">
              <form onSubmit={handleBulkSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="bulkEmails">Email Addresses</Label>
                  <Textarea
                    id="bulkEmails"
                    value={bulkEmails}
                    onChange={(e) => setBulkEmails(e.target.value)}
                    placeholder="Enter email addresses, one per line or separated by commas:&#10;user1@example.com&#10;user2@example.com&#10;user3@example.com"
                    rows={8}
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter one email per line, or separate by commas. Maximum 50 invitations at once.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bulkRole">Role for All Invitations</Label>
                  <Select value={bulkRole} onValueChange={(value) => setBulkRole(value as "OWNER_CCO" | "MEMBER" | "ADVISOR")}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MEMBER">Compliance Manager</SelectItem>
                      <SelectItem value="ADVISOR">Advisor</SelectItem>
                      <SelectItem value="OWNER_CCO">Owner/CCO</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    All invitations will be sent with this role. You can change individual roles later if needed.
                  </p>
                </div>

                <div className="flex gap-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.back()}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isLoading || !bulkEmails.trim()}
                    className="flex-1"
                  >
                    {isLoading ? "Sending..." : "Send Invitations"}
                  </Button>
                </div>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
