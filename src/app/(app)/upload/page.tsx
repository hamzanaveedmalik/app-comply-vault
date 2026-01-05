"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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
      // Step 1: Initialize upload - get presigned URL
      const initResponse = await fetch("/api/upload/init", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          clientName,
          meetingType,
          meetingDate: new Date(meetingDate).toISOString(),
          consent,
          fileName: file.name,
          fileSize: file.size,
        }),
      });

      if (!initResponse.ok) {
        const data = await initResponse.json().catch(() => ({ error: "Failed to initialize upload" }));
        throw new Error(data.error || "Failed to initialize upload");
      }

      const { meetingId, uploadUrl } = await initResponse.json();

      // Step 2: Upload file directly to S3/R2 using presigned URL
      const uploadResponse = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": file.type || "application/octet-stream",
        },
      });

      if (!uploadResponse.ok) {
        throw new Error(`Upload failed: ${uploadResponse.statusText}`);
      }

      // Step 3: Notify API that upload is complete
      const completeResponse = await fetch("/api/upload/complete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ meetingId }),
      });

      if (!completeResponse.ok) {
        const data = await completeResponse.json().catch(() => ({ error: "Failed to complete upload" }));
        throw new Error(data.error || "Failed to complete upload");
      }

      // Redirect to meeting detail page
      router.push(`/meetings/${meetingId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setIsUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Upload Meeting</h1>
          <p className="mt-2 text-sm text-gray-600">
            Upload a meeting recording to process it into a compliance record
          </p>
        </div>

        <div className="rounded-lg bg-white p-8 shadow">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label
                htmlFor="file"
                className="block text-sm font-medium text-gray-700"
              >
                Recording File
              </label>
              <input
                id="file"
                type="file"
                accept=".mp3,.mp4,.wav,.m4a"
                onChange={handleFileChange}
                className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:rounded-md file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-blue-700 hover:file:bg-blue-100"
                required
              />
              <p className="mt-1 text-xs text-gray-500">
                Supported formats: MP3, MP4, WAV, M4A (max 500 MB)
              </p>
            </div>

            <div>
              <label
                htmlFor="clientName"
                className="block text-sm font-medium text-gray-700"
              >
                Client Name
              </label>
              <input
                id="clientName"
                type="text"
                required
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                placeholder="John Smith"
              />
            </div>

            <div>
              <label
                htmlFor="meetingType"
                className="block text-sm font-medium text-gray-700"
              >
                Meeting Type
              </label>
              <input
                id="meetingType"
                type="text"
                required
                value={meetingType}
                onChange={(e) => setMeetingType(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                placeholder="e.g., Annual Review, Portfolio Review"
              />
            </div>

            <div>
              <label
                htmlFor="meetingDate"
                className="block text-sm font-medium text-gray-700"
              >
                Meeting Date
              </label>
              <input
                id="meetingDate"
                type="datetime-local"
                required
                value={meetingDate}
                onChange={(e) => setMeetingDate(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
              />
            </div>

            <div className="flex items-start">
              <input
                id="consent"
                type="checkbox"
                required
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label
                htmlFor="consent"
                className="ml-2 block text-sm text-gray-700"
              >
                I confirm I have permission to upload and process this recording
              </label>
            </div>

            {error && (
              <div className="rounded-md bg-red-50 p-3">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => router.back()}
                className="flex-1 rounded-md border border-gray-300 bg-white px-4 py-2 font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                disabled={isUploading}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isUploading || !file || !consent}
                className="flex-1 rounded-md bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isUploading ? "Uploading..." : "Upload"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}


