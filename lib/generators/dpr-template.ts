import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { GeneratorContext, GeneratedDocument } from "@/lib/generators/types";

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function drawTemplatePage(doc: jsPDF, projectLabel: string, dateLabel: string) {
  doc.setFontSize(13);
  doc.text("DAILY PROGRESS REPORT", 40, 28);
  doc.setFontSize(10);
  doc.text(projectLabel, 40, 44);
  doc.text(`Date: ${dateLabel}`, 40, 58);
  doc.text("Weather: ____________________", 200, 58);
  doc.text("Report No.: ____________________", 390, 58);

  autoTable(doc, {
    startY: 70,
    head: [["Labour Attendance - Trade", "Number", "Hours", "Rate", "Amount"]],
    body: [["Mason", "", "", "", ""], ["Helper", "", "", "", ""], ["Carpenter", "", "", "", ""], ["Plumber", "", "", "", ""], ["Electrician", "", "", "", ""], ["Painter", "", "", "", ""], ["Bar Bender", "", "", "", ""]],
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [220, 235, 255], textColor: 20 }
  });

  const y1 = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 190;
  autoTable(doc, {
    startY: y1 + 10,
    head: [["Material Received Today", "Quantity", "Unit", "Supplier", "Invoice No."]],
    body: Array.from({ length: 5 }, () => ["", "", "", "", ""]),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [220, 235, 255], textColor: 20 }
  });

  const y2 = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 260;
  autoTable(doc, {
    startY: y2 + 10,
    head: [["Work Done Today (BOQ Item)", "Description", "Quantity Done", "Unit", "Remarks"]],
    body: Array.from({ length: 6 }, () => ["", "", "", "", ""]),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [220, 235, 255], textColor: 20 }
  });

  const y3 = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 360;
  doc.setFontSize(10);
  doc.text("Issues / Delays:", 40, y3 + 20);
  doc.rect(40, y3 + 26, 515, 46);

  doc.text("Site Photos:", 40, y3 + 88);
  doc.rect(40, y3 + 94, 160, 80);
  doc.rect(220, y3 + 94, 160, 80);
  doc.rect(395, y3 + 94, 160, 80);
  doc.text("Photo 1", 102, y3 + 138);
  doc.text("Photo 2", 282, y3 + 138);
  doc.text("Photo 3", 457, y3 + 138);

  doc.text("Site Engineer Signature", 60, y3 + 194);
  doc.text("Contractor Signature", 250, y3 + 194);
  doc.text("Owner Signature", 440, y3 + 194);
}

export function generateDprTemplatePdf(ctx: GeneratorContext): GeneratedDocument {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const projectLabel = `Project: ${ctx.boq.input.buildingType} at ${ctx.boq.input.city}`;
  for (let i = 0; i < 30; i += 1) {
    if (i > 0) doc.addPage();
    const date = addDays(ctx.startDate, i).toLocaleDateString("en-GB");
    drawTemplatePage(doc, projectLabel, date);
  }
  return {
    name: "DPR Template (30 Pages)",
    fileName: "Daily_Progress_Report_Template.pdf",
    mimeType: "application/pdf",
    icon: "📕",
    data: new Blob([doc.output("arraybuffer")], { type: "application/pdf" })
  };
}

