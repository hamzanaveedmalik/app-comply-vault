"use client";

import { Button } from "~/components/ui/button";
import { Download } from "lucide-react";

export function TeamsManifestClient() {
  const handleDownload = () => {
    window.location.href = "/api/integrations/teams/manifest";
  };

  return (
    <Button onClick={handleDownload}>
      <Download className="h-4 w-4 mr-2" />
      Download Manifest (JSON)
    </Button>
  );
}
