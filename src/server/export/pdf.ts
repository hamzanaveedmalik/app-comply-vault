import PDFDocument from "pdfkit";
import type { ExtractionData } from "../extraction/types";
import type { Meeting, User } from "@prisma/client";

interface GeneratePDFOptions {
  meeting: Meeting & { finalizedBy?: User | null };
  extraction: ExtractionData;
  workspaceName: string;
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
      const doc = new PDFDocument({
        margin: 50,
        size: "LETTER",
      });

      const buffers: Buffer[] = [];
      doc.on("data", buffers.push.bind(buffers));
      doc.on("end", () => {
        const pdfBuffer = Buffer.concat(buffers);
        resolve(pdfBuffer);
      });
      doc.on("error", reject);

      // Header
      doc.fontSize(20).font("Helvetica-Bold").text("Client Interaction Record", { align: "center" });
      doc.moveDown(0.5);
      doc.fontSize(12).font("Helvetica").text(workspaceName, { align: "center" });
      doc.moveDown(1);

      // Client Information Section
      doc.fontSize(14).font("Helvetica-Bold").text("Client Information", { underline: true });
      doc.moveDown(0.3);
      doc.fontSize(11).font("Helvetica");
      doc.text(`Client Name: ${meeting.clientName}`);
      doc.text(`Meeting Type: ${meeting.meetingType}`);
      doc.text(`Meeting Date: ${new Date(meeting.meetingDate).toLocaleDateString()}`);
      doc.moveDown(1);

      // Topics Section
      if (extraction.topics && extraction.topics.length > 0) {
        doc.fontSize(14).font("Helvetica-Bold").text("Topics Discussed", { underline: true });
        doc.moveDown(0.3);
        doc.fontSize(11).font("Helvetica");
        extraction.topics.forEach((topic, index) => {
          doc.text(`${index + 1}. ${topic}`);
        });
        doc.moveDown(1);
      }

      // Recommendations Section
      if (extraction.recommendations && extraction.recommendations.length > 0) {
        doc.fontSize(14).font("Helvetica-Bold").text("Recommendations", { underline: true });
        doc.moveDown(0.3);
        doc.fontSize(11).font("Helvetica");
        extraction.recommendations.forEach((rec, index) => {
          doc.text(`${index + 1}. ${rec.text}`);
          if (rec.confidence !== undefined) {
            doc.fontSize(9).font("Helvetica-Oblique").fillColor("gray");
            doc.text(`   Confidence: ${(rec.confidence * 100).toFixed(0)}%`, { indent: 20 });
            doc.fontSize(11).fillColor("black");
          }
        });
        doc.moveDown(1);
      }

      // Disclosures Section
      if (extraction.disclosures && extraction.disclosures.length > 0) {
        doc.fontSize(14).font("Helvetica-Bold").text("Disclosures Discussed", { underline: true });
        doc.moveDown(0.3);
        doc.fontSize(11).font("Helvetica");
        extraction.disclosures.forEach((dis, index) => {
          doc.text(`${index + 1}. ${dis.text}`);
          if (dis.confidence !== undefined) {
            doc.fontSize(9).font("Helvetica-Oblique").fillColor("gray");
            doc.text(`   Confidence: ${(dis.confidence * 100).toFixed(0)}%`, { indent: 20 });
            doc.fontSize(11).fillColor("black");
          }
        });
        doc.moveDown(1);
      }

      // Decisions Section
      if (extraction.decisions && extraction.decisions.length > 0) {
        doc.fontSize(14).font("Helvetica-Bold").text("Decisions", { underline: true });
        doc.moveDown(0.3);
        doc.fontSize(11).font("Helvetica");
        extraction.decisions.forEach((dec, index) => {
          doc.text(`${index + 1}. ${dec.text}`);
          if (dec.confidence !== undefined) {
            doc.fontSize(9).font("Helvetica-Oblique").fillColor("gray");
            doc.text(`   Confidence: ${(dec.confidence * 100).toFixed(0)}%`, { indent: 20 });
            doc.fontSize(11).fillColor("black");
          }
        });
        doc.moveDown(1);
      }

      // Follow-ups Section
      if (extraction.followUps && extraction.followUps.length > 0) {
        doc.fontSize(14).font("Helvetica-Bold").text("Follow-ups", { underline: true });
        doc.moveDown(0.3);
        doc.fontSize(11).font("Helvetica");
        extraction.followUps.forEach((fu, index) => {
          doc.text(`${index + 1}. ${fu.text}`);
          if (fu.confidence !== undefined) {
            doc.fontSize(9).font("Helvetica-Oblique").fillColor("gray");
            doc.text(`   Confidence: ${(fu.confidence * 100).toFixed(0)}%`, { indent: 20 });
            doc.fontSize(11).fillColor("black");
          }
        });
        doc.moveDown(1);
      }

      // Sign-off Section
      doc.moveDown(1);
      doc.fontSize(14).font("Helvetica-Bold").text("Sign-off", { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(11).font("Helvetica");
      if (meeting.finalizedBy && meeting.finalizedAt) {
        doc.text(`Finalized by: ${meeting.finalizedBy.name || meeting.finalizedBy.email || "Unknown"}`);
        doc.text(`Date: ${new Date(meeting.finalizedAt).toLocaleString()}`);
      } else {
        doc.text("Status: Draft (Not finalized)");
      }

      // Footer
      doc.fontSize(8).font("Helvetica-Oblique").fillColor("gray");
      doc.text(
        `Generated on ${new Date().toLocaleString()} | Meeting ID: ${meeting.id}`,
        { align: "center" }
      );

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

