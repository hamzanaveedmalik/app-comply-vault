/**
 * Epic 1 Story 1.6: Teams meeting sidepanel
 * Actions: Generate Audit Pack, View Last Audit Pack, Check Status
 */

import Link from "next/link";
import { Button } from "~/components/ui/button";
import { FileText, Eye, RefreshCw } from "lucide-react";

export default function TeamsSidepanelPage() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.complyvault.co";
  const baseUrl = appUrl.replace(/\/$/, "");

  return (
    <div className="min-h-screen p-4 bg-background">
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">ComplyVault</h2>
        <p className="text-sm text-muted-foreground">
          Generate exam-ready audit packs from this meeting.
        </p>

        <div className="space-y-2">
          <Button asChild className="w-full justify-start" size="sm">
            <Link href={`${baseUrl}/dashboard`} target="_blank" rel="noopener noreferrer">
              <FileText className="h-4 w-4 mr-2" />
              Generate Audit Pack
            </Link>
          </Button>
          <Button asChild variant="outline" className="w-full justify-start" size="sm">
            <Link href={`${baseUrl}/dashboard`} target="_blank" rel="noopener noreferrer">
              <Eye className="h-4 w-4 mr-2" />
              View Last Audit Pack
            </Link>
          </Button>
          <Button asChild variant="outline" className="w-full justify-start" size="sm">
            <Link href={`${baseUrl}/dashboard`} target="_blank" rel="noopener noreferrer">
              <RefreshCw className="h-4 w-4 mr-2" />
              Check Status
            </Link>
          </Button>
        </div>

        <p className="text-xs text-muted-foreground pt-4">
          Meeting recordings are auto-synced when Teams is connected. Open ComplyVault in your
          browser to review and finalize.
        </p>
      </div>
    </div>
  );
}
