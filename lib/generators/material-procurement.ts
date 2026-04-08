import * as XLSX from "xlsx";
import type { GeneratorContext, GeneratedDocument } from "@/lib/generators/types";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function generateMaterialProcurementExcel(ctx: GeneratorContext): GeneratedDocument {
  const concrete = ctx.boq.metrics.totalConcreteVolume;
  const plaster = ctx.boq.metrics.totalPlasterArea;
  const cement = ctx.boq.metrics.totalCementBags;
  const steel = ctx.boq.metrics.steelKg;
  const sand = concrete * 0.45 + plaster * 0.012;
  const bricks = ctx.boq.metrics.totalBrickVolume * 500;
  const aggregate = concrete * 0.9;
  const tiles = ctx.boq.metrics.flooringMainArea + ctx.boq.metrics.flooringDadoArea;
  const paint = ctx.boq.metrics.internalPlasterArea * 0.14 + ctx.boq.metrics.externalPlasterArea * 0.16;
  const plumbing = ctx.boq.metrics.plumbingPipesRm;
  const electrical = ctx.boq.metrics.electricalPoints;
  const shuttering = ctx.boq.items
    .filter((x) => x.scheduleId === "D")
    .reduce((sum, x) => sum + x.amount, 0);

  const rows: (string | number)[][] = [
    ["MATERIAL PROCUREMENT SCHEDULE"],
    [`Project: ${ctx.boq.input.buildingType} | City: ${ctx.boq.input.city}`],
    [],
    [
      "Material",
      "Specification",
      "Total Qty",
      "Unit",
      "Phase 1 (Foundation)",
      "Phase 2 (Structure)",
      "Phase 3 (Finishing)",
      "Estimated Cost (Rs.)",
      "Procurement Checklist"
    ],
    [
      "Cement",
      "OPC 43 Grade",
      round2(cement),
      "Bags",
      round2(cement * 0.3),
      round2(cement * 0.5),
      round2(cement * 0.2),
      round2(ctx.boq.items.filter((x) => x.itemKey.includes("conc_") || x.itemKey.includes("plas_")).reduce((s, x) => s + x.amount, 0)),
      "Order 1 week before phase start"
    ],
    ["Steel TMT", "Fe500D", round2(steel), "Kg", round2(steel * 0.4), round2(steel * 0.6), 0, round2(ctx.boq.items.filter((x) => x.scheduleId === "E").reduce((s, x) => s + x.amount, 0)), "Order 1 week before phase start"],
    ["Sand", "Zone II", round2(sand), "Cu.m", round2(sand), 0, 0, round2(ctx.boq.items.find((x) => x.itemKey === "earth_sand_fill")?.amount ?? 0), "Order 1 week before phase start"],
    ["Bricks", "Class 7.5", round2(bricks), "Nos.", round2(bricks * 0.3), round2(bricks * 0.5), round2(bricks * 0.2), round2(ctx.boq.items.filter((x) => x.scheduleId === "C").reduce((s, x) => s + x.amount, 0)), "Order 1 week before phase start"],
    ["Aggregate 20mm", "Crushed stone", round2(aggregate), "Cu.m", round2(aggregate * 0.3), round2(aggregate * 0.5), round2(aggregate * 0.2), round2(concrete * 1000), "Order 1 week before phase start"],
    ["Shuttering Material", "Plywood & Props", round2(shuttering), "L.S.", 0, round2(shuttering), 0, round2(shuttering), "Order 1 week before phase start"],
    ["Tiles", "Vitrified/Ceramic", round2(tiles), "Sq.m", 0, 0, round2(tiles), round2(ctx.boq.items.filter((x) => x.scheduleId === "G").reduce((s, x) => s + x.amount, 0)), "Order 1 week before phase start"],
    ["Paint", "Interior/Exterior", round2(paint), "Litres", 0, 0, round2(paint), round2(ctx.boq.items.filter((x) => x.scheduleId === "K").reduce((s, x) => s + x.amount, 0)), "Order 1 week before phase start"],
    ["Plumbing Fittings", "CPVC/PVC/Fixtures", round2(plumbing), "R.m", 0, 0, round2(plumbing), round2(ctx.boq.items.filter((x) => x.scheduleId === "I").reduce((s, x) => s + x.amount, 0)), "Order 1 week before phase start"],
    ["Electrical Fittings", "Wires/Points", round2(electrical), "Point", 0, 0, round2(electrical), round2(ctx.boq.items.filter((x) => x.scheduleId === "J").reduce((s, x) => s + x.amount, 0)), "Order 1 week before phase start"]
  ];

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{ wch: 22 }, { wch: 22 }, { wch: 12 }, { wch: 8 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 18 }, { wch: 32 }];
  for (let r = 5; r <= rows.length; r += 1) {
    const cell = ws[`H${r}`];
    if (cell && typeof cell.v === "number") cell.z = "#,##0.00";
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Procurement");
  const buffer = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  return {
    name: "Material Procurement Schedule",
    fileName: "Material_Procurement_Schedule.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    icon: "📊",
    data: new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
  };
}

