import * as XLSX from "xlsx";
import type { BoqResult } from "@/lib/boq-engine";

const blueFill = { patternType: "solid", fgColor: { rgb: "DCEBFF" } };
const yellowFill = { patternType: "solid", fgColor: { rgb: "FFF9CC" } };

function setCellStyle(
  ws: XLSX.WorkSheet,
  cellAddress: string,
  style: {
    font?: { bold?: boolean };
    fill?: { patternType: string; fgColor: { rgb: string } };
    alignment?: { horizontal?: string };
  }
) {
  const cell = ws[cellAddress] as XLSX.CellObject & { s?: unknown };
  if (cell) {
    cell.s = style;
  }
}

function makeAbstractSheet(result: BoqResult): XLSX.WorkSheet {
  const rows: Array<Array<string | number>> = [
    ["ABSTRACT OF COST"],
    [
      `Project: ${result.input.buildingType} | Location: ${result.input.city} | Plot: ${result.input.widthFt}x${result.input.lengthFt} ft | Built-up: ${result.project.builtUpAreaSqft.toFixed(2)} sqft`
    ],
    [],
    ["Schedule", "Description", "Amount (Rs.)"]
  ];

  for (const sched of result.scheduleTotals) {
    rows.push([sched.scheduleId, sched.scheduleName, sched.amount]);
  }

  rows.push([]);
  rows.push(["", "Total of all schedules", result.totals.schedulesTotal]);
  rows.push(["", "Contractor Profit @ 15%", result.totals.contractorProfit]);
  rows.push(["", "GST @ 18%", result.totals.gst]);
  rows.push(["", "Grand Total", result.totals.grandTotal]);
  rows.push([]);
  rows.push(["", "Cost per sqft", result.totals.costPerSqft]);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{ wch: 12 }, { wch: 70 }, { wch: 20 }];

  setCellStyle(ws, "A1", { font: { bold: true } });
  setCellStyle(ws, "A4", { font: { bold: true }, fill: blueFill });
  setCellStyle(ws, "B4", { font: { bold: true }, fill: blueFill });
  setCellStyle(ws, "C4", { font: { bold: true }, fill: blueFill, alignment: { horizontal: "right" } });

  const range = XLSX.utils.decode_range(ws["!ref"] ?? "A1:C1");
  for (let r = 5; r <= range.e.r + 1; r += 1) {
    const amountCell = `C${r}`;
    const cell = ws[amountCell];
    if (cell && typeof cell.v === "number") {
      cell.z = "#,##0.00";
    }
  }
  return ws;
}

function makeDetailedSheet(result: BoqResult): XLSX.WorkSheet {
  const rows: Array<Array<string | number>> = [];
  rows.push(["DETAILED BILL OF QUANTITIES"]);
  rows.push([]);
  rows.push(["S.No", "DSR Item No.", "Description (with IS codes)", "Unit", "Quantity", "Rate (Rs.)", "Amount (Rs.)"]);

  let serial = 1;
  let currentSchedule = "";
  let scheduleSubtotal = 0;

  for (const item of result.items) {
    if (item.scheduleId !== currentSchedule) {
      if (currentSchedule !== "") {
        rows.push(["", "", `Subtotal - ${currentSchedule}`, "", "", "", Number(scheduleSubtotal.toFixed(2))]);
        rows.push([]);
      }
      currentSchedule = item.scheduleId;
      scheduleSubtotal = 0;
      rows.push(["", "", item.scheduleName, "", "", "", ""]);
    }
    rows.push([serial, item.dsr_item_no, item.description, item.unit, item.quantity, item.rate, item.amount]);
    scheduleSubtotal += item.amount;
    serial += 1;
  }

  rows.push(["", "", `Subtotal - ${currentSchedule}`, "", "", "", Number(scheduleSubtotal.toFixed(2))]);
  rows.push([]);
  rows.push(["", "", "Grand Total", "", "", "", result.totals.schedulesTotal]);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{ wch: 8 }, { wch: 14 }, { wch: 78 }, { wch: 8 }, { wch: 12 }, { wch: 14 }, { wch: 16 }];

  setCellStyle(ws, "A1", { font: { bold: true } });
  for (const col of ["A", "B", "C", "D", "E", "F", "G"]) {
    setCellStyle(ws, `${col}3`, { font: { bold: true }, fill: blueFill });
  }

  const totalRows = rows.length;
  for (let r = 4; r <= totalRows; r += 1) {
    const descCell = ws[`C${r}`];
    if (descCell && typeof descCell.v === "string" && descCell.v.startsWith("SCHEDULE")) {
      for (const col of ["A", "B", "C", "D", "E", "F", "G"]) {
        setCellStyle(ws, `${col}${r}`, { font: { bold: true }, fill: blueFill });
      }
      continue;
    }
    if (descCell && typeof descCell.v === "string" && descCell.v.startsWith("Subtotal")) {
      for (const col of ["A", "B", "C", "D", "E", "F", "G"]) {
        setCellStyle(ws, `${col}${r}`, { font: { bold: true }, fill: yellowFill });
      }
    }

    for (const col of ["E", "F", "G"]) {
      const c = ws[`${col}${r}`];
      if (c && typeof c.v === "number") {
        c.z = "#,##0.00";
      }
    }
  }

  return ws;
}

function makeMaterialSheet(result: BoqResult): XLSX.WorkSheet {
  const cementBags = result.metrics.totalCementBags;
  const steelKg = result.metrics.steelKg;
  const bricksNos = result.metrics.totalBrickVolume * 500;
  const sandCum = result.metrics.totalConcreteVolume * 0.45 + result.metrics.totalPlasterArea * 0.012;
  const aggregateCum = result.metrics.totalConcreteVolume * 0.9;
  const vitrifiedTiles = result.metrics.flooringMainArea;
  const ceramicTiles = result.metrics.flooringDadoArea;
  const paintInterior = result.metrics.internalPlasterArea * 0.14;
  const paintExterior = result.metrics.externalPlasterArea * 0.16;
  const pvcPipes = result.metrics.plumbingPipesRm;
  const electricalWire = result.metrics.electricalPoints * 15;

  const rows: Array<Array<string | number>> = [
    ["MATERIAL SUMMARY"],
    [],
    ["Material", "Specification", "Unit", "Quantity"],
    ["Cement", "OPC 43 Grade", "Bags", Number(cementBags.toFixed(2))],
    ["Steel TMT", "Fe500D", "Kg", Number(steelKg.toFixed(2))],
    ["Bricks", "Class 7.5", "Nos.", Number(bricksNos.toFixed(2))],
    ["Sand", "Zone II", "Cu.m", Number(sandCum.toFixed(2))],
    ["Aggregate 20mm", "Crushed stone", "Cu.m", Number(aggregateCum.toFixed(2))],
    ["Vitrified Tiles", "600x600", "Sq.m", Number(vitrifiedTiles.toFixed(2))],
    ["Ceramic Wall Tiles", "300x450", "Sq.m", Number(ceramicTiles.toFixed(2))],
    ["Paint - Interior", "Acrylic emulsion", "Litres", Number(paintInterior.toFixed(2))],
    ["Paint - Exterior", "Weather coat", "Litres", Number(paintExterior.toFixed(2))],
    ["PVC Pipes", "SWR / CPVC", "R.m", Number(pvcPipes.toFixed(2))],
    ["Electrical Wire", "FRLS copper", "R.m", Number(electricalWire.toFixed(2))]
  ];

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{ wch: 22 }, { wch: 28 }, { wch: 10 }, { wch: 14 }];

  setCellStyle(ws, "A1", { font: { bold: true } });
  for (const col of ["A", "B", "C", "D"]) {
    setCellStyle(ws, `${col}3`, { font: { bold: true }, fill: blueFill });
  }
  for (let r = 4; r <= rows.length; r += 1) {
    const cell = ws[`D${r}`];
    if (cell && typeof cell.v === "number") {
      cell.z = "#,##0.00";
    }
  }
  return ws;
}

export function buildBoqWorkbook(result: BoqResult): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, makeAbstractSheet(result), "Abstract of Cost");
  XLSX.utils.book_append_sheet(wb, makeDetailedSheet(result), "Detailed BOQ");
  XLSX.utils.book_append_sheet(wb, makeMaterialSheet(result), "Material Summary");
  return wb;
}

export function generateBoqWorkbook(result: BoqResult, fileName: string) {
  const wb = buildBoqWorkbook(result);
  XLSX.writeFile(wb, fileName);
}

export function generateBoqWorkbookArrayBuffer(result: BoqResult): ArrayBuffer {
  const wb = buildBoqWorkbook(result);
  const out = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  return out;
}
