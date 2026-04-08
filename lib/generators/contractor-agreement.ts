import { jsPDF } from "jspdf";
import type { GeneratorContext, GeneratedDocument } from "@/lib/generators/types";
import { getTimelineSummary } from "@/lib/generators/construction-timeline";

export function generateContractorAgreementPdf(ctx: GeneratorContext): GeneratedDocument {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const timeline = getTimelineSummary(ctx);
  const startDate = ctx.startDate.toLocaleDateString("en-GB");
  const completionDate = timeline.completionDate.toLocaleDateString("en-GB");
  const contractValue = ctx.boq.totals.grandTotal.toLocaleString("en-IN");

  doc.setFontSize(14);
  doc.text("WORK ORDER / CONTRACTOR AGREEMENT", 40, 34);
  doc.setFontSize(10);
  doc.text(`Project Location: ${ctx.boq.input.city}`, 40, 56);
  doc.text(`Built-up Area: ${Math.round(ctx.boq.project.builtUpAreaSqft)} sqft`, 40, 72);
  doc.text(`Building Type: ${ctx.boq.input.buildingType}`, 40, 88);

  const clauses = [
    "1. Scope of Work: The Contractor shall execute civil, structural, finishing and MEP works strictly as per Annexure A (Detailed BOQ), approved drawings and specifications.",
    `2. Contract Value: Total contract value is Rs. ${contractValue} inclusive of taxes and applicable statutory charges unless otherwise stated.`,
    "3. Payment Terms: Payments shall be released stage-wise in accordance with Annexure B (Payment Schedule), subject to site verification and certification.",
    `4. Timeline: Work shall commence on ${startDate} and shall be completed by ${completionDate}, subject to force majeure and approved variations.`,
    "5. Quality Standards: All materials and workmanship shall comply with relevant BIS/IS codes, CPWD specifications and good engineering practice.",
    "6. Material Supply: Owner and Contractor shall provide materials as mutually agreed in writing; any deviation must be approved before execution.",
    "7. Penalty for Delay: Liquidated damages at 0.5% of contract value per week of delay, capped at 10%, unless delay is attributable to Owner/force majeure.",
    "8. Defect Liability Period: Contractor shall rectify defects notified within 12 months from handover at no additional cost.",
    "9. Dispute Resolution: Disputes shall be resolved amicably, failing which by arbitration under the Arbitration and Conciliation Act, 1996, seated in India.",
    "10. Termination: Either party may terminate for material breach with written notice and cure period; payments shall be settled for measured completed work."
  ];

  let y = 116;
  doc.setFontSize(9.6);
  for (const clause of clauses) {
    const lines = doc.splitTextToSize(clause, 515);
    doc.text(lines, 40, y);
    y += lines.length * 13 + 4;
    if (y > 710) {
      doc.addPage();
      y = 50;
    }
  }

  y += 10;
  doc.setFontSize(10);
  doc.text("Annexure A: Detailed BOQ", 40, y);
  doc.text("Annexure B: Payment Schedule", 40, y + 16);

  doc.line(60, y + 70, 200, y + 70);
  doc.line(240, y + 70, 380, y + 70);
  doc.line(420, y + 70, 540, y + 70);
  doc.text("Owner", 115, y + 85);
  doc.text("Contractor", 285, y + 85);
  doc.text("Witness", 470, y + 85);

  return {
    name: "Contractor Agreement",
    fileName: "Contractor_Agreement.pdf",
    mimeType: "application/pdf",
    icon: "📕",
    data: new Blob([doc.output("arraybuffer")], { type: "application/pdf" })
  };
}

