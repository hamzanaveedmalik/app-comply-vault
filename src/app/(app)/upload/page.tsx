"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Alert, AlertDescription } from "~/components/ui/alert";

export default function UploadPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [clientName, setClientName] = useState("");
  const [meetingType, setMeetingType] = useState("");
  const [meetingDate, setMeetingDate] = useState("");
  const [consent, setConsent] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!file) {
      setError("Please select a file");
      return;
    }

    setIsUploading(true);

    try {
      // Convert datetime-local format to ISO string
      // datetime-local returns "YYYY-MM-DDTHH:mm" format
      const dateISO = meetingDate ? new Date(meetingDate).toISOString() : new Date().toISOString();

      // Step 1: Initialize upload - get presigned URL
      let initResponse;
      try {
        initResponse = await fetch("/api/upload/init", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            clientName,
            meetingType,
            meetingDate: dateISO,
            consent,
            fileName: file.name,
            fileSize: file.size,
          }),
        });
      } catch (err) {
        throw new Error(`Network error: ${err instanceof Error ? err.message : "Failed to connect to server"}`);
      }

      if (!initResponse.ok) {
        let errorMessage = "Failed to initialize upload";
        try {
          const data = await initResponse.json();
          if (data.error) {
            if (Array.isArray(data.error)) {
              errorMessage = data.error.map((e: any) => e.message || e).join(", ");
            } else if (typeof data.error === "string") {
              errorMessage = data.error;
            } else if (data.error?.message) {
              errorMessage = data.error.message;
            }
          }
        } catch {
          errorMessage = `Server error: ${initResponse.status} ${initResponse.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const initData = await initResponse.json();
      const { meetingId, uploadUrl } = initData;

      if (!meetingId) {
        throw new Error("No meeting ID received from server");
      }

      if (!uploadUrl) {
        throw new Error("No upload URL received from server");
      }

      // Validate meetingId is present (Prisma uses CUID format, not UUID)
      if (typeof meetingId !== "string" || meetingId.length === 0) {
        console.error("Invalid meetingId:", meetingId);
        throw new Error(`Invalid meeting ID: ${meetingId}`);
      }

      // Step 2: Upload file directly to S3/R2 using presigned URL
      let uploadResponse;
      try {
        // Note: Don't set Content-Type header if it's in the presigned URL
        // Some S3-compatible services require exact header match
        const headers: HeadersInit = {};
        if (file.type) {
          headers["Content-Type"] = file.type;
        }
        
        uploadResponse = await fetch(uploadUrl, {
          method: "PUT",
          body: file,
          headers,
        });
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Network error";
        throw new Error(`Upload to storage failed: ${errorMsg}. Check CORS configuration on your R2 bucket.`);
      }

      if (!uploadResponse.ok) {
        throw new Error(`Upload failed: ${uploadResponse.status} ${uploadResponse.statusText}`);
      }

      // Step 3: Notify API that upload is complete
      let completeResponse;
      try {
        completeResponse = await fetch("/api/upload/complete", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ meetingId }),
        });
      } catch (err) {
        throw new Error(`Failed to complete upload: ${err instanceof Error ? err.message : "Network error"}`);
      }

      if (!completeResponse.ok) {
        let errorMessage = "Failed to complete upload";
        try {
          const data = await completeResponse.json();
          errorMessage = data.error || errorMessage;
        } catch {
          errorMessage = `Server error: ${completeResponse.status} ${completeResponse.statusText}`;
        }
        throw new Error(errorMessage);
      }

      // Redirect to meeting detail page
      router.push(`/meetings/${meetingId}`);
    } catch (err) {
      let errorMessage = "An error occurred";
      if (err instanceof Error) {
        errorMessage = err.message;
      } else if (typeof err === "string") {
        errorMessage = err;
      } else {
        errorMessage = JSON.stringify(err);
      }
      setError(errorMessage);
      setIsUploading(false);
      console.error("Upload error:", err);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Upload Meeting</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Upload a meeting recording to process it into a compliance record
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Meeting Details</CardTitle>
          <CardDescription>
            Provide the meeting information and recording file
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="file">Recording File</Label>
              <Input
                id="file"
                type="file"
                accept=".mp3,.mp4,.wav,.m4a"
                onChange={handleFileChange}
                className="cursor-pointer"
                required
              />
              <p className="text-xs text-muted-foreground">
                Supported formats: MP3, MP4, WAV, M4A (max 500 MB)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="clientName">Client Name</Label>
              <Input
                id="clientName"
                type="text"
                required
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="John Smith"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="meetingType">Meeting Type</Label>
              <Input
                id="meetingType"
                type="text"
                required
                value={meetingType}
                onChange={(e) => setMeetingType(e.target.value)}
                placeholder="e.g., Annual Review, Portfolio Review"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="meetingDate">Meeting Date</Label>
              <Input
                id="meetingDate"
                type="datetime-local"
                required
                value={meetingDate}
                onChange={(e) => setMeetingDate(e.target.value)}
              />
            </div>

            <div className="flex items-start space-x-2">
              <input
                id="consent"
                type="checkbox"
                required
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <Label htmlFor="consent" className="font-normal">
                I confirm I have permission to upload and process this recording
              </Label>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="flex gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                disabled={isUploading}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isUploading || !file || !consent}
                className="flex-1"
              >
                {isUploading ? "Uploading..." : "Upload"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}


