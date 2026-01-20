import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type { ExtractionData } from "../extraction/types";
import type { Meeting, User } from "./types";

interface GeneratePDFOptions {
  meeting: Meeting & { finalizedBy?: User | null };
  extraction: ExtractionData;
  workspaceName: string;
}

let pdfkitFontPatched = false;

function patchPdfkitStandardFonts() {
  if (pdfkitFontPatched) {
    return;
  }

  const originalReadFileSync = fs.readFileSync.bind(fs);
  
  // In Next.js standalone/serverless, the AFM files are in the API route directory
  // Try multiple possible locations
  const possibleDataDirs = [
    // Development
    path.join(process.cwd(), "src", "app", "api", "meetings", "[id]", "export", "data"),
    // Production serverless bundle (relative to .next/server)
    path.join(process.cwd(), ".next", "server", "app", "api", "meetings", "[id]", "export", "data"),
    // Standalone output
    path.join(process.cwd(), "app", "api", "meetings", "[id]", "export", "data"),
  ];
  
  const fontFiles = new Set([
    "Helvetica.afm",
    "Helvetica-Bold.afm",
    "Helvetica-Oblique.afm",
    "Helvetica-BoldOblique.afm",
  ]);

  fs.readFileSync = ((filePath: fs.PathLike, options?: { encoding?: BufferEncoding } | BufferEncoding) => {
    const rawPath = typeof filePath === "string" ? filePath : filePath.toString();
    const basename = path.basename(rawPath);

    if (rawPath.includes(`${path.sep}data${path.sep}`) && fontFiles.has(basename)) {
      // Try each possible location
      for (const dataDir of possibleDataDirs) {
        const localFontPath = path.join(dataDir, basename);
        try {
          if (fs.existsSync(localFontPath)) {
            return originalReadFileSync(localFontPath, options as any);
          }
        } catch (e) {
          // Continue to next location
        }
      }
    }

    return originalReadFileSync(filePath as any, options as any);
  }) as typeof fs.readFileSync;

  pdfkitFontPatched = true;
}

/**
 * Generate structured compliance note as PDF
 * Returns PDF buffer
 */
export async function generateComplianceNotePDF({
  meeting,
  extraction,
  workspaceName,
}: GeneratePDFOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      patchPdfkitStandardFonts();

      const doc = new PDFDocument({
        margin: 50,
        size: "LETTER",
      });

      const buffers: Buffer[] = [];
      doc.on("data", (chunk: Buffer) => {
        buffers.push(chunk);
      });
      doc.on("end", () => {
        const pdfBuffer = Buffer.concat(buffers);
        resolve(pdfBuffer);
      });
      doc.on("error", (err) => {
        console.error("PDFDocument stream error:", err);
        reject(err);
      });

      // Header
      doc.fontSize(20);
      doc.font("Helvetica-Bold");
      doc.text("Client Interaction Record", { align: "center" });
      doc.moveDown(0.5);
      doc.fontSize(12);
      doc.font("Helvetica");
      doc.text(workspaceName || "Comply Vault", { align: "center" });
      doc.moveDown(1);

      // Client Information Section
      doc.fontSize(14);
      doc.font("Helvetica-Bold");
      doc.text("Client Information", { underline: true });
      doc.moveDown(0.3);
      doc.fontSize(11);
      doc.font("Helvetica");
      doc.text(`Client Name: ${meeting.clientName || "N/A"}`);
      doc.text(`Meeting Type: ${meeting.meetingType || "N/A"}`);
      doc.text(`Meeting Date: ${meeting.meetingDate ? new Date(meeting.meetingDate).toLocaleDateString() : "N/A"}`);
      doc.moveDown(1);

      // Topics Section
      if (extraction.topics && extraction.topics.length > 0) {
        doc.fontSize(14);
        doc.font("Helvetica-Bold");
        doc.text("Topics Discussed", { underline: true });
        doc.moveDown(0.3);
        doc.fontSize(11);
        doc.font("Helvetica");
        extraction.topics.forEach((topic, index) => {
          doc.text(`${index + 1}. ${topic || "N/A"}`);
        });
        doc.moveDown(1);
      }

      // Recommendations Section
      if (extraction.recommendations && extraction.recommendations.length > 0) {
        doc.fontSize(14);
        doc.font("Helvetica-Bold");
        doc.text("Recommendations", { underline: true });
        doc.moveDown(0.3);
        doc.fontSize(11);
        doc.font("Helvetica");
        extraction.recommendations.forEach((rec, index) => {
          doc.text(`${index + 1}. ${rec.text || "N/A"}`);
          if (rec.confidence !== undefined && rec.confidence !== null) {
            doc.fontSize(9);
            doc.font("Helvetica-Oblique");
            doc.fillColor("gray");
            doc.text(`   Confidence: ${(rec.confidence * 100).toFixed(0)}%`, { indent: 20 });
            doc.fontSize(11);
            doc.fillColor("black");
          }
        });
        doc.moveDown(1);
      }

      // Disclosures Section
      if (extraction.disclosures && extraction.disclosures.length > 0) {
        doc.fontSize(14);
        doc.font("Helvetica-Bold");
        doc.text("Disclosures Discussed", { underline: true });
        doc.moveDown(0.3);
        doc.fontSize(11);
        doc.font("Helvetica");
        extraction.disclosures.forEach((dis, index) => {
          doc.text(`${index + 1}. ${dis.text || "N/A"}`);
          if (dis.confidence !== undefined && dis.confidence !== null) {
            doc.fontSize(9);
            doc.font("Helvetica-Oblique");
            doc.fillColor("gray");
            doc.text(`   Confidence: ${(dis.confidence * 100).toFixed(0)}%`, { indent: 20 });
            doc.fontSize(11);
            doc.fillColor("black");
          }
        });
        doc.moveDown(1);
      }

      // Decisions Section
      if (extraction.decisions && extraction.decisions.length > 0) {
        doc.fontSize(14);
        doc.font("Helvetica-Bold");
        doc.text("Decisions", { underline: true });
        doc.moveDown(0.3);
        doc.fontSize(11);
        doc.font("Helvetica");
        extraction.decisions.forEach((dec, index) => {
          doc.text(`${index + 1}. ${dec.text || "N/A"}`);
          if (dec.confidence !== undefined && dec.confidence !== null) {
            doc.fontSize(9);
            doc.font("Helvetica-Oblique");
            doc.fillColor("gray");
            doc.text(`   Confidence: ${(dec.confidence * 100).toFixed(0)}%`, { indent: 20 });
            doc.fontSize(11);
            doc.fillColor("black");
          }
        });
        doc.moveDown(1);
      }

      // Follow-ups Section
      if (extraction.followUps && extraction.followUps.length > 0) {
        doc.fontSize(14);
        doc.font("Helvetica-Bold");
        doc.text("Follow-ups", { underline: true });
        doc.moveDown(0.3);
        doc.fontSize(11);
        doc.font("Helvetica");
        extraction.followUps.forEach((fu, index) => {
          doc.text(`${index + 1}. ${fu.text || "N/A"}`);
          if (fu.confidence !== undefined && fu.confidence !== null) {
            doc.fontSize(9);
            doc.font("Helvetica-Oblique");
            doc.fillColor("gray");
            doc.text(`   Confidence: ${(fu.confidence * 100).toFixed(0)}%`, { indent: 20 });
            doc.fontSize(11);
            doc.fillColor("black");
          }
        });
        doc.moveDown(1);
      }

      // Sign-off Section
      doc.moveDown(1);
      doc.fontSize(14);
      doc.font("Helvetica-Bold");
      doc.text("Sign-off", { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(11);
      doc.font("Helvetica");
      if (meeting.finalizedBy && meeting.finalizedAt) {
        const finalizedByName = meeting.finalizedBy.name || meeting.finalizedBy.email || "Unknown";
        doc.text(`Finalized by: ${finalizedByName}`);
        doc.text(`Date: ${new Date(meeting.finalizedAt).toLocaleString()}`);
      } else {
        doc.text("Status: Draft (Not finalized)");
      }

      // Footer
      doc.fontSize(8);
      doc.font("Helvetica-Oblique");
      doc.fillColor("gray");
      doc.text(
        `Generated on ${new Date().toLocaleString()} | Meeting ID: ${meeting.id || "N/A"}`,
        { align: "center" }
      );

      doc.end();
    } catch (error) {
      console.error("PDFDocument error:", error);
      reject(error);
    }
  });
}
