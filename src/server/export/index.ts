import archiver from "archiver";
import type { Meeting, User, Version, Workspace } from "./types";
import type { ExtractionData } from "../extraction/types";
import type { TranscriptSegment } from "../transcription/types";
import { generateComplianceNotePDF } from "./pdf";
import { generateEvidenceMapCSV, generateVersionHistoryCSV } from "./csv";
import { generateTranscriptTXT } from "./txt";
import { buildExportPayload } from "./python-pdf";
import { generateBrandedPDF } from "./pdf-branded";

export interface ExportFlag {
  type: string;
  severity: string;
  status: string;
  evidence?: unknown;
}

interface ExportData {
  meeting: Meeting & { finalizedBy?: User | null };
  extraction: ExtractionData;
  transcript: { segments: TranscriptSegment[] } | null;
  versions: Version[];
  workspace: Workspace;
  flags: ExportFlag[];
  watermarked?: boolean;
}

/**
 * Generate complete audit pack as ZIP buffer
 */
export async function generateAuditPack(data: ExportData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const archive = archiver("zip", {
      zlib: { level: 9 }, // Maximum compression
    });

    const buffers: Buffer[] = [];
    archive.on("data", (chunk: Buffer) => buffers.push(chunk));
    archive.on("end", () => {
      const zipBuffer = Buffer.concat(buffers);
      resolve(zipBuffer);
    });
    archive.on("error", (err) => {
      console.error("Archiver error:", err);
      reject(err);
    });

    // Use async IIFE to handle async operations
    (async () => {
      try {
        const { meeting, extraction, transcript, versions, workspace, flags, watermarked = false } = data;

        // Slugify: lowercase, letters/numbers/underscores only, spaces → underscores
        const slugify = (str: string): string => {
          return str
            .toLowerCase()
            .replace(/\s+/g, "_")
            .replace(/[^a-z0-9_]/g, "")
            .replace(/_+/g, "_")
            .replace(/^_|_$/g, "") || "client";
        };

        // 1. Generate branded PDF (PDFKit, works on Vercel; silent fallback to jsPDF)
        let pdfBuffer: Buffer;
        try {
          const payload = buildExportPayload(
            meeting,
            extraction,
            transcript,
            versions,
            workspace,
            flags,
            watermarked
          );
          pdfBuffer = await generateBrandedPDF(payload);
        } catch {
          pdfBuffer = await generateComplianceNotePDF({
            meeting,
            extraction,
            workspaceName: workspace.name,
            watermarked,
          });
        }
        archive.append(pdfBuffer, { name: "01_Compliance_Note.pdf" });

        // 2. Evidence Map CSV
        const evidenceMapCSV = generateEvidenceMapCSV(
          extraction,
          transcript?.segments
        );
        const evidenceContent = watermarked
          ? `TRIAL EXPORT - WATERMARKED\n${evidenceMapCSV}`
          : evidenceMapCSV;
        archive.append(Buffer.from(evidenceContent, "utf-8"), {
          name: "02_Evidence_Map.csv",
        });

        // 3. Version History CSV
        const versionHistoryCSV = generateVersionHistoryCSV(versions);
        const versionContent = watermarked
          ? `TRIAL EXPORT - WATERMARKED\n${versionHistoryCSV}`
          : versionHistoryCSV;
        archive.append(Buffer.from(versionContent, "utf-8"), {
          name: "03_Version_History.csv",
        });

        // 4. Transcript TXT
        if (transcript?.segments) {
          const transcriptTXT = generateTranscriptTXT(transcript.segments);
          const transcriptContent = watermarked
            ? `TRIAL EXPORT - WATERMARKED\n${transcriptTXT}`
            : transcriptTXT;
          archive.append(Buffer.from(transcriptContent, "utf-8"), {
            name: "04_Transcript.txt",
          });
        }

        // 5. README.txt
        const readmeText = generateReadmeTXT(watermarked);
        archive.append(Buffer.from(readmeText, "utf-8"), { name: "README.txt" });

        // Finalize the archive
        archive.finalize().catch((err) => {
          console.error("Archive finalize error:", err);
          reject(err);
        });
      } catch (error) {
        console.error("Error in generateAuditPack:", error);
        reject(error);
      }
    })();
  });
}

/**
 * Generate export filename
 * Format: [SlugifiedClientName]_[YYYY-MM-DD]_AuditPack.zip
 */
export function generateExportFilename(
  _workspaceName: string,
  clientName: string,
  options?: { watermarked?: boolean }
): string {
  const slugify = (str: string): string =>
    str
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_]/g, "")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "") || "client";

  const exportDate = new Date().toISOString().split("T")[0];
  const suffix = options?.watermarked ? "_trial" : "";
  return `${slugify(clientName)}_${exportDate}_AuditPack${suffix}.zip`;
}

function generateReadmeTXT(watermarked: boolean): string {
  const prefix = watermarked ? "TRIAL EXPORT - WATERMARKED\n\n" : "";
  return (
    prefix +
    "ComplyVault Audit Pack Contents\n" +
    "====================================\n\n" +
    "01_Compliance_Note.pdf\n" +
    "  Branded compliance note containing cover summary, structured compliance sections\n" +
    "  (topics, recommendations, disclosures), evidence map, and advisor sign-off.\n\n" +
    "02_Evidence_Map.csv\n" +
    "  Links each compliance claim to its source in the meeting transcript.\n\n" +
    "03_Version_History.csv\n" +
    "  Full audit trail of edits to the compliance note.\n\n" +
    "04_Transcript.txt\n" +
    "  Speaker-labeled, timestamped transcript in [HH:MM:SS] Speaker: text format.\n\n" +
    "This pack is designed to satisfy examiner requests for source documentation.\n" +
    "complyvault.co"
  );
}
