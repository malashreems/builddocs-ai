import * as XLSX from "xlsx";
import type { GeneratorContext, GeneratedDocument } from "@/lib/generators/types";

function addWeeks(date: Date, weeks: number): Date {
  const out = new Date(date);
  out.setDate(out.getDate() + Math.round(weeks * 7));
  return out;
}

function fmtDate(date: Date): string {
  return date.toLocaleDateString("en-GB");
}

export function generatePaymentScheduleExcel(ctx: GeneratorContext): GeneratedDocument {
  const total = ctx.boq.totals.grandTotal;
  const rows: Array<[string, number, number, number, string]> = [];
  const stages = [
    { stage: "Agreement & Mobilization", pct: 5, duration: 0 },
    { stage: "Foundation Complete", pct: 15, duration: 3 },
    { stage: "Plinth Level Complete", pct: 10, duration: 2 },
    { stage: "Superstructure (Walls)", pct: 15, duration: 4 },
    { stage: "Roof Slab Casting", pct: 15, duration: 2 },
    { stage: "Plastering & Electrical Rough-in", pct: 10, duration: 3 },
    { stage: "Flooring & Tiling", pct: 10, duration: 2 },
    { stage: "Doors, Windows & Painting", pct: 10, duration: 3 },
    { stage: "Plumbing & Electrical Final Fix", pct: 5, duration: 2 },
    { stage: "Final Handover & Snag Fixing", pct: 5, duration: 2 }
  ];

  let cumulativePct = 0;
  let cursor = new Date(ctx.startDate);
  for (const s of stages) {
    cumulativePct += s.pct;
    cursor = addWeeks(cursor, s.duration);
    rows.push([s.stage, s.pct, cumulativePct, (total * s.pct) / 100, fmtDate(cursor)]);
  }

  const aoa: (string | number)[][] = [
    ["PAYMENT SCHEDULE"],
    [`Project: ${ctx.boq.input.buildingType} | City: ${ctx.boq.input.city}`],
    [],
    ["Stage", "% of Work", "Cumulative %", "Amount (Rs.)", "Target Date"],
    ...rows
  ];
  aoa.push(["TOTAL", 100, 100, total, fmtDate(cursor)]);
  aoa.push(["Expected Completion Date", "", "", "", fmtDate(cursor)]);

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [{ wch: 38 }, { wch: 12 }, { wch: 14 }, { wch: 16 }, { wch: 16 }];
  for (let i = 5; i <= 5 + rows.length; i += 1) {
    const cell = ws[`D${i}`];
    if (cell && typeof cell.v === "number") cell.z = "#,##0.00";
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Payment Schedule");
  const buffer = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;

  return {
    name: "Payment Schedule",
    fileName: "Payment_Schedule.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    icon: "📊",
    data: new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
  };
}

