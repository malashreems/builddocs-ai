import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { GeneratorContext, GeneratedDocument } from "@/lib/generators/types";

type Activity = { name: string; durationWeeks: number; category: "structure" | "finishing" | "mep" };

const ACTIVITIES: Activity[] = [
  { name: "Site Clearing", durationWeeks: 1, category: "structure" },
  { name: "Excavation", durationWeeks: 1, category: "structure" },
  { name: "Foundation", durationWeeks: 2, category: "structure" },
  { name: "Plinth", durationWeeks: 1, category: "structure" },
  { name: "Backfilling", durationWeeks: 0.5, category: "structure" },
  { name: "Superstructure Walls", durationWeeks: 3, category: "structure" },
  { name: "Lintel & Sunshade", durationWeeks: 1, category: "structure" },
  { name: "Roof Slab", durationWeeks: 1, category: "structure" },
  { name: "Curing", durationWeeks: 1, category: "structure" },
  { name: "Brick Work Upper", durationWeeks: 2, category: "structure" },
  { name: "Plumbing Rough-in", durationWeeks: 1, category: "mep" },
  { name: "Electrical Rough-in", durationWeeks: 1, category: "mep" },
  { name: "Plastering", durationWeeks: 3, category: "finishing" },
  { name: "Flooring", durationWeeks: 2, category: "finishing" },
  { name: "Doors & Windows", durationWeeks: 1, category: "finishing" },
  { name: "Painting", durationWeeks: 2, category: "finishing" },
  { name: "Plumbing Final", durationWeeks: 1, category: "mep" },
  { name: "Electrical Final", durationWeeks: 1, category: "mep" },
  { name: "Cleaning & Handover", durationWeeks: 1, category: "finishing" }
];

const FLOOR_SCALE: Record<number, number> = { 1: 1, 2: 1.5, 3: 1.8, 4: 2 };

function weeksAfter(start: Date, weeks: number): Date {
  const d = new Date(start);
  d.setDate(d.getDate() + Math.round(weeks * 7));
  return d;
}

export function getTimelineSummary(ctx: GeneratorContext) {
  const scale = FLOOR_SCALE[ctx.boq.input.floors] ?? 1;
  const scaled = ACTIVITIES.map((a) => ({ ...a, durationWeeks: a.durationWeeks * scale }));
  const totalWeeks = Math.ceil(scaled.reduce((s, a) => s + a.durationWeeks, 0));
  const completionDate = weeksAfter(ctx.startDate, totalWeeks);
  return { scale, scaled, totalWeeks, completionDate };
}

export function generateConstructionTimelinePdf(ctx: GeneratorContext): GeneratedDocument {
  const { scaled, totalWeeks, completionDate } = getTimelineSummary(ctx);
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  doc.setFontSize(14);
  doc.text(
    `Construction Schedule — ${ctx.boq.input.buildingType}, ${ctx.boq.input.city}, ${Math.round(
      ctx.boq.project.builtUpAreaSqft
    )} sqft`,
    40,
    34
  );

  const weekHeaders = Array.from({ length: Math.min(totalWeeks, 40) }, (_, i) => `W${i + 1}`);
  const body: string[][] = [];
  let cursor = 0;
  for (const act of scaled) {
    const row = new Array(weekHeaders.length + 1).fill("");
    row[0] = act.name;
    const start = Math.floor(cursor);
    const end = Math.min(weekHeaders.length - 1, Math.max(start, Math.ceil(cursor + act.durationWeeks) - 1));
    for (let i = start; i <= end; i += 1) {
      if (i >= 0) row[i + 1] = "■";
    }
    cursor += act.durationWeeks;
    body.push(row);
  }

  autoTable(doc, {
    head: [["Activity", ...weekHeaders]],
    body,
    startY: 50,
    styles: { fontSize: 7, cellPadding: 2, halign: "center" },
    headStyles: { fillColor: [220, 235, 255], textColor: 20 },
    columnStyles: { 0: { halign: "left", cellWidth: 160 } },
    didParseCell: (hook) => {
      if (hook.section !== "body" || hook.column.index === 0) return;
      const activity = scaled[hook.row.index];
      if (hook.cell.raw === "■") {
        if (activity.category === "structure") hook.cell.styles.fillColor = [0, 102, 255];
        if (activity.category === "finishing") hook.cell.styles.fillColor = [46, 180, 100];
        if (activity.category === "mep") hook.cell.styles.fillColor = [255, 159, 67];
        hook.cell.styles.textColor = [255, 255, 255];
      }
    }
  });

  const y = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 420;
  doc.setFontSize(10);
  doc.text(`Total Duration: ${totalWeeks} weeks`, 40, y + 24);
  doc.text(`Expected Completion: ${completionDate.toLocaleDateString("en-GB")}`, 220, y + 24);

  return {
    name: "Construction Timeline",
    fileName: "Construction_Timeline.pdf",
    mimeType: "application/pdf",
    icon: "📕",
    data: new Blob([doc.output("arraybuffer")], { type: "application/pdf" })
  };
}

