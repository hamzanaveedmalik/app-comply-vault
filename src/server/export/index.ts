import archiver from "archiver";
import type { Meeting, User, Version, Workspace } from "./types";
import type { ExtractionData } from "../extraction/types";
import type { TranscriptSegment } from "../transcription/types";
import { generateComplianceNotePDF } from "./pdf";
import { generateEvidenceMapCSV, generateVersionHistoryCSV } from "./csv";
import { canonicalTranscriptText } from "./txt";
import { buildExportPayload } from "./export-payload";
import type { FirmProfileExportSectionDto } from "~/lib/firm-profile-types";
import {
  ZIP_COMPRESSION_LEVEL,
  ZIP_ENTRY_EPOCH,
  formatUtcDate,
  resolvePackTimestamp,
  sortSegmentsByStart,
  sortVersions,
} from "./deterministic";

export type ExportFlag = {
  type: string;
  severity: string;
  status: string;
  evidence?: unknown;
};

type ExportData = {
  meeting: Meeting & { finalizedBy?: User | null };
  extraction: ExtractionData;
  transcript: { segments: TranscriptSegment[] } | null;
  versions: Version[];
  workspace: Workspace;
  flags: ExportFlag[];
  watermarked?: boolean;
  exportingUserName?: string;
  /** Optional Email Correspondence CSV (Email Intelligence Phase 2). */
  emailCorrespondenceCsv?: string | null;
  /**
   * Instant captured once for this pack (seal protocol start).
   * Injected into content; never wall-clock now.
   */
  packTimestamp?: Date;
  /** When provided, skips DB lookup (tests / seal path with preloaded profile). */
  firmDisclosureProfile?: FirmProfileExportSectionDto;
};

/**
 * Generate complete audit pack as ZIP buffer.
 * CV-TR-02a: fixed compression, fixed entry mtimes, deterministic entry order.
 */
export async function generateAuditPack(data: ExportData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const archive = archiver("zip", {
      zlib: { level: ZIP_COMPRESSION_LEVEL },
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

    (async () => {
      try {
        const {
          meeting,
          extraction,
          transcript,
          versions,
          workspace,
          flags,
          watermarked = false,
          exportingUserName,
          emailCorrespondenceCsv = null,
          packTimestamp: explicitPackTimestamp,
          firmDisclosureProfile: injectedProfile,
        } = data;

        const packTimestamp = resolvePackTimestamp({
          packTimestamp: explicitPackTimestamp,
          finalizedAt: meeting.finalizedAt,
          ccoSignedOffAt: meeting.ccoSignedOffAt,
          cmReviewedAt: meeting.cmReviewedAt,
          advisorCertifiedAt: meeting.advisorCertifiedAt,
          draftReadyAt: meeting.draftReadyAt,
          updatedAt: meeting.updatedAt,
          createdAt: meeting.createdAt,
        });

        const firmDisclosureProfile =
          injectedProfile ??
          (await (
            await import("~/server/firm-profile/get-firm-profile-summary-for-export")
          ).getFirmProfileSummaryForExport(workspace.id));

        const sortedVersions = sortVersions(versions);
        const sortedTranscript = transcript?.segments
          ? { segments: sortSegmentsByStart(transcript.segments) }
          : transcript;

        const append = (buf: Buffer, name: string): void => {
          archive.append(buf, { name, date: ZIP_ENTRY_EPOCH });
        };

        // 1. Branded PDF (PDFKit) — CreationDate locked to packTimestamp
        const payload = buildExportPayload(
          meeting,
          extraction,
          sortedTranscript,
          sortedVersions,
          workspace,
          flags,
          watermarked,
          {
            exportingUserName,
            firmDisclosureProfile,
            packTimestamp,
          },
        );
        const pdfBuffer = await generateComplianceNotePDF(payload);
        append(pdfBuffer, "01_Compliance_Note.pdf");

        // 2. Evidence Map CSV
        const evidenceMapCSV = generateEvidenceMapCSV(
          extraction,
          sortedTranscript?.segments,
        );
        const evidenceContent = watermarked
          ? `TRIAL EXPORT - WATERMARKED\n${evidenceMapCSV}`
          : evidenceMapCSV;
        append(Buffer.from(evidenceContent, "utf-8"), "02_Evidence_Map.csv");

        // 3. Version History CSV
        const versionHistoryCSV = generateVersionHistoryCSV(sortedVersions);
        const versionContent = watermarked
          ? `TRIAL EXPORT - WATERMARKED\n${versionHistoryCSV}`
          : versionHistoryCSV;
        append(Buffer.from(versionContent, "utf-8"), "03_Version_History.csv");

        // 4. Transcript TXT — canonical serialisation, byte-identical to what
        // Meeting.transcriptSha256 hashes (CV-TR-07).
        if (sortedTranscript?.segments) {
          const transcriptTXT = canonicalTranscriptText(sortedTranscript.segments);
          const transcriptContent = watermarked
            ? `TRIAL EXPORT - WATERMARKED\n${transcriptTXT}`
            : transcriptTXT;
          append(Buffer.from(transcriptContent, "utf-8"), "04_Transcript.txt");
        }

        // 5. Email Correspondence (optional)
        if (emailCorrespondenceCsv) {
          const emailContent = watermarked
            ? `TRIAL EXPORT - WATERMARKED\n${emailCorrespondenceCsv}`
            : emailCorrespondenceCsv;
          append(Buffer.from(emailContent, "utf-8"), "05_Email_Correspondence.csv");
        }

        // README.txt
        const readmeText = generateReadmeTXT(watermarked, Boolean(emailCorrespondenceCsv));
        append(Buffer.from(readmeText, "utf-8"), "README.txt");

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
 * Generate export filename.
 * Date component comes from meeting date (or packTimestamp), never wall-clock today.
 */
export function generateExportFilename(
  _workspaceName: string,
  clientName: string,
  options?: { watermarked?: boolean; date?: Date | string },
): string {
  const slugify = (str: string): string =>
    str
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_]/g, "")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "") || "client";

  const exportDate = options?.date
    ? formatUtcDate(options.date)
    : formatUtcDate(new Date(0));
  const suffix = options?.watermarked ? "_trial" : "";
  return `${slugify(clientName)}_${exportDate}_AuditPack${suffix}.zip`;
}

function generateReadmeTXT(watermarked: boolean, includeEmail = false): string {
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
    (includeEmail
      ? "05_Email_Correspondence.csv\n" +
        "  Client email threads in range with SHA-256 hashes, classification results,\n" +
        "  flags, dispositions, and reviewer identity.\n\n"
      : "") +
    "This pack is designed to satisfy examiner requests for source documentation.\n" +
    "complyvault.co"
  );
}
