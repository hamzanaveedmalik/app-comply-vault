import { jsPDF } from "jspdf";
import type { ExtractionData } from "../extraction/types";
import type { Meeting, User } from "./types";

interface GeneratePDFOptions {
  meeting: Meeting & { finalizedBy?: User | null };
  extraction: ExtractionData;
  workspaceName: string;
  watermarked?: boolean;
}

/**
 * Generate structured compliance note as PDF
 * Returns PDF buffer
 */
export async function generateComplianceNotePDF({
  meeting,
  extraction,
  workspaceName,
  watermarked = false,
}: GeneratePDFOptions): Promise<Buffer> {
  try {
    const doc = new jsPDF({
      format: "letter",
      unit: "pt",
    });

    let yPos = 50;
    const margin = 50;
    const pageWidth = doc.internal.pageSize.getWidth();
    const maxWidth = pageWidth - 2 * margin;

    // Header
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text("Client Interaction Record", pageWidth / 2, yPos, { align: "center" });
    yPos += 20;

    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text(workspaceName || "Comply Vault", pageWidth / 2, yPos, { align: "center" });
    yPos += 30;

    // Client Information Section
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Client Information", margin, yPos);
    yPos += 20;

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(`Client Name: ${meeting.clientName || "N/A"}`, margin, yPos);
    yPos += 15;
    doc.text(`Meeting Type: ${meeting.meetingType || "N/A"}`, margin, yPos);
    yPos += 15;
    doc.text(
      `Meeting Date: ${meeting.meetingDate ? new Date(meeting.meetingDate).toLocaleDateString() : "N/A"}`,
      margin,
      yPos
    );
    yPos += 25;

    // Topics Section
    if (extraction.topics && extraction.topics.length > 0) {
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Topics Discussed", margin, yPos);
      yPos += 20;

      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      extraction.topics.forEach((topic, index) => {
        const lines = doc.splitTextToSize(`${index + 1}. ${topic || "N/A"}`, maxWidth);
        doc.text(lines, margin, yPos);
        yPos += lines.length * 15;
      });
      yPos += 15;
    }

    // Recommendations Section
    if (extraction.recommendations && extraction.recommendations.length > 0) {
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Recommendations", margin, yPos);
      yPos += 20;

      doc.setFontSize(11);
      extraction.recommendations.forEach((rec, index) => {
        doc.setFont("helvetica", "normal");
        const lines = doc.splitTextToSize(`${index + 1}. ${rec.text || "N/A"}`, maxWidth);
        doc.text(lines, margin, yPos);
        yPos += lines.length * 15;

        if (rec.confidence !== undefined && rec.confidence !== null) {
          doc.setFontSize(9);
          doc.setFont("helvetica", "italic");
          doc.setTextColor(128, 128, 128);
          doc.text(`Confidence: ${(rec.confidence * 100).toFixed(0)}%`, margin + 20, yPos);
          yPos += 12;
          doc.setTextColor(0, 0, 0);
          doc.setFontSize(11);
        }
      });
      yPos += 15;
    }

    // Disclosures Section
    if (extraction.disclosures && extraction.disclosures.length > 0) {
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Disclosures Discussed", margin, yPos);
      yPos += 20;

      doc.setFontSize(11);
      extraction.disclosures.forEach((dis, index) => {
        doc.setFont("helvetica", "normal");
        const lines = doc.splitTextToSize(`${index + 1}. ${dis.text || "N/A"}`, maxWidth);
        doc.text(lines, margin, yPos);
        yPos += lines.length * 15;

        if (dis.confidence !== undefined && dis.confidence !== null) {
          doc.setFontSize(9);
          doc.setFont("helvetica", "italic");
          doc.setTextColor(128, 128, 128);
          doc.text(`Confidence: ${(dis.confidence * 100).toFixed(0)}%`, margin + 20, yPos);
          yPos += 12;
          doc.setTextColor(0, 0, 0);
          doc.setFontSize(11);
        }
      });
      yPos += 15;
    }

    // Decisions Section
    if (extraction.decisions && extraction.decisions.length > 0) {
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Decisions", margin, yPos);
      yPos += 20;

      doc.setFontSize(11);
      extraction.decisions.forEach((dec, index) => {
        doc.setFont("helvetica", "normal");
        const lines = doc.splitTextToSize(`${index + 1}. ${dec.text || "N/A"}`, maxWidth);
        doc.text(lines, margin, yPos);
        yPos += lines.length * 15;

        if (dec.confidence !== undefined && dec.confidence !== null) {
          doc.setFontSize(9);
          doc.setFont("helvetica", "italic");
          doc.setTextColor(128, 128, 128);
          doc.text(`Confidence: ${(dec.confidence * 100).toFixed(0)}%`, margin + 20, yPos);
          yPos += 12;
          doc.setTextColor(0, 0, 0);
          doc.setFontSize(11);
        }
      });
      yPos += 15;
    }

    // Follow-ups Section
    if (extraction.followUps && extraction.followUps.length > 0) {
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Follow-ups", margin, yPos);
      yPos += 20;

      doc.setFontSize(11);
      extraction.followUps.forEach((fu, index) => {
        doc.setFont("helvetica", "normal");
        const lines = doc.splitTextToSize(`${index + 1}. ${fu.text || "N/A"}`, maxWidth);
        doc.text(lines, margin, yPos);
        yPos += lines.length * 15;

        if (fu.confidence !== undefined && fu.confidence !== null) {
          doc.setFontSize(9);
          doc.setFont("helvetica", "italic");
          doc.setTextColor(128, 128, 128);
          doc.text(`Confidence: ${(fu.confidence * 100).toFixed(0)}%`, margin + 20, yPos);
          yPos += 12;
          doc.setTextColor(0, 0, 0);
          doc.setFontSize(11);
        }
      });
      yPos += 15;
    }

    // Sign-off Section
    yPos += 10;
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Sign-off", margin, yPos);
    yPos += 20;

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    if (meeting.finalizedBy && meeting.finalizedAt) {
      const finalizedByName = meeting.finalizedBy.name || meeting.finalizedBy.email || "Unknown";
      doc.text(`Finalized by: ${finalizedByName}`, margin, yPos);
      yPos += 15;
      doc.text(`Date: ${new Date(meeting.finalizedAt).toLocaleString()}`, margin, yPos);
      yPos += 15;
      if (meeting.finalizeReason) {
        doc.text(`Reason: ${meeting.finalizeReason}`, margin, yPos);
        yPos += 15;
      }
      if (meeting.finalizeNote) {
        const noteLines = doc.splitTextToSize(`Note: ${meeting.finalizeNote}`, maxWidth);
        doc.text(noteLines, margin, yPos);
        yPos += noteLines.length * 15;
      }
    } else {
      doc.text("Status: Draft (Not finalized)", margin, yPos);
    }

    // Footer
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setFontSize(8);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(128, 128, 128);
    doc.text(
      `Generated on ${new Date().toLocaleString()} | Meeting ID: ${meeting.id || "N/A"}`,
      pageWidth / 2,
      pageHeight - 30,
      { align: "center" }
    );

    if (watermarked) {
      const watermarkText = "TRIAL EXPORT";
      const totalPages = doc.getNumberOfPages();
      for (let page = 1; page <= totalPages; page += 1) {
        doc.setPage(page);
        doc.setFontSize(48);
        doc.setTextColor(220, 220, 220);
        doc.setFont("helvetica", "bold");
        doc.text(watermarkText, pageWidth / 2, pageHeight / 2, {
          align: "center",
          angle: 30,
        });
        doc.setTextColor(0, 0, 0);
      }
    }

    // Convert to Buffer
    const pdfOutput = doc.output("arraybuffer");
    return Buffer.from(pdfOutput);
  } catch (error) {
    console.error("jsPDF error:", error);
    throw new Error(`PDF generation failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}
