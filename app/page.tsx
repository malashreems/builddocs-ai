"use client";

import { Inter } from "next/font/google";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import { saveAs } from "file-saver";
import JSZip from "jszip";
import { generateBoq, type BldType, type BoqResult, type StructureType } from "@/lib/boq-engine";
import { generateBoqWorkbookArrayBuffer } from "@/lib/generate-excel";
import { generateContractorAgreementPdf } from "@/lib/generators/contractor-agreement";
import { generateConstructionTimelinePdf, getTimelineSummary } from "@/lib/generators/construction-timeline";
import { generateDprTemplatePdf } from "@/lib/generators/dpr-template";
import { generateMaterialProcurementExcel } from "@/lib/generators/material-procurement";
import { generatePaymentScheduleExcel } from "@/lib/generators/payment-schedule";
import type { GeneratedDocument } from "@/lib/generators/types";
import type { City, SpecProfile } from "@/lib/rates";

type Floors = "1" | "2" | "3" | "4";
type ParkingType = "None" | "Open" | "Covered";
type ProjectBldType = BldType | "1BHK";
type CompoundHeight = "3 ft" | "4 ft" | "5 ft" | "6 ft";
type CompoundType = "Brick" | "Block" | "Stone";
type WallFinish = "Plastered" | "Exposed Brick" | "Textured";
type GateType = "MS Fabricated" | "MS with Sheet" | "Wrought Iron" | "SS Gate";
type PhaseGroup = "Pre-Construction" | "Approval & Compliance" | "Execution" | "Financial" | "Plumbing & Services" | "Handover";
type MaterialRates = { cement: number; steel: number; sand: number; bricks: number; tiles: number; labour: number };
type LabourRates = { mason: number; helper: number; carpenter: number; plumber: number; electrician: number; painter: number };
type RoomDimensionRow = { id: number; name: string; lengthFt: number; widthFt: number };
type OpeningRow = { id: number; location: string; type: "Main" | "Internal" | "Bathroom" | "Sliding"; widthFt: number; heightFt: number; material: string };
type StructuralInputs = {
  columns: number;
  columnSize: "230x230mm" | "230x300mm" | "300x300mm";
  beamSize: "230x300mm" | "230x375mm" | "230x450mm";
  slabThickness: "100mm" | "125mm" | "150mm";
  plinthHeight: "1.5ft" | "2ft" | "2.5ft" | "3ft";
  floorToCeiling: "9ft" | "9.5ft" | "10ft" | "10.5ft" | "11ft";
  parapetHeight: "2.5ft" | "3ft" | "3.5ft" | "4ft";
};
type DocKey =
  | "boq" | "payment" | "procurement" | "timeline" | "dpr" | "agreement"
  | "abstract" | "measurement" | "bbs" | "mix" | "rateAnalysis" | "labour"
  | "approval" | "safety" | "snag" | "completion" | "warranty" | "om" | "propertyTax"
  | "noc" | "raBill" | "gstInvoice" | "bankLoan"
  | "materialInspection" | "rccPrepour" | "setbackFar" | "electricalLoad" | "plumbingSummary"
  | "costComparison" | "feasibility" | "asBuilt";
type ReadyDocument = GeneratedDocument & {
  sizeLabel: string;
  format: "XLSX" | "PDF";
  subtitle: string;
  key: DocKey;
  includes: string[];
};
type PreviewSheet = { name: string; rows: Array<Array<string | number>> };
type Toast = { id: number; msg: string };
type CompareResult = {
  items: Array<{
    description: string;
    boq_rate: number;
    contractor_rate: number;
    difference_percent: number;
    verdict: "fair" | "overpriced" | "underpriced" | "suspicious";
  }>;
  overall_assessment: string;
  negotiation_tips: string[];
};
type ChatMessage = { role: "user" | "assistant"; content: string };
type AiReview = {
  overall_verdict: "Looks Good" | "Needs Review" | "Concerns Found";
  confidence_score: number;
  observations: Array<{ item: string; status: "ok" | "warning" | "issue"; comment: string }>;
  suggestions: string[];
  estimated_savings_possible: string;
};
type RateIntelEntry = {
  material: string;
  current_price: number;
  last_updated: string;
  source_url: string;
};
type RateIntelPayload = {
  city: City;
  last_updated: string;
  rates: RateIntelEntry[];
  note: string;
};

const cities: City[] = ["Mumbai", "Delhi", "Bangalore", "Chennai", "Hyderabad", "Pune", "Ahmedabad", "Kolkata", "Jaipur", "Lucknow", "Chandigarh", "Kochi", "Bhopal", "Nagpur", "Coimbatore", "Vizag", "Patna", "Indore", "Surat", "Vadodara"];
const profileCards: Record<SpecProfile, { hint: string; description: string; sqftRate: number; materialFactor: number }> = {
  Economy: { hint: "₹1,400-1,600/sqft", description: "Budget-conscious finishes with reliable standard-grade materials.", sqftRate: 1500, materialFactor: 0.95 },
  Standard: { hint: "₹1,800-2,100/sqft", description: "Balanced quality and durability for long-term family use.", sqftRate: 1950, materialFactor: 1 },
  Premium: { hint: "₹2,500-3,000/sqft", description: "High-end finishes, superior fittings, and premium material choices.", sqftRate: 2700, materialFactor: 1.15 }
};
const cityFactors: Record<City, number> = { Mumbai: 1.22, Delhi: 1.12, Bangalore: 1.15, Chennai: 1.08, Hyderabad: 1.04, Pune: 1.06, Ahmedabad: 1.02, Kolkata: 1, Jaipur: 0.96, Lucknow: 0.95, Chandigarh: 0.99, Kochi: 1.01, Bhopal: 0.94, Nagpur: 0.93, Coimbatore: 0.97, Vizag: 0.96, Patna: 0.92, Indore: 0.94, Surat: 1, Vadodara: 0.98 };
const baseRates: MaterialRates = { cement: 420, steel: 62, sand: 4200, bricks: 7800, tiles: 72, labour: 900 };
const structuralDefaults: StructuralInputs = { columns: 12, columnSize: "230x230mm", beamSize: "230x300mm", slabThickness: "125mm", plinthHeight: "2ft", floorToCeiling: "10ft", parapetHeight: "3ft" };
const getDefaultRoomRows = (b: ProjectBldType): RoomDimensionRow[] => {
  const row = (id: number, name: string, l: number, w: number): RoomDimensionRow => ({ id, name, lengthFt: l, widthFt: w });
  if (b === "1BHK") return [row(1, "Bedroom 1", 12, 12), row(2, "Living", 14, 12), row(3, "Kitchen", 8, 10), row(4, "Bathroom", 7, 5)];
  if (b === "2BHK") return [row(1, "Bedroom 1", 12, 12), row(2, "Bedroom 2", 11, 11), row(3, "Living", 15, 12), row(4, "Kitchen", 9, 10), row(5, "Bathroom", 7, 5)];
  if (b === "3BHK") return [row(1, "Bedroom 1", 12, 12), row(2, "Bedroom 2", 11, 11), row(3, "Bedroom 3", 11, 10), row(4, "Living", 16, 13), row(5, "Kitchen", 10, 10), row(6, "Dining", 10, 10), row(7, "Bathroom 1", 7, 5), row(8, "Bathroom 2", 7, 5)];
  return [row(1, "Bedroom 1", 13, 12), row(2, "Bedroom 2", 12, 11), row(3, "Bedroom 3", 12, 11), row(4, "Bedroom 4", 11, 10), row(5, "Living", 18, 14), row(6, "Kitchen", 11, 10), row(7, "Dining", 11, 10), row(8, "Bathroom 1", 8, 5), row(9, "Bathroom 2", 8, 5), row(10, "Bathroom 3", 8, 5)];
};
const getDefaultOpenings = (b: ProjectBldType): OpeningRow[] => {
  const bedrooms = b === "1BHK" ? 1 : b === "2BHK" ? 2 : b === "3BHK" ? 3 : 4;
  const baths = b === "1BHK" ? 1 : b === "2BHK" ? 1 : b === "3BHK" ? 2 : 3;
  const rows: OpeningRow[] = [{ id: 1, location: "Main Entrance", type: "Main", widthFt: 4, heightFt: 7, material: "Teak Wood" }];
  let id = 2;
  for (let i = 0; i < bedrooms; i += 1) rows.push({ id: id++, location: `Bedroom ${i + 1}`, type: "Internal", widthFt: 3, heightFt: 7, material: "Flush Door" });
  for (let i = 0; i < baths; i += 1) rows.push({ id: id++, location: `Bathroom ${i + 1}`, type: "Bathroom", widthFt: 2.5, heightFt: 7, material: "PVC Door" });
  rows.push({ id: id++, location: "Living Window", type: "Sliding", widthFt: 5, heightFt: 4, material: "Aluminium" });
  return rows;
};
const inter = Inter({ subsets: ["latin"], weight: ["300", "400", "600", "700"] });
const inputClass = "mt-2 h-11 w-full rounded-[10px] border border-[#E5E7EB] bg-white px-4 py-3 text-[15px] font-normal text-[#1A1A2E] outline-none transition focus:border-[#0066FF] focus:shadow-[0_0_0_3px_rgba(0,102,255,0.1)]";
const optionalSectionCardClass = "rounded-[14px] border border-[#ECEFF3] bg-white transition-opacity duration-300";
const optionalRowClass = "flex min-h-[48px] flex-row flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-[#F0F0ED] py-3 last:border-b-0";
const inlineInputClass = "h-9 w-full min-w-[72px] rounded-[10px] border border-[#E5E7EB] bg-white px-3 text-[13px] font-normal text-[#1A1A2E] outline-none focus:border-[#0066FF] focus:shadow-[0_0_0_2px_rgba(0,102,255,0.08)] sm:w-auto sm:max-w-[100px]";
const inlineSelectClass = `${inlineInputClass} pr-8`;
const pillClass = "rounded-full px-4 py-2 text-sm font-medium transition";
const shellCardClass = "rounded-[14px] border border-[#ECEFF3] bg-white";
const collapseHeaderClass = "flex w-full items-center justify-between px-5 py-4 text-left text-[14px] font-semibold text-[#1A1A2E]";
const outlineBtnClass = "rounded-full border border-[#E5E7EB] px-4 py-2 text-[13px] font-semibold text-[#1A1A2E] hover:border-[#2563EB] hover:text-[#2563EB]";
const solidBtnClass = "rounded-full bg-gradient-to-r from-[#2563EB] to-[#06B6A4] px-4 py-2 text-[13px] font-semibold text-white";
const includesMap: Partial<Record<DocKey, string[]>> = {
  boq: ["12 schedules", "CPWD/DSR style", "IS code refs"],
  payment: ["10 milestones", "Auto dates", "Cost-linked stages"],
  procurement: ["Phase splits", "Qty + cost", "Ordering hints"],
  timeline: ["Gantt chart", "Floor scaling", "Completion forecast"],
  dpr: ["30 pages", "Daily logs", "Attendance + materials"],
  agreement: ["10 clauses", "Penalty terms", "Annexure refs"]
};
const subtitleMap: Partial<Record<DocKey, string>> = {
  boq: "12 schedules, CPWD/DSR format, city-wise rates",
  payment: "10-stage milestone payments linked to construction phases",
  procurement: "Phase-wise material quantities with ordering timeline",
  timeline: "Week-by-week Gantt chart",
  dpr: "30 ready-to-print DPR sheets",
  agreement: "10-clause work order with penalty and warranty terms"
};
const docDescriptors: Array<{ key: DocKey; name: string; format: "XLSX" | "PDF"; subtitle: string; includes: string[]; icon: string; phase: PhaseGroup }> = [
  { key: "boq", name: "Bill of Quantities (BOQ)", format: "XLSX", subtitle: subtitleMap.boq!, includes: includesMap.boq!, icon: "📊", phase: "Pre-Construction" },
  { key: "abstract", name: "Abstract of Cost", format: "PDF", subtitle: "12 schedules + profit + GST summary", includes: ["One-page summary", "15% contractor profit", "18% GST"], icon: "🧾", phase: "Pre-Construction" },
  { key: "measurement", name: "Detailed Measurement Sheet", format: "XLSX", subtitle: "IS 1200 style quantity derivations", includes: ["L×B×D breakdown", "Auto-filled quantities", "Editable sheet"], icon: "📏", phase: "Pre-Construction" },
  { key: "procurement", name: "Material Procurement", format: "XLSX", subtitle: subtitleMap.procurement!, includes: includesMap.procurement!, icon: "📦", phase: "Pre-Construction" },
  { key: "bbs", name: "Bar Bending Schedule", format: "XLSX", subtitle: "Rebar cutting and weight schedule", includes: ["Bar marks", "Dia-wise totals", "Weight calculations"], icon: "🧱", phase: "Pre-Construction" },
  { key: "rateAnalysis", name: "Material Rate Analysis", format: "XLSX", subtitle: "CPWD DAR style rate breakup", includes: ["Material + labour", "Sundries + water", "Profit included"], icon: "📉", phase: "Pre-Construction" },
  { key: "labour", name: "Labour Requirement Breakdown", format: "XLSX", subtitle: "Trade-wise days and labour costs", includes: ["Phase-wise split", "Output norms", "Grand total"], icon: "👷", phase: "Pre-Construction" },
  { key: "costComparison", name: "Cost Comparison Report", format: "PDF", subtitle: "Economy vs Standard vs Premium", includes: ["Schedule-wise comparison", "Cost/sqft delta", "Jump highlights"], icon: "📊", phase: "Pre-Construction" },
  { key: "feasibility", name: "Project Feasibility Summary", format: "PDF", subtitle: "Executive one-page project brief", includes: ["Cost + timeline", "Key quantities", "EMI estimate"], icon: "📌", phase: "Pre-Construction" },
  { key: "approval", name: "Building Plan Approval Checklist", format: "PDF", subtitle: "City-specific approval checklist", includes: ["Documents", "Departments", "Timeline and fees"], icon: "🏛️", phase: "Approval & Compliance" },
  { key: "setbackFar", name: "Setback & FAR Compliance Sheet", format: "PDF", subtitle: "Bylaw-style compliance estimate", includes: ["Setbacks", "Buildable area", "Compliance status"], icon: "📐", phase: "Approval & Compliance" },
  { key: "noc", name: "NOC Application Templates", format: "PDF", subtitle: "5 authority application drafts", includes: ["Electricity", "Water", "Fire", "Pollution/Airport notes"], icon: "🗂️", phase: "Approval & Compliance" },
  { key: "safety", name: "Site Safety Plan", format: "PDF", subtitle: "NBC-aligned site safety guidance", includes: ["PPE & first aid", "Fire & electrical", "Emergency template"], icon: "🦺", phase: "Approval & Compliance" },
  { key: "payment", name: "Payment Schedule", format: "XLSX", subtitle: subtitleMap.payment!, includes: includesMap.payment!, icon: "📅", phase: "Execution" },
  { key: "timeline", name: "Construction Timeline", format: "PDF", subtitle: subtitleMap.timeline!, includes: includesMap.timeline!, icon: "🗓️", phase: "Execution" },
  { key: "dpr", name: "Daily Progress Report", format: "PDF", subtitle: subtitleMap.dpr!, includes: includesMap.dpr!, icon: "📝", phase: "Execution" },
  { key: "mix", name: "Concrete Mix Design Sheet", format: "PDF", subtitle: "IS 10262 M20/M25 reference mix", includes: ["Target strength", "W/C ratio", "Material proportions"], icon: "🧪", phase: "Execution" },
  { key: "rccPrepour", name: "RCC Pre-Pour Checklist", format: "PDF", subtitle: "Footing/Plinth/Slab/Lintel checks", includes: ["Shuttering", "Rebar", "Approvals"], icon: "🧱", phase: "Execution" },
  { key: "materialInspection", name: "Material Inspection Checklist", format: "PDF", subtitle: "Site incoming material QA forms", includes: ["Cement/Steel/Bricks", "Pass/Fail checks", "Inspector sign-off"], icon: "🔎", phase: "Execution" },
  { key: "electricalLoad", name: "Electrical Load Calculation", format: "PDF", subtitle: "Connection demand estimation sheet", includes: ["Connected load", "Demand factor", "Meter recommendation"], icon: "⚡", phase: "Execution" },
  { key: "raBill", name: "Running Account Bill Template", format: "XLSX", subtitle: "Progressive contractor billing format", includes: ["RA rows", "Retention/TDS", "Net payable"], icon: "🧮", phase: "Financial" },
  { key: "gstInvoice", name: "GST Invoice Template", format: "XLSX", subtitle: "Construction invoice workbook (5 sheets)", includes: ["CGST/SGST", "SAC 9954", "TDS note"], icon: "🧾", phase: "Financial" },
  { key: "bankLoan", name: "Bank Loan Estimation Letter", format: "PDF", subtitle: "Stage-wise disbursement letter format", includes: ["Branch manager letter", "Stage breakup", "Sign blocks"], icon: "🏦", phase: "Financial" },
  { key: "agreement", name: "Contractor Agreement", format: "PDF", subtitle: subtitleMap.agreement!, includes: includesMap.agreement!, icon: "📄", phase: "Handover" },
  { key: "snag", name: "Snag / Punch List Template", format: "XLSX", subtitle: "Room-wise pre-handover checklist", includes: ["Priority/status", "Category tagging", "Editable log"], icon: "✅", phase: "Handover" },
  { key: "completion", name: "Completion Certificate Application", format: "PDF", subtitle: "Pre-filled municipal application format", includes: ["Project fields", "Plot and floors", "City-agnostic template"], icon: "📨", phase: "Handover" },
  { key: "warranty", name: "Warranty & Guarantee Register", format: "XLSX", subtitle: "Warranty tracker for installed items", includes: ["Period tracking", "Expiry dates", "Vendor contacts"], icon: "🛡️", phase: "Handover" },
  { key: "om", name: "Operation & Maintenance Guide", format: "PDF", subtitle: "Homeowner handover maintenance guide", includes: ["Annual schedule", "Dos & don'ts", "Emergency template"], icon: "📘", phase: "Handover" },
  { key: "plumbingSummary", name: "Plumbing Layout Summary", format: "PDF", subtitle: "Water/drainage sizing summary", includes: ["Demand", "Tank sizing", "Pipe sizes"], icon: "🚰", phase: "Plumbing & Services" },
  { key: "propertyTax", name: "Property Tax Assessment Sheet", format: "PDF", subtitle: "Estimated annual tax calculation", includes: ["City rate", "Tax rate", "Step-by-step formula"], icon: "🏷️", phase: "Handover" },
  { key: "asBuilt", name: "As-Built Documentation Template", format: "XLSX", subtitle: "Planned vs actual execution register", includes: ["Variance tracking", "Actual columns", "Completion statement"], icon: "📚", phase: "Handover" },
];
const phaseOrder: Array<{ phase: PhaseGroup; label: string }> = [
  { phase: "Pre-Construction", label: "Pre-Construction (9)" },
  { phase: "Approval & Compliance", label: "Approval & Compliance (4)" },
  { phase: "Execution", label: "Execution (7)" },
  { phase: "Financial", label: "Financial (3)" },
  { phase: "Plumbing & Services", label: "Plumbing & Services (1)" },
  { phase: "Handover", label: "Handover (7)" }
];

function getDefaultRates(city: City, profile: SpecProfile): MaterialRates {
  const factor = cityFactors[city] * profileCards[profile].materialFactor;
  return { cement: Math.round(baseRates.cement * factor), steel: Math.round(baseRates.steel * factor), sand: Math.round(baseRates.sand * factor), bricks: Math.round(baseRates.bricks * factor), tiles: Math.round(baseRates.tiles * factor), labour: Math.round(baseRates.labour * factor) };
}

function getDefaultLabourRates(city: City): LabourRates {
  const masonBase: Record<City, number> = { Mumbai: 900, Delhi: 850, Bangalore: 800, Chennai: 780, Hyderabad: 760, Pune: 780, Ahmedabad: 740, Kolkata: 730, Jaipur: 700, Lucknow: 690, Chandigarh: 760, Kochi: 730, Bhopal: 680, Nagpur: 680, Coimbatore: 710, Vizag: 700, Patna: 670, Indore: 690, Surat: 730, Vadodara: 720 };
  const mason = masonBase[city];
  return { mason, helper: Math.round(mason * 0.65), carpenter: Math.round(mason * 1.1), plumber: Math.round(mason * 1.05), electrician: Math.round(mason * 1.05), painter: Math.round(mason * 0.9) };
}

export default function Home() {
  const pathname = usePathname();
  const isToolRoute = pathname === "/app";
  const [initLoading, setInitLoading] = useState(true);
  const [plotWidth, setPlotWidth] = useState(30);
  const [plotLength, setPlotLength] = useState(40);
  const [floors, setFloors] = useState<Floors>("1");
  const [location, setLocation] = useState<City>("Mumbai");
  const [buildingType, setBuildingType] = useState<ProjectBldType>("2BHK");
  const [structureType, setStructureType] = useState<StructureType>("RCC Framed");
  const [parking, setParking] = useState<ParkingType>("None");
  const [profile, setProfile] = useState<SpecProfile>("Standard");
  const [useCustomRates, setUseCustomRates] = useState(false);
  const [useSiteDevelopment, setUseSiteDevelopment] = useState(false);
  const [useProfessionalInputs, setUseProfessionalInputs] = useState(false);
  const [rates, setRates] = useState<MaterialRates>(getDefaultRates("Mumbai", "Standard"));
  const [labourRates, setLabourRates] = useState<LabourRates>(getDefaultLabourRates("Mumbai"));
  const [includeCompoundWall, setIncludeCompoundWall] = useState(true);
  const [compoundWallHeight, setCompoundWallHeight] = useState<CompoundHeight>("5 ft");
  const [compoundWallType, setCompoundWallType] = useState<CompoundType>("Brick");
  const [wallFinish, setWallFinish] = useState<WallFinish>("Plastered");
  const [includeMainGate, setIncludeMainGate] = useState(true);
  const [gateType, setGateType] = useState<GateType>("MS Fabricated");
  const [gateWidthFt, setGateWidthFt] = useState(10);
  const [gateHeightFt, setGateHeightFt] = useState(5);
  const [includeSideGate, setIncludeSideGate] = useState(false);
  const [smallGateWidthFt, setSmallGateWidthFt] = useState(3);
  const [roomRows, setRoomRows] = useState<RoomDimensionRow[]>(getDefaultRoomRows("2BHK"));
  const [structuralInputs, setStructuralInputs] = useState<StructuralInputs>(structuralDefaults);
  const [openingRows, setOpeningRows] = useState<OpeningRow[]>(getDefaultOpenings("2BHK"));

  const [isGenerating, setIsGenerating] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [latestBoq, setLatestBoq] = useState<BoqResult | null>(null);
  const [timelineWeeks, setTimelineWeeks] = useState(0);

  const [previewDoc, setPreviewDoc] = useState<ReadyDocument | null>(null);
  const [previewSheets, setPreviewSheets] = useState<PreviewSheet[]>([]);
  const [activeSheet, setActiveSheet] = useState(0);
  const [previewPdfUrl, setPreviewPdfUrl] = useState("");

  const [showCompareQuoteSection, setShowCompareQuoteSection] = useState(false);
  const [showCostDistribution, setShowCostDistribution] = useState(false);
  const [showRateIntelligence, setShowRateIntelligence] = useState(false);
  const [aiReview, setAiReview] = useState<AiReview | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [rateIntel, setRateIntel] = useState<RateIntelPayload | null>(null);
  const [rateIntelLoading, setRateIntelLoading] = useState(false);
  const [rateIntelError, setRateIntelError] = useState("");

  const [quoteText, setQuoteText] = useState("");
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareError, setCompareError] = useState("");
  const [compareResult, setCompareResult] = useState<CompareResult | null>(null);
  const [landingPhaseTab, setLandingPhaseTab] = useState<PhaseGroup>("Pre-Construction");

  const [chatOpen, setChatOpen] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: "Hi! I am your BuildDocs AI assistant. I can see your 2BHK project in Mumbai. Ask me anything about your construction - materials, costs, approvals, or timeline." }
  ]);

  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(1);
  const debounceRef = useRef<NodeJS.Timeout>();
  const hasAutoGeneratedRef = useRef(false);

  const resultsRef = useRef<HTMLElement | null>(null);
  const aiEnabled = Boolean(process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY && process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY !== "your_key_here");
  const architectCustomAreaSqft = useMemo(() => roomRows.reduce((sum, r) => sum + (r.lengthFt * r.widthFt), 0), [roomRows]);

  const addToast = (msg: string) => {
    const id = toastId.current++;
    setToasts((t) => [...t, { id, msg }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2600);
  };

  useEffect(() => {
    const tm = setTimeout(() => setInitLoading(false), 450);
    return () => clearTimeout(tm);
  }, []);
  useEffect(() => setRates(getDefaultRates(location, profile)), [location, profile]);
  useEffect(() => setLabourRates(getDefaultLabourRates(location)), [location]);
  useEffect(() => () => { if (previewPdfUrl) URL.revokeObjectURL(previewPdfUrl); }, [previewPdfUrl]);
  useEffect(() => {
    setChatMessages([{ role: "assistant", content: `Hi! I am your BuildDocs AI assistant. I can see your ${buildingType} project in ${location}. Ask me anything about your construction - materials, costs, approvals, or timeline.` }]);
  }, [buildingType, location]);
  useEffect(() => {
    setRoomRows(getDefaultRoomRows(buildingType));
    setOpeningRows(getDefaultOpenings(buildingType));
  }, [buildingType]);
  useEffect(() => {
    if (!isToolRoute) return;
    if (!hasAutoGeneratedRef.current) {
      hasAutoGeneratedRef.current = true;
      void handleGenerateDocuments();
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void handleGenerateDocuments();
    }, 500);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [isToolRoute, plotWidth, plotLength, floors, location, buildingType, structureType, parking, profile, rates, useCustomRates, useSiteDevelopment, useProfessionalInputs, includeCompoundWall, compoundWallHeight, compoundWallType, wallFinish, includeMainGate, gateType, gateWidthFt, gateHeightFt, includeSideGate, smallGateWidthFt, labourRates, roomRows, structuralInputs, openingRows]);

  const plotArea = useMemo(() => Math.max(plotWidth, 0) * Math.max(plotLength, 0), [plotLength, plotWidth]);
  const builtUpArea = useMemo(() => plotArea * 0.6 * Number(floors), [floors, plotArea]);

  const makeDoc = (key: DocKey, boq: BoqResult, startDate: Date): GeneratedDocument => {
    if (key === "boq") return { name: "Bill of Quantities (BOQ)", fileName: `BOQ_${location}_${buildingType}_${Math.round(boq.project.builtUpAreaSqft)}sqft.xlsx`.replaceAll(" ", "_"), mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", icon: "📊", data: new Blob([generateBoqWorkbookArrayBuffer(boq)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }) };
    if (key === "abstract") {
      const pdf = new jsPDF({ unit: "pt", format: "a4" });
      const schedules = boq.scheduleTotals;
      const base = schedules.reduce((s, x) => s + x.amount, 0);
      const overhead = base * 0.15;
      const subtotal = base + overhead;
      const gst = subtotal * 0.18;
      const grand = subtotal + gst;
      let y = 50;
      pdf.setFontSize(14); pdf.text("Abstract of Cost", 40, y); y += 18;
      pdf.setFontSize(10); pdf.text(`${boq.input.buildingType} | ${boq.input.city} | ${boq.input.specificationProfile}`, 40, y); y += 20;
      schedules.forEach((s) => { pdf.text(`${s.scheduleName}`, 40, y); pdf.text(`₹${Math.round(s.amount).toLocaleString("en-IN")}`, 470, y, { align: "right" }); y += 14; });
      y += 8; pdf.line(40, y, 470, y); y += 14;
      [["Schedules Total", base], ["Contractor Profit (15%)", overhead], ["Subtotal", subtotal], ["GST (18%)", gst], ["Grand Total", grand]].forEach(([l, v]) => { pdf.text(String(l), 40, y); pdf.text(`₹${Math.round(v as number).toLocaleString("en-IN")}`, 470, y, { align: "right" }); y += 14; });
      return { name: "Abstract of Cost", fileName: `Abstract_of_Cost_${boq.input.city}.pdf`, mimeType: "application/pdf", icon: "🧾", data: pdf.output("blob") };
    }
    if (key === "measurement") {
      const rows = [
        ["S.No", "Description", "No.", "Length(m)", "Breadth(m)", "Height/Depth(m)", "Quantity"],
        [1, "Excavation for footings", 9, 1.2, 1.2, 1.2, "15.55 Cu.m"],
        [2, "PCC in foundation", 9, 1.2, 1.2, 0.1, "1.30 Cu.m"],
        [3, "RCC in footing + columns", 9, 1.0, 1.0, 0.45, `${(boq.metrics.totalConcreteVolume * 0.35).toFixed(2)} Cu.m`],
        [4, "Brick masonry walls", 1, 1, 1, 1, `${boq.metrics.totalBrickVolume.toFixed(2)} Cu.m`],
        [5, "Plastering works", 1, 1, 1, 1, `${boq.metrics.totalPlasterArea.toFixed(2)} Sq.m`]
      ];
      const ws = XLSX.utils.aoa_to_sheet(rows);
      const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Measurements");
      return { name: "Detailed Measurement Sheet", fileName: `Measurement_Sheet_${boq.input.city}.xlsx`, mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", icon: "📏", data: new Blob([XLSX.write(wb, { bookType: "xlsx", type: "array" })], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }) };
    }
    if (key === "bbs") {
      const area = boq.project.builtUpAreaSqm;
      const rows = [
        ["Member", "Bar Mark", "Dia(mm)", "Shape", "Length(m)", "No. of Bars", "Total Length(m)", "Weight(kg)"],
        ["Footing", "F1", 12, "Straight", 2.4, 36, 86.4, 76.7],
        ["Footing Stirrups", "F2", 8, "Rectangular", 1.8, 72, 129.6, 51.2],
        ["Plinth Beam", "PB1", 12, "Straight", 3.0, Math.round(area * 2), Math.round(area * 6), Math.round(area * 5.3)],
        ["Slab Main", "S1", 10, "Straight", 4.0, Math.round(area * 3), Math.round(area * 12), Math.round(area * 7.4)],
        ["Slab Distribution", "S2", 8, "Straight", 3.5, Math.round(area * 2.5), Math.round(area * 8.75), Math.round(area * 3.5)],
        ["Lintel", "L1", 10, "Straight", 1.5, 40, 60, 37]
      ];
      const ws = XLSX.utils.aoa_to_sheet(rows); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "BBS");
      return { name: "Bar Bending Schedule", fileName: `BBS_${boq.input.city}.xlsx`, mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", icon: "🧱", data: new Blob([XLSX.write(wb, { bookType: "xlsx", type: "array" })], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }) };
    }
    if (key === "mix") {
      const pdf = new jsPDF({ unit: "pt", format: "a4" }); let y = 52;
      pdf.setFontSize(14); pdf.text("Concrete Mix Design Sheet (IS 10262)", 40, y); y += 24;
      [["M20", "26.6", "0.50", "320", "720", "1180", "160", "75-100"], ["M25", "31.6", "0.45", "360", "680", "1150", "162", "75-100"]]
        .forEach((r) => { pdf.setFontSize(11); pdf.text(`Grade ${r[0]} | Target ${r[1]} MPa | W/C ${r[2]}`, 40, y); y += 14; pdf.setFontSize(10); pdf.text(`Cement ${r[3]} kg/cum | FA ${r[4]} kg | CA(20mm) ${r[5]} kg | Water ${r[6]} L | Slump ${r[7]} mm`, 40, y); y += 18; });
      return { name: "Concrete Mix Design Sheet", fileName: `Concrete_Mix_Design_${boq.input.city}.pdf`, mimeType: "application/pdf", icon: "🧪", data: pdf.output("blob") };
    }
    if (key === "rateAnalysis") {
      const rows = [
        ["Item", "Material", "Labour", "Sundries", "Water", "Profit", "Rate"],
        ["PCC", 2800, 700, 200, 60, 564, 4324],
        ["RCC M20", 5200, 1300, 350, 120, 1046, 8016],
        ["Brick Masonry", 3800, 1800, 220, 90, 886, 6796],
        ["Plastering", 1150, 620, 80, 35, 283, 2168],
        ["Flooring", 1450, 550, 90, 25, 317, 2432]
      ];
      const ws = XLSX.utils.aoa_to_sheet(rows); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Rate Analysis");
      return { name: "Material Rate Analysis", fileName: `Rate_Analysis_${boq.input.city}.xlsx`, mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", icon: "📉", data: new Blob([XLSX.write(wb, { bookType: "xlsx", type: "array" })], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }) };
    }
    if (key === "labour") {
      const lr = useCustomRates ? labourRates : getDefaultLabourRates(location);
      const rows = [
        ["Trade", "Daily Wage Rate", "Days Required", "Total Cost", "Phase"],
        ["Mason", lr.mason, Math.max(1, Math.round(boq.metrics.totalBrickVolume / 1.5)), 0, "Foundation/Structure"],
        ["Helper", lr.helper, Math.max(1, Math.round(boq.metrics.totalConcreteVolume / 1.8)), 0, "Foundation/Structure"],
        ["Carpenter", lr.carpenter, Math.max(1, Math.round(boq.metrics.totalConcreteVolume / 2.2)), 0, "Structure"],
        ["Plumber", lr.plumber, Math.max(1, Math.round(boq.project.builtUpAreaSqm / 25)), 0, "Finishing"],
        ["Electrician", lr.electrician, Math.max(1, Math.round(boq.project.builtUpAreaSqm / 22)), 0, "Finishing"],
        ["Painter", lr.painter, Math.max(1, Math.round(boq.metrics.totalPlasterArea / 18)), 0, "Finishing"],
        ["Bar Bender", lr.carpenter, Math.max(1, Math.round(boq.metrics.steelKg / 250)), 0, "Structure"],
        ["Tiler", lr.painter, Math.max(1, Math.round((boq.metrics.flooringMainArea + boq.metrics.flooringDadoArea) / 16)), 0, "Finishing"]
      ].map((r, i) => i === 0 ? r : [r[0], r[1], r[2], Number(r[1]) * Number(r[2]), r[4]]);
      const ws = XLSX.utils.aoa_to_sheet(rows as (string | number)[][]); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Labour");
      return { name: "Labour Requirement & Cost Breakdown", fileName: `Labour_Breakdown_${boq.input.city}.xlsx`, mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", icon: "👷", data: new Blob([XLSX.write(wb, { bookType: "xlsx", type: "array" })], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }) };
    }
    if (key === "approval") {
      const pdf = new jsPDF({ unit: "pt", format: "a4" }); let y = 50;
      pdf.setFontSize(14); pdf.text(`Building Plan Approval Checklist - ${boq.input.city}`, 40, y); y += 20;
      const authority = boq.input.city === "Mumbai" ? "BMC" : boq.input.city === "Bangalore" ? "BBMP/BDA" : "Municipal Corporation";
      ["Title deed copy", "Survey sketch", "Property tax receipts", "Architectural drawings", "Structural drawings", `Submit at ${authority}`, "Typical timeline: 30-60 days", "Estimated fees: 1-3% of project value"].forEach((x) => { pdf.setFontSize(10); pdf.text(`• ${x}`, 40, y); y += 14; });
      return { name: "Building Plan Approval Checklist", fileName: `Approval_Checklist_${boq.input.city}.pdf`, mimeType: "application/pdf", icon: "🏛️", data: pdf.output("blob") };
    }
    if (key === "safety") {
      const pdf = new jsPDF({ unit: "pt", format: "a4" }); let y = 50;
      pdf.setFontSize(14); pdf.text("Site Safety Plan (NBC Guidelines)", 40, y); y += 20;
      ["PPE: helmet, gloves, safety shoes", "First aid station and trained responder", "Fire extinguisher and evacuation route", "Scaffolding inspection checklist", "Excavation edge protection", "Electrical lockout/tagout", "Emergency contacts template"].forEach((x) => { pdf.setFontSize(10); pdf.text(`• ${x}`, 40, y); y += 14; });
      return { name: "Site Safety Plan", fileName: `Site_Safety_Plan_${boq.input.city}.pdf`, mimeType: "application/pdf", icon: "🦺", data: pdf.output("blob") };
    }
    if (key === "payment") return generatePaymentScheduleExcel({ boq, startDate });
    if (key === "procurement") return generateMaterialProcurementExcel({ boq, startDate });
    if (key === "timeline") {
      const doc = generateConstructionTimelinePdf({ boq, startDate });
      doc.name = "Construction Timeline";
      return doc;
    }
    if (key === "dpr") return generateDprTemplatePdf({ boq, startDate });
    if (key === "agreement") return generateContractorAgreementPdf({ boq, startDate });
    if (key === "snag") {
      const rooms = boq.input.buildingType === "2BHK" ? ["Living", "Kitchen", "Bedroom 1", "Bedroom 2", "Bath"] : boq.input.buildingType === "3BHK" ? ["Living", "Kitchen", "Bedroom 1", "Bedroom 2", "Bedroom 3", "Bath 1", "Bath 2"] : ["Living", "Kitchen", "Bedrooms", "Bathrooms", "Balcony"];
      const rows: (string | number)[][] = [["Room", "Category", "Issue Description", "Priority", "Status", "Remarks"]];
      rooms.forEach((r) => rows.push([r, "Civil", "", "Medium", "Open", ""]));
      const ws = XLSX.utils.aoa_to_sheet(rows); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Snag List");
      return { name: "Snag List / Punch List Template", fileName: `Snag_List_${boq.input.city}.xlsx`, mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", icon: "✅", data: new Blob([XLSX.write(wb, { bookType: "xlsx", type: "array" })], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }) };
    }
    if (key === "completion") {
      const pdf = new jsPDF({ unit: "pt", format: "a4" });
      pdf.setFontSize(14); pdf.text("Completion Certificate Application", 40, 50);
      pdf.setFontSize(10);
      ["Owner Name: ____________________", "Project Address: ____________________", `Built-up Area: ${Math.round(boq.project.builtUpAreaSqft)} sqft`, `Building Type: ${boq.input.buildingType}`, `Floors: ${boq.input.floors}`, `Plot: ${boq.input.widthFt} x ${boq.input.lengthFt} ft`, `City: ${boq.input.city}`].forEach((l, i) => pdf.text(l, 40, 86 + i * 16));
      return { name: "Completion Certificate Application", fileName: `Completion_Certificate_${boq.input.city}.pdf`, mimeType: "application/pdf", icon: "📨", data: pdf.output("blob") };
    }
    if (key === "warranty") {
      const rows = [
        ["Item", "Contractor/Brand", "Warranty Period", "Start Date", "Expiry Date", "Contact Number", "Terms"],
        ["Waterproofing", "", "5 years", "", "", "", ""],
        ["Plumbing", "", "2 years", "", "", "", ""],
        ["Electrical", "", "2 years", "", "", "", ""],
        ["Paint", "", "1 year", "", "", "", ""],
        ["Tiles", "", "3 years", "", "", "", ""],
        ["Doors", "", "2 years", "", "", "", ""],
        ["Windows", "", "2 years", "", "", "", ""]
      ];
      const ws = XLSX.utils.aoa_to_sheet(rows); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Warranty");
      return { name: "Warranty & Guarantee Register", fileName: `Warranty_Register_${boq.input.city}.xlsx`, mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", icon: "🛡️", data: new Blob([XLSX.write(wb, { bookType: "xlsx", type: "array" })], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }) };
    }
    if (key === "om") {
      const pdf = new jsPDF({ unit: "pt", format: "a4" }); let y = 50;
      pdf.setFontSize(14); pdf.text("Operation & Maintenance Guide", 40, y); y += 20;
      ["Annual checks: roof waterproofing, plumbing leaks, switchboards", "Warranty summary and expiry tracker", "Emergency contacts template", "Do not drill wet walls before full curing", "Paint touch-up after 6-9 months", "Plumbing care and valve checks"].forEach((l) => { pdf.setFontSize(10); pdf.text(`• ${l}`, 40, y); y += 14; });
      return { name: "Operation & Maintenance Guide", fileName: `OM_Guide_${boq.input.city}.pdf`, mimeType: "application/pdf", icon: "📘", data: pdf.output("blob") };
    }
    if (key === "propertyTax") {
      const pdf = new jsPDF({ unit: "pt", format: "a4" });
      const cityRate: Record<City, number> = { Mumbai: 18, Delhi: 13, Bangalore: 14, Chennai: 12, Hyderabad: 11, Pune: 12, Ahmedabad: 10, Kolkata: 9, Jaipur: 8, Lucknow: 8, Chandigarh: 10, Kochi: 9, Bhopal: 7, Nagpur: 7, Coimbatore: 8, Vizag: 8, Patna: 7, Indore: 8, Surat: 9, Vadodara: 9 };
      const rate = cityRate[boq.input.city] ?? 10;
      const taxRate = 0.12;
      const annual = boq.project.builtUpAreaSqft * rate * taxRate;
      pdf.setFontSize(14); pdf.text("Property Tax Assessment Sheet", 40, 50);
      pdf.setFontSize(10);
      pdf.text(`Built-up area (${Math.round(boq.project.builtUpAreaSqft)} sqft) × city rate (₹${rate}/sqft) × tax rate (${(taxRate * 100).toFixed(0)}%)`, 40, 84);
      pdf.text(`Estimated annual property tax = ₹${Math.round(annual).toLocaleString("en-IN")}`, 40, 104);
      return { name: "Property Tax Assessment Sheet", fileName: `Property_Tax_${boq.input.city}.pdf`, mimeType: "application/pdf", icon: "🏷️", data: pdf.output("blob") };
    }
    if (key === "noc") {
      const pdf = new jsPDF({ unit: "pt", format: "a4" }); let y = 40;
      const letters = [
        "Electricity Board NOC", "Water Supply Board NOC", "Fire Department NOC", "Pollution Control Board NOC", "Airport Authority NOC"
      ];
      letters.forEach((title, idx) => {
        if (idx > 0) pdf.addPage();
        y = 50;
        pdf.setFontSize(13); pdf.text(title, 40, y); y += 20;
        pdf.setFontSize(10);
        ["To: Concerned Department Officer", "From: ____________________", `Subject: Application - ${title}`,
          `Project details: Plot ${boq.input.widthFt}x${boq.input.lengthFt} ft, Built-up ${Math.round(boq.project.builtUpAreaSqft)} sqft, ${boq.input.floors} floors, ${boq.input.city}.`,
          "Respected Sir/Madam, Kindly issue the required NOC for the above residential project. All applicable norms will be complied with.",
          "Signature: ____________________"].forEach((l) => { pdf.text(l, 40, y); y += 16; });
        if (title.includes("Pollution") && boq.project.builtUpAreaSqm < 20000) { pdf.text("Note: May not be applicable for this project size/height.", 40, y + 8); }
        if (title.includes("Airport") && boq.input.floors <= 2) { pdf.text("Note: May not be applicable for this project size/height.", 40, y + 8); }
      });
      return { name: "NOC Application Templates", fileName: `NOC_Templates_${boq.input.city}.pdf`, mimeType: "application/pdf", icon: "🗂️", data: pdf.output("blob") };
    }
    if (key === "raBill") {
      const wb = XLSX.utils.book_new();
      for (let sheetNum = 1; sheetNum <= 3; sheetNum += 1) {
        const rows: (string | number)[][] = [["S.No", "BOQ Item No", "Description", "Unit", "BOQ Qty", "Rate", "BOQ Amount", "Work Done This Period Qty", "Work Done Cumulative Qty", "Amount This Period", "Cumulative Amount", "Balance"]];
        boq.items.slice(0, 25).forEach((i, idx) => rows.push([idx + 1, i.scheduleId, i.description, i.unit, i.quantity, i.rate, i.amount, "", "", "", "", ""]));
        rows.push(["", "", "Previous RA bill amount", "", "", "", "", "", "", "", "", ""], ["", "", "Current bill amount", "", "", "", "", "", "", "", "", ""], ["", "", "TDS deduction 2%", "", "", "", "", "", "", "", "", ""], ["", "", "Retention money 5%", "", "", "", "", "", "", "", "", ""], ["", "", "Net payable", "", "", "", "", "", "", "", "", ""]);
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), `RA Bill ${sheetNum}`);
      }
      return { name: "Running Account (RA) Bill Template", fileName: `RA_Bill_Template_${boq.input.city}.xlsx`, mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", icon: "🧮", data: new Blob([XLSX.write(wb, { bookType: "xlsx", type: "array" })], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }) };
    }
    if (key === "gstInvoice") {
      const wb = XLSX.utils.book_new();
      for (let n = 1; n <= 5; n += 1) {
        const rows = [["Invoice No", ""], ["Date", ""], ["From (Contractor)", ""], ["To (Owner)", ""], ["SAC Code", "9954"], ["Description", ""], ["Taxable Amount", ""], ["CGST 9%", ""], ["SGST 9%", ""], ["IGST 18% (if inter-state)", ""], ["Total Amount", ""], ["Amount in Words", ""], ["Bank Details", ""], ["TDS Note", "2% TDS applicable under section 194C if amount exceeds ₹30,000"]];
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), `Invoice-${n}`);
      }
      return { name: "GST Invoice Template", fileName: `GST_Invoice_Template_${boq.input.city}.xlsx`, mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", icon: "🧾", data: new Blob([XLSX.write(wb, { bookType: "xlsx", type: "array" })], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }) };
    }
    if (key === "bankLoan") {
      const pdf = new jsPDF({ unit: "pt", format: "a4" }); let y = 50;
      pdf.setFontSize(13); pdf.text("To: The Branch Manager, [Bank Name]", 40, y); y += 20;
      pdf.text("Subject: Construction Cost Estimate for Home Loan Disbursement", 40, y); y += 24;
      pdf.setFontSize(10); pdf.text(`Project: ${boq.input.buildingType}, ${boq.input.city}, Plot ${boq.input.widthFt}x${boq.input.lengthFt} ft, Built-up ${Math.round(boq.project.builtUpAreaSqft)} sqft`, 40, y); y += 16;
      const stages: Array<[string, number]> = [["Mobilization", 5], ["Foundation", 10], ["Plinth", 10], ["RCC Frame", 20], ["Masonry", 12], ["Plaster", 10], ["Flooring", 10], ["Electrical/Plumbing", 10], ["Finishes", 8], ["Handover", 5]];
      stages.forEach(([name, pct]) => { pdf.text(`${name} - ${pct}% : ₹${Math.round((boq.totals.grandTotal * pct) / 100).toLocaleString("en-IN")}`, 40, y); y += 14; });
      y += 10; pdf.text(`Total Construction Cost: ₹${Math.round(boq.totals.grandTotal).toLocaleString("en-IN")} | ₹${Math.round(boq.totals.costPerSqft)}/sqft`, 40, y);
      y += 20; pdf.text("Owner Signature: ____________________", 40, y); pdf.text("Engineer Signature: ____________________", 300, y);
      return { name: "Bank Loan Estimation Letter", fileName: `Bank_Loan_Estimation_${boq.input.city}.pdf`, mimeType: "application/pdf", icon: "🏦", data: pdf.output("blob") };
    }
    if (key === "materialInspection") {
      const pdf = new jsPDF({ unit: "pt", format: "a4" });
      const sections = [
        ["Cement", ["Manufacture date (<3 months)", "Bag weight 50kg", "Brand verification", "Storage instructions"]],
        ["Steel", ["Grade Fe500D", "Diameter check", "Rust check", "Mill test certificate", "Bend test"]],
        ["Bricks", ["Dimensions", "Water absorption <20%", "Efflorescence", "Strength", "Color"]],
        ["Sand", ["Silt <8%", "Zone classification", "Organic impurities"]],
        ["Aggregate", ["20/40mm size check", "Flakiness", "Crushing value"]],
        ["Tiles", ["Size uniformity", "Shade match", "Water absorption", "Flatness"]]
      ] as const;
      sections.forEach((s, idx) => { if (idx > 0) pdf.addPage(); let y = 50; pdf.setFontSize(13); pdf.text(`${s[0]} Inspection Checklist`, 40, y); y += 20; pdf.setFontSize(10); ["Material: _____", "Supplier: _____", "Date: _____", "Quantity: _____"].forEach((h) => { pdf.text(h, 40, y); y += 14; }); s[1].forEach((c) => { pdf.text(`☐ Pass  ☐ Fail   ${c}`, 40, y); y += 14; }); pdf.text("Overall Verdict: ______", 40, y + 10); });
      return { name: "Material Inspection Checklist", fileName: `Material_Inspection_${boq.input.city}.pdf`, mimeType: "application/pdf", icon: "🔎", data: pdf.output("blob") };
    }
    if (key === "rccPrepour") {
      const pdf = new jsPDF({ unit: "pt", format: "a4" });
      ["Footing", "Plinth Beam", "Roof Slab", "Lintel"].forEach((stage, idx) => {
        if (idx > 0) pdf.addPage();
        let y = 50; pdf.setFontSize(13); pdf.text(`RCC Pre-Pour Checklist - ${stage}`, 40, y); y += 20;
        ["Shuttering alignment/level", "Oil applied and joints sealed", "Rebar dia and spacing verified", "Cover blocks (25/40mm) placed", "Laps at 40d", "Conduits/sleeves fixed", "Vibrator ready", "Curing arrangement ready", "Engineer signature"].forEach((l) => { pdf.setFontSize(10); pdf.text(`☐ ${l}`, 40, y); y += 14; });
      });
      return { name: "RCC Pre-Pour Checklist", fileName: `RCC_PrePour_${boq.input.city}.pdf`, mimeType: "application/pdf", icon: "🧱", data: pdf.output("blob") };
    }
    if (key === "setbackFar") {
      const roadWidth = 10;
      const front = roadWidth < 9 ? 3 : roadWidth <= 12 ? 4.5 : 6;
      const rear = 1.5; const side = 1.5;
      const buildable = Math.max(0, (boq.input.widthFt - side * 2) * (boq.input.lengthFt - front - rear));
      const farAllowed = 1.8;
      const farProposed = boq.project.builtUpAreaSqft / Math.max(1, boq.project.plotAreaSqft);
      const gcAllowedPct = 65;
      const gcProposedPct = (boq.project.builtUpAreaSqft / Math.max(1, boq.project.plotAreaSqft)) * 100;
      const pdf = new jsPDF({ unit: "pt", format: "a4" });
      pdf.setFontSize(13); pdf.text("Setback & FAR Compliance Sheet", 40, 50);
      pdf.setFontSize(10); [
        ["Plot area", `${Math.round(boq.project.plotAreaSqft)} sqft`],
        ["Front/Rear/Side setback", `${front}m / ${rear}m / ${side}m`],
        ["Buildable area after setbacks", `${Math.round(buildable)} sqft`],
        ["Ground coverage allowed vs proposed", `${gcAllowedPct}% vs ${gcProposedPct.toFixed(1)}% (${gcProposedPct <= gcAllowedPct ? "Compliant" : "Non-Compliant"})`],
        ["FAR allowed vs proposed", `${farAllowed} vs ${farProposed.toFixed(2)} (${farProposed <= farAllowed ? "Compliant" : "Non-Compliant"})`],
        ["Height restriction (typical)", roadWidth < 9 ? "Low-rise recommended" : "As local bylaw and fire norms"]
      ].forEach((r, i) => pdf.text(`${r[0]}: ${r[1]}`, 40, 80 + i * 16));
      // Simple plot diagram with setback and buildable area.
      pdf.rect(320, 78, 200, 140);
      pdf.setDrawColor(37, 99, 235);
      pdf.rect(336, 94, 168, 108);
      pdf.setFillColor(219, 234, 254);
      pdf.rect(350, 108, 140, 80, "F");
      pdf.setTextColor(60, 60, 60); pdf.text("Plot", 324, 232); pdf.text("Setback lines", 392, 232); pdf.text("Buildable area", 430, 108);
      pdf.text("Values based on typical building bylaws. Verify with local municipal authority.", 40, 190);
      return { name: "Setback & FAR Compliance Sheet", fileName: `Setback_FAR_${boq.input.city}.pdf`, mimeType: "application/pdf", icon: "📐", data: pdf.output("blob") };
    }
    if (key === "electricalLoad") {
      const bed = buildingType === "1BHK" ? 1 : buildingType === "2BHK" ? 2 : buildingType === "3BHK" ? 3 : 4;
      const bath = buildingType === "1BHK" ? 1 : buildingType === "2BHK" ? 1 : buildingType === "3BHK" ? 2 : 3;
      const kitchen = 1;
      const living = buildingType === "Duplex" ? 2 : 1;
      const dining = buildingType === "1BHK" ? 0 : 1;
      const lights = bed + bath + kitchen + living + dining + 3;
      const fans = bed + living + dining + 1;
      const sockets = bed * 3 + kitchen * 4 + living * 4 + dining * 2 + 4;
      const ac = bed + 1;
      const geyser = bath;
      const kitchenApp = kitchen * 2;
      const connectedW = (lights * 18) + (fans * 75) + (sockets * 200) + (ac * 1500) + (geyser * 2000) + (kitchenApp * 1000);
      const load = +(connectedW / 1000).toFixed(2);
      const demand = +(load * 0.6).toFixed(2);
      const meter = demand <= 5 ? "Single phase" : "Three phase";
      const pdf = new jsPDF({ unit: "pt", format: "a4" });
      pdf.setFontSize(13); pdf.text("Electrical Load Calculation", 40, 50);
      pdf.setFontSize(10);
      [
        [`Lights (18W x ${lights})`, `${lights * 18} W`], [`Fans (75W x ${fans})`, `${fans * 75} W`], [`Power sockets (200W x ${sockets})`, `${sockets * 200} W`],
        [`AC points (1500W x ${ac})`, `${ac * 1500} W`], [`Geyser points (2000W x ${geyser})`, `${geyser * 2000} W`], [`Kitchen appliances (1000W x ${kitchenApp})`, `${kitchenApp * 1000} W`],
        ["Total connected load", `${load} kW`], ["Demand factor", "0.6"], ["Maximum demand", `${demand} kW`], ["Recommended meter", meter], ["Main breaker", demand <= 5 ? "32A" : "63A"], ["Main cable", demand <= 5 ? "6 sq.mm" : "10 sq.mm"]
      ].forEach((r, i) => pdf.text(`${r[0]}: ${r[1]}`, 40, 82 + i * 14));
      return { name: "Electrical Load Calculation", fileName: `Electrical_Load_${boq.input.city}.pdf`, mimeType: "application/pdf", icon: "⚡", data: pdf.output("blob") };
    }
    if (key === "plumbingSummary") {
      const bhkCount = buildingType === "1BHK" ? 1 : buildingType === "2BHK" ? 2 : buildingType === "3BHK" ? 3 : 4;
      const occupants = (bhkCount * 2) + 1;
      const demand = occupants * 135;
      const tank = Math.round(demand * 1.5);
      const drainagePts = Math.max(6, occupants * 3);
      const supplyPts = Math.max(8, occupants * 4);
      const pdf = new jsPDF({ unit: "pt", format: "a4" });
      pdf.setFontSize(13); pdf.text("Plumbing Layout Summary", 40, 50);
      pdf.setFontSize(10); [["Water supply points (cold + hot)", `${supplyPts}`], ["Drainage points", `${drainagePts}`], ["Pipe sizes", "15mm taps, 20mm main, 75mm waste, 110mm soil"], ["Occupants (BHK×2+1)", `${occupants}`], ["Daily water demand (IS 1172)", `${demand} L/day`], ["Overhead tank sizing", `${tank} L`], ["Septic tank sizing", "As per IS 2470"], ["Rainwater harvesting", boq.project.plotAreaSqft > 2400 ? "Required in most cities" : "Check local bylaw"]].forEach((r, i) => pdf.text(`${r[0]}: ${r[1]}`, 40, 82 + i * 16));
      return { name: "Plumbing Layout Summary", fileName: `Plumbing_Summary_${boq.input.city}.pdf`, mimeType: "application/pdf", icon: "🚰", data: pdf.output("blob") };
    }
    if (key === "costComparison") {
      const eco = generateBoq({ ...boq.input, buildingType: (boq.input.buildingType === "2BHK" && buildingType === "1BHK" ? "2BHK" : boq.input.buildingType), specificationProfile: "Economy", customRates: getDefaultRates(boq.input.city, "Economy") });
      const std = generateBoq({ ...boq.input, specificationProfile: "Standard", customRates: getDefaultRates(boq.input.city, "Standard") });
      const pre = generateBoq({ ...boq.input, specificationProfile: "Premium", customRates: getDefaultRates(boq.input.city, "Premium") });
      const pdf = new jsPDF({ unit: "pt", format: "a4" }); let y = 50;
      pdf.setFontSize(13); pdf.text("Cost Comparison Report", 40, y); y += 20;
      const bySchedule = boq.scheduleTotals.slice(0, 12).map((s, idx) => {
        const e = eco.scheduleTotals[idx]?.amount ?? 0; const st = std.scheduleTotals[idx]?.amount ?? 0; const p = pre.scheduleTotals[idx]?.amount ?? 0;
        return { name: s.scheduleName, e, st, p, jump: st > 0 ? ((p - st) / st) * 100 : 0 };
      });
      bySchedule.forEach((r) => { pdf.setFontSize(9); pdf.text(`${r.name}: E ₹${Math.round(r.e).toLocaleString("en-IN")} | S ₹${Math.round(r.st).toLocaleString("en-IN")} | P ₹${Math.round(r.p).toLocaleString("en-IN")}`, 40, y); y += 13; });
      y += 8;
      [["Economy", eco.totals.grandTotal, eco.totals.costPerSqft], ["Standard", std.totals.grandTotal, std.totals.costPerSqft], ["Premium", pre.totals.grandTotal, pre.totals.costPerSqft]].forEach((r) => { pdf.setFontSize(10); pdf.text(`${r[0]} Total: ₹${Math.round(r[1] as number).toLocaleString("en-IN")} (${Math.round(r[2] as number)}/sqft)`, 40, y); y += 15; });
      const maxJump = bySchedule.sort((a, b) => b.jump - a.jump)[0];
      const diffPct = ((pre.totals.grandTotal - eco.totals.grandTotal) / Math.max(1, eco.totals.grandTotal)) * 100;
      pdf.text(`Overall Premium vs Economy difference: ${diffPct.toFixed(1)}%`, 40, y + 6);
      if (maxJump) pdf.text(`Biggest cost jump: ${maxJump.name}`, 40, y + 20);
      return { name: "Cost Comparison Report", fileName: `Cost_Comparison_${boq.input.city}.pdf`, mimeType: "application/pdf", icon: "📊", data: pdf.output("blob") };
    }
    if (key === "feasibility") {
      const monthlyRate = 0.085 / 12; const n = 20 * 12; const p = boq.totals.grandTotal;
      const emi = (p * monthlyRate * (1 + monthlyRate) ** n) / (((1 + monthlyRate) ** n) - 1);
      const loanAmount = p * 0.8;
      const emi80 = (loanAmount * monthlyRate * (1 + monthlyRate) ** n) / (((1 + monthlyRate) ** n) - 1);
      const pdf = new jsPDF({ unit: "pt", format: "a4" }); let y = 50;
      pdf.setFontSize(14); pdf.text("Project Feasibility Summary", 40, y); y += 20;
      [["Project", `${buildingType} | ${boq.input.city} | Plot ${boq.input.widthFt}x${boq.input.lengthFt} ft | ${Math.round(boq.project.builtUpAreaSqft)} sqft`], ["Cost", `₹${Math.round(boq.totals.grandTotal).toLocaleString("en-IN")} (${Math.round(boq.totals.costPerSqft)}/sqft)`], ["Timeline", `${timelineWeeks} weeks | Milestones: Foundation, Structure, Finishing, Handover`], ["Key quantities", `Steel ${Math.round(boq.metrics.steelKg)} kg | Cement ${Math.round(boq.metrics.totalCementBags)} bags | Bricks ${Math.round(boq.metrics.totalBrickVolume * 500)}`], ["Approvals", `${boq.input.city} municipal + utilities + safety clearances`], ["Estimated EMI (80% loan, 20y @8.5%)", `₹${Math.round(emi80).toLocaleString("en-IN")}/month`], ["Reference EMI (100% loan)", `₹${Math.round(emi).toLocaleString("en-IN")}/month`]].forEach((r) => { pdf.setFontSize(10); pdf.text(`${r[0]}: ${r[1]}`, 40, y); y += 15; });
      return { name: "Project Feasibility Summary", fileName: `Feasibility_Summary_${boq.input.city}.pdf`, mimeType: "application/pdf", icon: "📌", data: pdf.output("blob") };
    }
    if (key === "asBuilt") {
      const rows: (string | number)[][] = [["BOQ Item", "BOQ Qty", "BOQ Rate", "BOQ Amount", "Actual Qty", "Actual Rate", "Actual Amount", "Variance Qty", "Variance Amount", "Remarks"]];
      boq.items.slice(0, 30).forEach((i) => rows.push([i.description, i.quantity, i.rate, i.amount, "", "", "", "", "", ""]));
      rows.push(["Total BOQ Amount", "", "", boq.totals.grandTotal, "", "", "", "", "", ""], ["Total Actual Amount", "", "", "", "", "", "", "", "", ""], ["Total Variance", "", "", "", "", "", "", "", "", ""], ["Variance %", "", "", "", "", "", "", "", "", ""]);
      const ws = XLSX.utils.aoa_to_sheet(rows); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "AsBuilt");
      return { name: "As-Built Documentation Template", fileName: `As_Built_${boq.input.city}.xlsx`, mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", icon: "📚", data: new Blob([XLSX.write(wb, { bookType: "xlsx", type: "array" })], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }) };
    }
    throw new Error("Unknown document");
  };

  const loadRateIntelligence = async (city: City) => {
    setRateIntelLoading(true);
    setRateIntelError("");
    try {
      const res = await fetch(`/api/update-rates?city=${encodeURIComponent(city)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Unable to load rate intelligence");
      setRateIntel(data as RateIntelPayload);
    } catch (e) {
      setRateIntelError(e instanceof Error ? e.message : "Unable to load rate intelligence");
    } finally {
      setRateIntelLoading(false);
    }
  };

  const refreshRates = async () => {
    if (!latestBoq) return;
    setRateIntelLoading(true);
    setRateIntelError("");
    try {
      const res = await fetch("/api/update-rates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ city: latestBoq.input.city })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to refresh rates");
      setRateIntel(data as RateIntelPayload);
      addToast("Rates refreshed");
    } catch (e) {
      setRateIntelError(e instanceof Error ? e.message : "Failed to refresh rates");
    } finally {
      setRateIntelLoading(false);
    }
  };

  const runAiReview = async (boq: BoqResult) => {
    if (!aiEnabled || !isToolRoute) return;
    setAiLoading(true);
    setAiError("");
    try {
      const cementBags = boq.metrics.totalCementBags;
      const res = await fetch("/api/ai-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          built_up_area: boq.project.builtUpAreaSqft,
          city: boq.input.city,
          bhk_type: boq.input.buildingType,
          total_steel_kg: boq.metrics.steelKg,
          total_cement_bags: Math.round(cementBags),
          total_cost: boq.totals.grandTotal,
          cost_per_sqft: boq.totals.costPerSqft,
          spec_profile: boq.input.specificationProfile
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "AI review failed");
      setAiReview(data as AiReview);
    } catch (e) {
      setAiError(e instanceof Error ? e.message : "AI review failed");
    } finally {
      setAiLoading(false);
    }
  };

  const recalculateBoq = () => {
    const ratesForBoq = useCustomRates ? rates : getDefaultRates(location, profile);
    const baseBoq = generateBoq({
      widthFt: plotWidth,
      lengthFt: plotLength,
      floors: Number(floors),
      city: location,
      buildingType: (buildingType === "1BHK" ? "2BHK" : buildingType) as BldType,
      structureType,
      specificationProfile: profile,
      customRates: ratesForBoq
    });
    const basicFloorAreaSqft = baseBoq.project.builtUpAreaSqft;
    const basicExternalWallLengthM = ((plotWidth + plotLength) * 2) / 3.281;
    const basicFloorToCeilingM = 10 / 3.281;
    const basicPlasterAreaSqm = baseBoq.metrics.totalPlasterArea;
    let adjustedBoq: BoqResult = baseBoq;
    if (useProfessionalInputs) {
      const floorToCeilingFt = Number(structuralInputs.floorToCeiling.replace("ft", ""));
      const plinthHeightFt = Number(structuralInputs.plinthHeight.replace("ft", ""));
      const parapetHeightFt = Number(structuralInputs.parapetHeight.replace("ft", ""));
      const slabMm = Number(structuralInputs.slabThickness.replace("mm", ""));
      const colParts = structuralInputs.columnSize.replace("mm", "").split("x").map(Number);
      const beamParts = structuralInputs.beamSize.replace("mm", "").split("x").map(Number);
      const floorsNum = Math.max(1, Number(floors));
      const totalFloorAreaSqft = Math.max(1, roomRows.reduce((sum, r) => sum + (r.lengthFt * r.widthFt), 0));
      const flooringAreaSqm = totalFloorAreaSqft / 10.764;
      const roomPerimeterFt = roomRows.reduce((sum, r) => sum + (2 * (r.lengthFt + r.widthFt)), 0);
      const internalWallLengthM = (roomPerimeterFt / 2) / 3.281;
      const externalWallLengthM = ((plotWidth + plotLength) * 2) / 3.281;
      const floorToCeilingM = floorToCeilingFt / 3.281;
      const wallThicknessM = 0.23;
      const brickVolumeCum = (internalWallLengthM + externalWallLengthM) * floorToCeilingM * wallThicknessM;
      const plasterAreaSqm = (internalWallLengthM + externalWallLengthM) * floorToCeilingM * 2;
      const columnVolume = structuralInputs.columns * ((colParts[0] / 1000) * (colParts[1] / 1000)) * ((plinthHeightFt + floorToCeilingFt * floorsNum) / 3.281);
      const beamLengthM = externalWallLengthM * floorsNum;
      const beamVolume = beamLengthM * ((beamParts[0] / 1000) * (beamParts[1] / 1000));
      const slabVolume = flooringAreaSqm * (slabMm / 1000);
      const parapetVolume = externalWallLengthM * 0.115 * (parapetHeightFt / 3.281);
      const totalConcreteVolume = columnVolume + beamVolume + slabVolume + parapetVolume;
      const steelKg = totalConcreteVolume * 95;
      const totalCementBags = totalConcreteVolume * 7.5;
      const doorWindowCount = openingRows.length;
      console.log("[BOQ DEBUG][Professional ON]", {
        floorAreaSqft: Number(totalFloorAreaSqft.toFixed(2)),
        floorAreaSqm: Number(flooringAreaSqm.toFixed(2)),
        internalWallLengthM: Number(internalWallLengthM.toFixed(2)),
        externalWallLengthM: Number(externalWallLengthM.toFixed(2)),
        plasterAreaSqm: Number(plasterAreaSqm.toFixed(2)),
        ratesMode: useCustomRates ? "custom" : "default"
      });
      const unitAdjustedQty = (unit: string, keyword: "brick" | "plaster" | "floor" | "steel" | "cement" | "concrete" | "doorwindow"): number | null => {
        const u = unit.toLowerCase();
        if (keyword === "brick") return u.includes("cu.m") || u.includes("cum") ? brickVolumeCum : brickVolumeCum * 35.3147;
        if (keyword === "plaster") return u.includes("sq.m") ? plasterAreaSqm : plasterAreaSqm * 10.7639;
        if (keyword === "floor") return u.includes("sq.m") ? flooringAreaSqm : flooringAreaSqm * 10.7639;
        if (keyword === "steel") return steelKg;
        if (keyword === "cement") return totalCementBags;
        if (keyword === "concrete") return u.includes("cu.m") || u.includes("cum") ? totalConcreteVolume : totalConcreteVolume * 35.3147;
        if (keyword === "doorwindow") return doorWindowCount;
        return null;
      };
      const nextItems = baseBoq.items.map((it) => {
        const d = it.description.toLowerCase();
        let quantity = it.quantity;
        if (d.includes("brick") || d.includes("masonry")) quantity = unitAdjustedQty(it.unit, "brick") ?? quantity;
        else if (d.includes("plaster")) quantity = unitAdjustedQty(it.unit, "plaster") ?? quantity;
        else if (d.includes("floor") || d.includes("tile")) quantity = unitAdjustedQty(it.unit, "floor") ?? quantity;
        else if (d.includes("steel") || d.includes("reinforcement") || d.includes("rebar")) quantity = unitAdjustedQty(it.unit, "steel") ?? quantity;
        else if (d.includes("cement")) quantity = unitAdjustedQty(it.unit, "cement") ?? quantity;
        else if (d.includes("rcc") || d.includes("concrete")) quantity = unitAdjustedQty(it.unit, "concrete") ?? quantity;
        else if (d.includes("door") || d.includes("window")) quantity = unitAdjustedQty(it.unit, "doorwindow") ?? quantity;
        return { ...it, quantity, amount: quantity * it.rate };
      });
      const scheduleTotalsMap = new Map<string, number>();
      nextItems.forEach((it) => scheduleTotalsMap.set(it.scheduleId, (scheduleTotalsMap.get(it.scheduleId) ?? 0) + it.amount));
      const scheduleTotals = baseBoq.scheduleTotals.map((s) => ({ ...s, amount: scheduleTotalsMap.get(s.scheduleId) ?? s.amount }));
      const grandTotal = scheduleTotals.reduce((sum, s) => sum + s.amount, 0);
      adjustedBoq = {
        ...baseBoq,
        items: nextItems,
        scheduleTotals,
        project: { ...baseBoq.project, builtUpAreaSqft: totalFloorAreaSqft },
        metrics: { ...baseBoq.metrics, totalConcreteVolume, totalBrickVolume: brickVolumeCum, totalPlasterArea: plasterAreaSqm, flooringMainArea: flooringAreaSqm, steelKg, totalCementBags },
        totals: { ...baseBoq.totals, grandTotal, costPerSqft: grandTotal / Math.max(1, totalFloorAreaSqft) }
      };
    } else {
      console.log("[BOQ DEBUG][Professional OFF]", {
        floorAreaSqft: Number(basicFloorAreaSqft.toFixed(2)),
        externalWallLengthM: Number(basicExternalWallLengthM.toFixed(2)),
        floorToCeilingM: Number(basicFloorToCeilingM.toFixed(2)),
        plasterAreaSqm: Number(basicPlasterAreaSqm.toFixed(2)),
        ratesMode: useCustomRates ? "custom" : "default"
      });
    }
    const perimeterFt = (plotWidth + plotLength) * 2;
    const wallHeightFt = Number(compoundWallHeight.replace(" ft", ""));
    const gateTotalWidthFt = (includeMainGate ? gateWidthFt : 0) + (includeSideGate ? smallGateWidthFt : 0);
    const wallLengthFt = Math.max(0, perimeterFt - gateTotalWidthFt);
    const wallRatesPerSqft: Record<CompoundType, number> = { Brick: 420, Block: 360, Stone: 520 };
    const gateRatesPerSqft: Record<GateType, number> = { "MS Fabricated": 850, "MS with Sheet": 850, "Wrought Iron": 1200, "SS Gate": 1800 };
    const compoundWallCost = includeCompoundWall ? wallLengthFt * wallHeightFt * wallRatesPerSqft[compoundWallType] : 0;
    const mainGateCost = includeMainGate ? gateWidthFt * gateHeightFt * gateRatesPerSqft[gateType] : 0;
    const sideGateCost = includeSideGate ? smallGateWidthFt * gateHeightFt * gateRatesPerSqft[gateType] : 0;
    const siteDevCostRaw = compoundWallCost + mainGateCost + sideGateCost;
    const siteDevCost = useSiteDevelopment ? siteDevCostRaw : 0;
    const boq: BoqResult = {
      ...adjustedBoq,
      totals: {
        ...adjustedBoq.totals,
        grandTotal: adjustedBoq.totals.grandTotal + siteDevCost,
        costPerSqft: adjustedBoq.project.builtUpAreaSqft > 0 ? (adjustedBoq.totals.grandTotal + siteDevCost) / adjustedBoq.project.builtUpAreaSqft : adjustedBoq.totals.costPerSqft
      },
      scheduleTotals: adjustedBoq.scheduleTotals.map((s) => s.scheduleId === "L" ? { ...s, amount: s.amount + siteDevCost } : s)
    };
    const startDate = new Date();
    const timeline = getTimelineSummary({ boq, startDate });
    setTimelineWeeks(timeline.totalWeeks);
    setLatestBoq(boq);
    if (aiEnabled) {
      void runAiReview(boq);
    } else {
      setAiReview(null);
      setAiError("");
      setAiLoading(false);
    }
  };

  const getDescriptorByKey = (key: DocKey) => docDescriptors.find((d) => d.key === key) ?? null;

  const buildReadyDoc = (key: DocKey, boq: BoqResult, startDate: Date): ReadyDocument => {
    const doc = makeDoc(key, boq, startDate);
    const descriptor = getDescriptorByKey(key);
    const subtitle = key === "timeline"
      ? `${(subtitleMap[key] ?? descriptor?.subtitle ?? "Construction timeline")} with ${timelineWeeks} week duration`
      : (subtitleMap[key] ?? descriptor?.subtitle ?? "");
    const includes = includesMap[key] ?? descriptor?.includes ?? [];
    return {
      ...doc,
      key,
      format: doc.mimeType.includes("pdf") ? "PDF" : "XLSX",
      subtitle,
      includes,
      sizeLabel: `${(doc.data.size / 1024).toFixed(1)} KB`
    };
  };

  const generateAll = async () => {
    if (!latestBoq) return;
    setIsGenerating(true);
    setStatusMessage("");
    try {
      const keys: DocKey[] = docDescriptors.map((d) => d.key);
      const readyDocs: ReadyDocument[] = [];
      const startDate = new Date();
      for (let i = 0; i < keys.length; i += 1) {
        setStatusMessage(`Generating document ${i + 1} of ${keys.length}...`);
        readyDocs.push(buildReadyDoc(keys[i], latestBoq, startDate));
      }
      const zip = new JSZip();
      readyDocs.forEach((doc) => zip.file(doc.fileName, doc.data));
      addToast("Download started");
      const builtZip = await zip.generateAsync({ type: "blob" });
      const builtZipName = `BuildDocs_${location}_${buildingType}_${new Date().toISOString().slice(0, 10)}.zip`.replaceAll(" ", "_");
      saveAs(builtZip, builtZipName);
      addToast("Download complete");
      setStatusMessage(`Generated all ${keys.length} documents.`);
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
      void runAiReview(latestBoq);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateDocuments = () => {
    if (!isToolRoute) return;
    recalculateBoq();
  };

  const handleCompareQuote = async () => {
    if (!latestBoq) return;
    if (!aiEnabled) {
      setCompareError("Add your Anthropic API key in .env.local to enable AI features");
      return;
    }
    setCompareLoading(true);
    setCompareError("");
    try {
      const keyRates = Object.fromEntries(latestBoq.items.slice(0, 12).map((i) => [i.description.slice(0, 36), i.rate]));
      const res = await fetch("/api/ai-compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bhk_type: latestBoq.input.buildingType,
          area: Math.round(latestBoq.project.builtUpAreaSqft),
          city: latestBoq.input.city,
          spec_profile: latestBoq.input.specificationProfile,
          key_rates: keyRates,
          contractor_quote: quoteText
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Comparison failed");
      setCompareResult(data as CompareResult);
    } catch (e) {
      setCompareError(e instanceof Error ? e.message : "Comparison failed");
    } finally {
      setCompareLoading(false);
    }
  };

  const handleChatSend = async (prompt?: string) => {
    if (!latestBoq || !aiEnabled) return;
    const text = (prompt ?? chatInput).trim();
    if (!text) return;
    const next = [...chatMessages, { role: "user", content: text } as ChatMessage];
    setChatMessages(next);
    setChatInput("");
    setChatLoading(true);
    try {
      const cement = Math.round(latestBoq.metrics.totalCementBags);
      const res = await fetch("/api/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          context: {
            bhk_type: latestBoq.input.buildingType,
            area: Math.round(latestBoq.project.builtUpAreaSqft),
            city: latestBoq.input.city,
            spec_profile: latestBoq.input.specificationProfile,
            total: latestBoq.totals.grandTotal,
            steel: Math.round(latestBoq.metrics.steelKg),
            cement,
            bricks: Math.round(latestBoq.metrics.totalBrickVolume * 500)
          },
          history: next
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Chat failed");
      setChatMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
    } catch (e) {
      setChatMessages((prev) => [...prev, { role: "assistant", content: e instanceof Error ? e.message : "Chat failed" }]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleShare = async () => {
    if (!latestBoq) return;
    const id = Math.random().toString(36).slice(2, 10);
    const cement = latestBoq.metrics.totalCementBags;
    const payload = {
      project: {
        plot: `${latestBoq.input.widthFt}x${latestBoq.input.lengthFt} ft`,
        city: latestBoq.input.city,
        type: latestBoq.input.buildingType,
        area: Math.round(latestBoq.project.builtUpAreaSqft),
        cost: latestBoq.totals.grandTotal,
        costPerSqft: latestBoq.totals.costPerSqft,
        spec: latestBoq.input.specificationProfile
      },
      quantities: { steel: latestBoq.metrics.steelKg, cement, bricks: latestBoq.metrics.totalBrickVolume * 500 },
      chart: scheduleChart.map((x) => ({ label: x.label, amount: x.amount, pct: x.pct, color: x.color }))
    };
    localStorage.setItem(`builddocs-share-${id}`, JSON.stringify(payload));
    const url = `${window.location.origin}/share/${id}`;
    await navigator.clipboard.writeText(url);
    addToast("Link copied! Share with your contractor or engineer.");
  };

  const openPreview = async (doc: ReadyDocument) => {
    setPreviewDoc(doc);
    setActiveSheet(0);
    if (previewPdfUrl) URL.revokeObjectURL(previewPdfUrl);
    setPreviewPdfUrl("");
    setPreviewSheets([]);
    if (doc.format === "PDF") {
      setPreviewPdfUrl(URL.createObjectURL(doc.data));
      return;
    }
    const wb = XLSX.read(await doc.data.arrayBuffer(), { type: "array" });
    setPreviewSheets(wb.SheetNames.map((name) => ({ name, rows: (XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: "" }) as Array<Array<string | number>>).slice(0, 20) })));
  };

  const closePreview = () => {
    setPreviewDoc(null);
    setPreviewSheets([]);
    if (previewPdfUrl) URL.revokeObjectURL(previewPdfUrl);
    setPreviewPdfUrl("");
  };
  const getDocByKey = (key: DocKey): ReadyDocument | null => {
    if (!latestBoq) return null;
    return buildReadyDoc(key, latestBoq, new Date());
  };
  const openPreviewByKey = async (key: DocKey) => {
    const doc = getDocByKey(key);
    if (!doc) return;
    await openPreview(doc);
  };
  const downloadDocByKey = (key: DocKey) => {
    const doc = getDocByKey(key);
    if (!doc) return;
    saveAs(doc.data, doc.fileName);
  };
  const downloadDoc = (doc: GeneratedDocument) => saveAs(doc.data, doc.fileName);
  const handleDownloadAll = () => { void generateAll(); };

  const scheduleChart = useMemo(() => {
    if (!latestBoq) return [];
    const labels: Record<string, string> = { A: "Earthwork", B: "Concrete", C: "Masonry", D: "Shuttering", E: "Steel", F: "Plastering", G: "Flooring", H: "Doors & Windows", I: "Plumbing", J: "Electrical", K: "Painting", L: "Miscellaneous" };
    const maxAmt = Math.max(...latestBoq.scheduleTotals.map((s) => s.amount));
    const minAmt = Math.min(...latestBoq.scheduleTotals.map((s) => s.amount));
    return latestBoq.scheduleTotals.map((s) => {
      const t = maxAmt === minAmt ? 1 : (s.amount - minAmt) / (maxAmt - minAmt);
      const hue = Math.round(210 + (223 - 210) * t);
      const sat = Math.round(85 - 20 * t);
      const light = Math.round(78 - 42 * t);
      return {
        id: s.scheduleId,
        label: labels[s.scheduleId] ?? s.scheduleName,
        amount: s.amount,
        pct: latestBoq.totals.schedulesTotal > 0 ? (s.amount / latestBoq.totals.schedulesTotal) * 100 : 0,
        color: `hsl(${hue} ${sat}% ${light}%)`,
        isMax: s.amount === maxAmt
      };
    });
  }, [latestBoq]);

  useEffect(() => {
    if (latestBoq) void loadRateIntelligence(latestBoq.input.city);
  }, [latestBoq]);

  const boqAiBadge = () => {
    if (aiLoading) return <span className="inline-flex min-w-[118px] justify-center rounded-[12px] bg-[#F5F5F3] px-[10px] py-[3px] text-[11px] text-[#6B7280]">AI reviewing...</span>;
    if (aiError) return <span className="inline-flex min-w-[118px] justify-center rounded-[12px] bg-[#F5F5F3] px-[10px] py-[3px] text-[11px] text-[#6B7280]">AI unavailable</span>;
    if (!aiReview) return null;
    if (aiReview.overall_verdict === "Looks Good") return <span className="inline-flex min-w-[118px] justify-center rounded-[12px] bg-[#ECFDF5] px-[10px] py-[3px] text-[11px] text-[#059669]">✓ Looks Good</span>;
    if (aiReview.overall_verdict === "Needs Review") return <span className="inline-flex min-w-[118px] justify-center rounded-[12px] bg-[#FEF3C7] px-[10px] py-[3px] text-[11px] text-[#B45309]">⚠ Needs Review</span>;
    return <span className="inline-flex min-w-[118px] justify-center rounded-[12px] bg-[#FEE2E2] px-[10px] py-[3px] text-[11px] text-[#B91C1C]">✕ Concerns</span>;
  };

  if (initLoading) {
    return (
      <main className="mx-auto max-w-6xl animate-pulse px-4 py-8">
        <div className="h-10 w-64 rounded bg-gray-200" />
        <div className="mt-6 rounded-2xl border p-8">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-16 rounded bg-gray-100" />
            ))}
          </div>
          <div className="mt-6 h-12 rounded bg-gray-200" />
        </div>
      </main>
    );
  }

  return (
    <main className={`${inter.className} min-h-screen bg-[#FAFAF8] text-[#1A1A2E]`}>
      <div className="fixed right-4 top-4 z-50 space-y-2">
        {toasts.map((t) => (
          <div key={t.id} className="rounded-xl bg-[#1A1A2E] px-3 py-2 text-sm text-white shadow-sm">{t.msg}</div>
        ))}
      </div>

      <header className="border-b border-[#F0F0ED] bg-white">
        <div className="mx-auto flex w-full max-w-[1100px] items-center justify-between px-5 py-4 sm:px-12">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#0066FF] to-[#14B8A6] text-sm text-white">▣</div>
            <h1 className="text-[22px] font-extrabold text-[#1A1A2E]">BuildDocs.ai <span className="ml-1 rounded border border-[#E5E7EB] px-1.5 py-0.5 align-super text-[10px] font-semibold text-[#6B7280]">BETA</span></h1>
          </div>
          {isToolRoute ? (
            <div className="flex items-center gap-4">
              <div className="h-8 w-8 rounded-full border border-[#E5E7EB] bg-white" />
            </div>
          ) : (
            <div className="flex items-center gap-4 text-[13px] font-semibold text-[#6B7280]">
              <a href="#features" className="hover:text-[#2563EB]">Features</a>
              <a href="#pricing" className="hover:text-[#2563EB]">Pricing</a>
              <a href="#faq" className="hover:text-[#2563EB]">FAQ</a>
            </div>
          )}
        </div>
      </header>

      <div className="mx-auto max-w-[1100px] px-5 py-10 sm:px-12 sm:py-12">
        {!isToolRoute && <section className="relative grid min-h-[calc(100vh-56px)] place-items-center pt-10 pb-4 text-center [background-image:linear-gradient(#F0F0ED_1px,transparent_1px),linear-gradient(90deg,#F0F0ED_1px,transparent_1px)] [background-size:28px_28px]">
          <div>
            <h2 className="text-[40px] font-medium leading-[1.15] tracking-[-0.02em] text-[#1A1A2E] sm:text-[52px]">
              Every Construction Document<span className="bg-gradient-to-r from-[#2563EB] to-[#06B6A4] bg-clip-text text-transparent">.</span>
              <br />
              One Click<span className="bg-gradient-to-r from-[#2563EB] to-[#06B6A4] bg-clip-text text-transparent">.</span>
            </h2>
            <p className="mx-auto mt-5 max-w-[520px] text-[17px] font-normal leading-[1.6] text-[#6B7280]">
              From plot dimensions to complete construction documentation — BOQ, estimates, timelines, and agreements — generated instantly.
            </p>
            <p className="mt-4 text-[12px] tracking-[0.5px] text-[#9CA3AF]"><span className="text-[#2563EB]">✓</span> Free to try · <span className="text-[#2563EB]">✓</span> No signup required · <span className="text-[#2563EB]">✓</span> CPWD/DSR compliant</p>
            <Link href="/app" className="mt-8 inline-block rounded-full bg-gradient-to-r from-[#2563EB] to-[#06B6A4] px-9 py-4 text-[17px] font-semibold text-white shadow-[0_6px_20px_rgba(37,99,235,0.25)] transition-all duration-200 ease-in hover:-translate-y-0.5 hover:from-[#1D4ED8] hover:to-[#0891B2] hover:shadow-[0_10px_26px_rgba(37,99,235,0.35)]">Start Building →</Link>
          </div>
        </section>}

        {!isToolRoute && <section className="relative z-10 -mt-24 bg-[#FAFAF8] pt-3 pb-[120px]">
          <div className={`mx-auto grid max-w-[900px] grid-cols-2 overflow-hidden ${shellCardClass} md:grid-cols-4`}>
            {["20 Cities", "31 Documents", "AI BOQ Review", "Code-Compliant"].map((item) => (
              <div key={item} className="px-4 py-3 text-center text-[13px] font-semibold text-[#1A1A2E]">{item}</div>
            ))}
          </div>
        </section>}

        {!isToolRoute && <section id="features" className="py-20">
          <h3 className="text-center text-[32px] font-medium text-[#1A1A2E]">Everything you need to build</h3>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {phaseOrder.map((phase) => (
              <button key={phase.phase} type="button" onClick={() => setLandingPhaseTab(phase.phase)} className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${landingPhaseTab === phase.phase ? "border-transparent bg-gradient-to-r from-[#2563EB] to-[#06B6A4] text-white" : "border-[#E5E7EB] bg-white text-[#1A1A2E]"}`}>
                {phase.phase}
              </button>
            ))}
          </div>
          <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
            {docDescriptors.filter((doc) => doc.phase === landingPhaseTab).map((doc) => (
              <div key={doc.key} className="rounded-xl border border-[#F0F0ED] bg-white p-4">
                <p className="text-2xl">{doc.icon}</p>
                <p className="mt-2 text-sm font-semibold text-[#1A1A2E]">{doc.name}</p>
                <p className="mt-1 text-xs text-[#6B7280]">{doc.subtitle}</p>
                <span className={`mt-3 inline-block rounded-full px-2 py-1 text-[11px] font-semibold ${doc.format === "XLSX" ? "bg-[#EFF6FF] text-[#2563EB]" : "bg-[#FEF2F2] text-[#DC2626]"}`}>{doc.format}</span>
              </div>
            ))}
          </div>
        </section>}

        {isToolRoute && <section id="tool" className="py-10">
        <div className={`no-print p-6 ${shellCardClass}`}>
          <form className="space-y-9">
            <section className={`${shellCardClass} p-6 ring-1 ring-[#E8EEF8]`}>
              <p className="text-[11px] font-semibold tracking-[1.4px] text-[#6B7280]">QUICK ESTIMATE</p>
              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="text-sm font-semibold text-[#1A1A2E]">Plot Width (ft)<input type="number" className={inputClass} value={plotWidth} onChange={(e) => setPlotWidth(Number(e.target.value))} min={0} /></label>
                <label className="text-sm font-semibold text-[#1A1A2E]">Plot Length (ft)<input type="number" className={inputClass} value={plotLength} onChange={(e) => setPlotLength(Number(e.target.value))} min={0} /></label>
                <label className="text-sm font-semibold text-[#1A1A2E]">Number of Floors<select className={inputClass} value={floors} onChange={(e) => setFloors(e.target.value as Floors)}><option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option></select></label>
                <label className="text-sm font-semibold text-[#1A1A2E]">Location<select className={inputClass} value={location} onChange={(e) => setLocation(e.target.value as City)}>{cities.map((city) => <option key={city} value={city}>{city}</option>)}</select></label>
              </div>
              <fieldset className="mt-4"><legend className="text-sm font-semibold text-[#1A1A2E]">Building Type</legend><div className="mt-2 flex flex-wrap gap-2 text-sm">{(["1BHK", "2BHK", "3BHK", "4BHK", "Duplex"] as const).map((type) => <button key={type} type="button" onClick={() => setBuildingType(type)} className={`${pillClass} ${buildingType === type ? "bg-gradient-to-r from-[#2563EB] to-[#06B6A4] text-white" : "bg-[#F5F5F3] text-[#1A1A2E]"}`}>{type}</button>)}</div></fieldset>
              <fieldset className="mt-4"><legend className="text-sm font-semibold text-[#1A1A2E]">Structure Type</legend><div className="mt-2 flex flex-wrap gap-2 text-sm">{(["RCC Framed", "Load Bearing"] as const).map((type) => <button key={type} type="button" onClick={() => setStructureType(type)} className={`${pillClass} ${structureType === type ? "bg-gradient-to-r from-[#2563EB] to-[#06B6A4] text-white" : "bg-[#F5F5F3] text-[#1A1A2E]"}`}>{type}</button>)}</div></fieldset>
              <fieldset className="mt-4"><legend className="text-sm font-semibold text-[#1A1A2E]">Parking</legend><div className="mt-2 flex flex-wrap gap-2 text-sm">{(["None", "Open", "Covered"] as const).map((type) => <button key={type} type="button" onClick={() => setParking(type)} className={`${pillClass} ${parking === type ? "bg-gradient-to-r from-[#2563EB] to-[#06B6A4] text-white" : "bg-[#F5F5F3] text-[#1A1A2E]"}`}>{type}</button>)}</div></fieldset>
              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">{(Object.keys(profileCards) as SpecProfile[]).map((key) => { const accent = key === "Economy" ? "#059669" : key === "Standard" ? "#2563EB" : "#7C3AED"; return <button key={key} type="button" onClick={() => setProfile(key)} className={`relative h-40 rounded-xl border bg-white p-4 text-left transition ${profile === key ? "scale-[1.02] shadow-[0_8px_20px_rgba(0,0,0,0.06)]" : "shadow-[0_1px_3px_rgba(0,0,0,0.04)]"}`} style={{ borderColor: "#F0F0ED", borderLeftWidth: 5, borderLeftColor: "#2563EB" }}><p className="text-base font-semibold text-[#1A1A2E]">{key}</p><p className="mt-1 text-sm font-semibold" style={{ color: accent }}>{profileCards[key].hint}</p><p className="mt-2 text-sm text-[#6B7280]">{profileCards[key].description}</p>{profile === key && <span className="absolute right-3 top-3 text-sm font-semibold" style={{ color: accent }}>✓</span>}</button>; })}</div>
            </section>

            <section className={`${optionalSectionCardClass} ${useCustomRates ? "opacity-100" : "opacity-70"}`}>
              <label className="flex cursor-pointer items-center gap-3 border-b border-[#ECEFF3] px-6 py-5">
                <input type="checkbox" checked={useCustomRates} onChange={(e) => setUseCustomRates(e.target.checked)} className="h-4 w-4 shrink-0 rounded border-[#D1D5DB] text-[#2563EB] focus:ring-[#2563EB]" />
                <span className={`min-w-0 flex-1 text-[16px] font-semibold tracking-[-0.01em] ${useCustomRates ? "text-[#1A1A2E]" : "text-[#9CA3AF]"}`}>Custom Material Rates</span>
                <svg className={`h-5 w-5 shrink-0 text-[#9CA3AF] transition-transform duration-300 ease-out ${useCustomRates ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
              </label>
              <div className={`grid transition-all duration-300 ease-out ${useCustomRates ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
                <div className="min-h-0 overflow-hidden">
                  <div className={`px-6 pb-6 pt-6 ${!useCustomRates ? "pointer-events-none" : ""}`}>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{[{ key: "cement", label: "Cement (₹/bag)" }, { key: "steel", label: "Steel (₹/kg)" }, { key: "sand", label: "Sand (₹/brass)" }, { key: "bricks", label: "Bricks (₹/1000)" }, { key: "tiles", label: "Tiles (₹/sqft)" }, { key: "labour", label: "Labour (₹/day)" }].map((field) => <label key={field.key} className="text-sm font-semibold text-[#1A1A2E]">{field.label}<input type="number" className={inputClass} disabled={!useCustomRates} value={rates[field.key as keyof MaterialRates]} onChange={(e) => setRates((prev) => ({ ...prev, [field.key]: Number(e.target.value) }))} min={0} /></label>)}</div>
                    <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{[{ key: "mason", label: "Mason (₹/day)" }, { key: "helper", label: "Helper (₹/day)" }, { key: "carpenter", label: "Carpenter (₹/day)" }, { key: "plumber", label: "Plumber (₹/day)" }, { key: "electrician", label: "Electrician (₹/day)" }, { key: "painter", label: "Painter (₹/day)" }].map((field) => <label key={field.key} className="text-sm font-semibold text-[#1A1A2E]">{field.label}<input type="number" className={inputClass} disabled={!useCustomRates} value={labourRates[field.key as keyof LabourRates]} onChange={(e) => setLabourRates((prev) => ({ ...prev, [field.key]: Number(e.target.value) }))} min={0} /></label>)}</div>
                  </div>
                </div>
              </div>
            </section>

            <section className={`${optionalSectionCardClass} ${useSiteDevelopment ? "opacity-100" : "opacity-70"}`}>
              <label className="flex cursor-pointer items-center gap-3 border-b border-[#ECEFF3] px-6 py-5">
                <input type="checkbox" checked={useSiteDevelopment} onChange={(e) => setUseSiteDevelopment(e.target.checked)} className="h-4 w-4 shrink-0 rounded border-[#D1D5DB] text-[#2563EB] focus:ring-[#2563EB]" />
                <span className={`min-w-0 flex-1 text-[16px] font-semibold tracking-[-0.01em] ${useSiteDevelopment ? "text-[#1A1A2E]" : "text-[#9CA3AF]"}`}>Site Development</span>
                <svg className={`h-5 w-5 shrink-0 text-[#9CA3AF] transition-transform duration-300 ease-out ${useSiteDevelopment ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
              </label>
              <div className={`grid transition-all duration-300 ease-out ${useSiteDevelopment ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
                <div className="min-h-0 overflow-hidden">
                  <div className={`space-y-0 px-6 pb-6 pt-6 ${!useSiteDevelopment ? "pointer-events-none" : ""}`}>
                    <div className={optionalRowClass}>
                      <span className="w-[10rem] shrink-0 text-sm font-semibold text-[#1A1A2E]">Compound Wall</span>
                      <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2">
                        <span className="mr-1 text-xs font-medium text-[#6B7280]">Include</span>
                        <button type="button" disabled={!useSiteDevelopment} onClick={() => setIncludeCompoundWall(true)} className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${includeCompoundWall ? "border-transparent bg-gradient-to-r from-[#2563EB] to-[#06B6A4] text-white" : "border-[#E5E7EB] bg-white text-[#1A1A2E]"}`}>Yes</button>
                        <button type="button" disabled={!useSiteDevelopment} onClick={() => setIncludeCompoundWall(false)} className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${!includeCompoundWall ? "border-transparent bg-gradient-to-r from-[#2563EB] to-[#06B6A4] text-white" : "border-[#E5E7EB] bg-white text-[#1A1A2E]"}`}>No</button>
                        {includeCompoundWall && (
                          <>
                            <span className="mx-1 h-4 w-px shrink-0 bg-[#E5E7EB]" aria-hidden />
                            <label className="flex items-center gap-2 text-xs font-semibold text-[#6B7280]"><span className="whitespace-nowrap">Height</span><select className={inlineSelectClass} value={compoundWallHeight} onChange={(e) => setCompoundWallHeight(e.target.value as CompoundHeight)}><option>3 ft</option><option>4 ft</option><option>5 ft</option><option>6 ft</option></select></label>
                            <div className="flex flex-wrap items-center gap-1.5">{(["Brick", "Block", "Stone"] as const).map((x) => <button key={x} type="button" onClick={() => setCompoundWallType(x)} className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${compoundWallType === x ? "border-transparent bg-gradient-to-r from-[#2563EB] to-[#06B6A4] text-white" : "border-[#E5E7EB] bg-white text-[#1A1A2E]"}`}>{x}</button>)}</div>
                            <div className="flex flex-wrap items-center gap-1.5">{([["Plastered", "Plastered"], ["Exposed", "Exposed Brick"], ["Textured", "Textured"]] as const).map(([short, val]) => <button key={val} type="button" onClick={() => setWallFinish(val)} className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${wallFinish === val ? "border-transparent bg-gradient-to-r from-[#2563EB] to-[#06B6A4] text-white" : "border-[#E5E7EB] bg-white text-[#1A1A2E]"}`}>{short}</button>)}</div>
                          </>
                        )}
                      </div>
                    </div>
                    <div className={optionalRowClass}>
                      <span className="w-[10rem] shrink-0 text-sm font-semibold text-[#1A1A2E]">Main Gate</span>
                      <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2">
                        <span className="mr-1 text-xs font-medium text-[#6B7280]">Include</span>
                        <button type="button" disabled={!useSiteDevelopment} onClick={() => setIncludeMainGate(true)} className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${includeMainGate ? "border-transparent bg-gradient-to-r from-[#2563EB] to-[#06B6A4] text-white" : "border-[#E5E7EB] bg-white text-[#1A1A2E]"}`}>Yes</button>
                        <button type="button" disabled={!useSiteDevelopment} onClick={() => setIncludeMainGate(false)} className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${!includeMainGate ? "border-transparent bg-gradient-to-r from-[#2563EB] to-[#06B6A4] text-white" : "border-[#E5E7EB] bg-white text-[#1A1A2E]"}`}>No</button>
                        {includeMainGate && (
                          <>
                            <span className="mx-1 h-4 w-px shrink-0 bg-[#E5E7EB]" aria-hidden />
                            <div className="flex flex-wrap items-center gap-1.5">{(["MS Fabricated", "MS with Sheet", "Wrought Iron", "SS Gate"] as const).map((x) => <button key={x} type="button" onClick={() => setGateType(x)} className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${gateType === x ? "border-transparent bg-gradient-to-r from-[#2563EB] to-[#06B6A4] text-white" : "border-[#E5E7EB] bg-white text-[#1A1A2E]"}`}>{x === "SS Gate" ? "SS" : x === "MS with Sheet" ? "MS + Sheet" : x}</button>)}</div>
                            <label className="flex items-center gap-2 text-xs font-semibold text-[#6B7280]"><span className="whitespace-nowrap">Width (ft)</span><input type="number" className={inlineInputClass} value={gateWidthFt} onChange={(e) => setGateWidthFt(Number(e.target.value))} /></label>
                            <label className="flex items-center gap-2 text-xs font-semibold text-[#6B7280]"><span className="whitespace-nowrap">Height (ft)</span><input type="number" className={inlineInputClass} value={gateHeightFt} onChange={(e) => setGateHeightFt(Number(e.target.value))} /></label>
                          </>
                        )}
                      </div>
                    </div>
                    <div className={optionalRowClass}>
                      <span className="w-[10rem] shrink-0 text-sm font-semibold text-[#1A1A2E]">Side Gate</span>
                      <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2">
                        <span className="mr-1 text-xs font-medium text-[#6B7280]">Include</span>
                        <button type="button" disabled={!useSiteDevelopment} onClick={() => setIncludeSideGate(true)} className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${includeSideGate ? "border-transparent bg-gradient-to-r from-[#2563EB] to-[#06B6A4] text-white" : "border-[#E5E7EB] bg-white text-[#1A1A2E]"}`}>Yes</button>
                        <button type="button" disabled={!useSiteDevelopment} onClick={() => setIncludeSideGate(false)} className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${!includeSideGate ? "border-transparent bg-gradient-to-r from-[#2563EB] to-[#06B6A4] text-white" : "border-[#E5E7EB] bg-white text-[#1A1A2E]"}`}>No</button>
                        {includeSideGate && (
                          <>
                            <span className="mx-1 h-4 w-px shrink-0 bg-[#E5E7EB]" aria-hidden />
                            <label className="flex items-center gap-2 text-xs font-semibold text-[#6B7280]"><span className="whitespace-nowrap">Width (ft)</span><input type="number" className={inlineInputClass} value={smallGateWidthFt} onChange={(e) => setSmallGateWidthFt(Number(e.target.value))} /></label>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className={`${optionalSectionCardClass} ${useProfessionalInputs ? "opacity-100" : "opacity-70"}`}>
              <label className="flex cursor-pointer items-center gap-3 border-b border-[#ECEFF3] px-6 py-5">
                <input type="checkbox" checked={useProfessionalInputs} onChange={(e) => setUseProfessionalInputs(e.target.checked)} className="h-4 w-4 shrink-0 rounded border-[#D1D5DB] text-[#2563EB] focus:ring-[#2563EB]" />
                <span className={`min-w-0 flex-1 text-[16px] font-semibold tracking-[-0.01em] ${useProfessionalInputs ? "text-[#1A1A2E]" : "text-[#9CA3AF]"}`}>Professional Inputs</span>
                <svg className={`h-5 w-5 shrink-0 text-[#9CA3AF] transition-transform duration-300 ease-out ${useProfessionalInputs ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
              </label>
              <div className={`grid transition-all duration-300 ease-out ${useProfessionalInputs ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
                <div className="min-h-0 overflow-hidden">
                  <div className={`px-6 pb-6 pt-6 ${!useProfessionalInputs ? "pointer-events-none" : ""}`}>
                    <p className="mb-2 text-sm font-semibold text-[#1A1A2E]">Room Dimensions Table</p>
                    <div className="overflow-x-auto rounded-lg border border-[#F0F0ED]"><table className="min-w-full text-sm"><thead className="bg-[#FAFAF8] text-[#6B7280]"><tr><th className="px-3 py-2 text-left">Room Name</th><th className="px-3 py-2 text-left">Length (ft)</th><th className="px-3 py-2 text-left">Width (ft)</th><th className="px-3 py-2 text-left">Area</th><th className="px-3 py-2 text-left">-</th></tr></thead><tbody>{roomRows.map((row) => (<tr key={row.id} className="border-t border-[#F0F0ED]"><td className="px-3 py-2"><input className="w-full rounded-md border border-[#E5E7EB] px-2 py-1" value={row.name} onChange={(e) => setRoomRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, name: e.target.value } : r)))} /></td><td className="px-3 py-2"><input type="number" className="w-full rounded-md border border-[#E5E7EB] px-2 py-1" value={row.lengthFt} onChange={(e) => setRoomRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, lengthFt: Number(e.target.value) } : r)))} /></td><td className="px-3 py-2"><input type="number" className="w-full rounded-md border border-[#E5E7EB] px-2 py-1" value={row.widthFt} onChange={(e) => setRoomRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, widthFt: Number(e.target.value) } : r)))} /></td><td className="px-3 py-2 text-[#6B7280]">{Math.round(row.lengthFt * row.widthFt)} sqft</td><td className="px-3 py-2"><button type="button" className="text-xs text-[#B91C1C]" onClick={() => setRoomRows((prev) => prev.length > 1 ? prev.filter((r) => r.id !== row.id) : prev)}>Remove</button></td></tr>))}</tbody></table></div>
                    <div className="mt-2 flex items-center justify-between"><button type="button" className={outlineBtnClass} onClick={() => setRoomRows((prev) => [...prev, { id: Date.now(), name: "Custom Room", lengthFt: 8, widthFt: 8 }])}>+ Add Room</button><p className={`text-xs ${architectCustomAreaSqft > builtUpArea ? "text-[#B91C1C]" : "text-[#6B7280]"}`}>Total room area: {Math.round(architectCustomAreaSqft)} sqft {architectCustomAreaSqft > builtUpArea ? " (exceeds built-up area)" : ""}</p></div>
                    <div className="mt-5"><p className="mb-2 text-sm font-semibold text-[#1A1A2E]">Structural Details</p><div className="grid grid-cols-1 gap-3 md:grid-cols-3"><label className="text-sm font-semibold text-[#1A1A2E]">Number of Columns<input type="number" className={inputClass} value={structuralInputs.columns} onChange={(e) => setStructuralInputs((p) => ({ ...p, columns: Number(e.target.value) }))} /></label><label className="text-sm font-semibold text-[#1A1A2E]">Column Size<select className={inputClass} value={structuralInputs.columnSize} onChange={(e) => setStructuralInputs((p) => ({ ...p, columnSize: e.target.value as StructuralInputs["columnSize"] }))}><option>230x230mm</option><option>230x300mm</option><option>300x300mm</option></select></label><label className="text-sm font-semibold text-[#1A1A2E]">Beam Size<select className={inputClass} value={structuralInputs.beamSize} onChange={(e) => setStructuralInputs((p) => ({ ...p, beamSize: e.target.value as StructuralInputs["beamSize"] }))}><option>230x300mm</option><option>230x375mm</option><option>230x450mm</option></select></label><label className="text-sm font-semibold text-[#1A1A2E]">Slab Thickness<select className={inputClass} value={structuralInputs.slabThickness} onChange={(e) => setStructuralInputs((p) => ({ ...p, slabThickness: e.target.value as StructuralInputs["slabThickness"] }))}><option>100mm</option><option>125mm</option><option>150mm</option></select></label><label className="text-sm font-semibold text-[#1A1A2E]">Plinth Height<select className={inputClass} value={structuralInputs.plinthHeight} onChange={(e) => setStructuralInputs((p) => ({ ...p, plinthHeight: e.target.value as StructuralInputs["plinthHeight"] }))}><option>1.5ft</option><option>2ft</option><option>2.5ft</option><option>3ft</option></select></label><label className="text-sm font-semibold text-[#1A1A2E]">Floor Height<select className={inputClass} value={structuralInputs.floorToCeiling} onChange={(e) => setStructuralInputs((p) => ({ ...p, floorToCeiling: e.target.value as StructuralInputs["floorToCeiling"] }))}><option>9ft</option><option>9.5ft</option><option>10ft</option><option>10.5ft</option><option>11ft</option></select></label><label className="text-sm font-semibold text-[#1A1A2E]">Parapet Height<select className={inputClass} value={structuralInputs.parapetHeight} onChange={(e) => setStructuralInputs((p) => ({ ...p, parapetHeight: e.target.value as StructuralInputs["parapetHeight"] }))}><option>2.5ft</option><option>3ft</option><option>3.5ft</option><option>4ft</option></select></label></div></div>
                    <div className="mt-5"><p className="mb-2 text-sm font-semibold text-[#1A1A2E]">Door &amp; Window Schedule</p><div className="overflow-x-auto rounded-lg border border-[#F0F0ED]"><table className="min-w-full text-sm"><thead className="bg-[#FAFAF8] text-[#6B7280]"><tr><th className="px-3 py-2 text-left">Location</th><th className="px-3 py-2 text-left">Type</th><th className="px-3 py-2 text-left">Width (ft)</th><th className="px-3 py-2 text-left">Height (ft)</th><th className="px-3 py-2 text-left">Material</th><th className="px-3 py-2 text-left">-</th></tr></thead><tbody>{openingRows.map((row) => (<tr key={row.id} className="border-t border-[#F0F0ED]"><td className="px-3 py-2"><input className="w-full rounded-md border border-[#E5E7EB] px-2 py-1" value={row.location} onChange={(e) => setOpeningRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, location: e.target.value } : r)))} /></td><td className="px-3 py-2"><select className="w-full rounded-md border border-[#E5E7EB] px-2 py-1" value={row.type} onChange={(e) => setOpeningRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, type: e.target.value as OpeningRow["type"] } : r)))}><option>Main</option><option>Internal</option><option>Bathroom</option><option>Sliding</option></select></td><td className="px-3 py-2"><input type="number" className="w-full rounded-md border border-[#E5E7EB] px-2 py-1" value={row.widthFt} onChange={(e) => setOpeningRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, widthFt: Number(e.target.value) } : r)))} /></td><td className="px-3 py-2"><input type="number" className="w-full rounded-md border border-[#E5E7EB] px-2 py-1" value={row.heightFt} onChange={(e) => setOpeningRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, heightFt: Number(e.target.value) } : r)))} /></td><td className="px-3 py-2"><input className="w-full rounded-md border border-[#E5E7EB] px-2 py-1" value={row.material} onChange={(e) => setOpeningRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, material: e.target.value } : r)))} /></td><td className="px-3 py-2"><button type="button" className="text-xs text-[#B91C1C]" onClick={() => setOpeningRows((prev) => prev.length > 1 ? prev.filter((r) => r.id !== row.id) : prev)}>Remove</button></td></tr>))}</tbody></table></div><div className="mt-2"><button type="button" className={outlineBtnClass} onClick={() => setOpeningRows((prev) => [...prev, { id: Date.now(), location: "Custom", type: "Sliding", widthFt: 4, heightFt: 4, material: "Aluminium" }])}>+ Add Opening</button></div></div>
                    <div className="mt-5 rounded-lg border border-dashed border-[#C7D2FE] bg-[#F8FAFF] p-4"><p className="text-sm font-semibold text-[#1A1A2E]">Upload Drawing <span className="ml-2 rounded-full bg-[#E5E7EB] px-2 py-0.5 text-[10px] text-[#6B7280]">Coming Soon</span></p><p className="mt-1 text-xs text-[#6B7280]">Upload AutoCAD DWG/PDF for automatic dimension extraction</p><input disabled type="file" className="mt-3 w-full cursor-not-allowed rounded-md border border-[#E5E7EB] bg-[#F3F4F6] px-3 py-2 text-xs text-[#9CA3AF]" /></div>
                  </div>
                </div>
              </div>
            </section>
            {!aiEnabled && <p className="text-center text-sm text-[#9CA3AF]">Add your Anthropic API key in `.env.local` to enable AI features</p>}
            {!isGenerating && statusMessage && <p className="text-center text-sm font-semibold text-[#0066FF]">{statusMessage}</p>}
          </form>
        </div>
        <section ref={resultsRef} className={`print-only mt-10 p-6 ${shellCardClass}`}>
            <div className={`mb-8 flex flex-col gap-6 p-6 md:flex-row md:items-start md:justify-between ${shellCardClass}`}>
              <div>
                {latestBoq && (
                  <>
                    <p className="text-[13px] font-normal tracking-[0.5px] text-[#6B7280]">{latestBoq.input.buildingType} House · {latestBoq.input.city} · {latestBoq.input.specificationProfile}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="inline-flex rounded-full bg-[#F3F4F6] px-2.5 py-1 text-[11px] font-semibold text-[#4B5563]">📐 Plot Details</span>
                      {useCustomRates && <span className="inline-flex rounded-full bg-[#EFF6FF] px-2.5 py-1 text-[11px] font-semibold text-[#2563EB]">💰 Custom Rates</span>}
                      {useProfessionalInputs && <span className="inline-flex rounded-full bg-[#ECFDF5] px-2.5 py-1 text-[11px] font-semibold text-[#059669]">👷 Professional Inputs</span>}
                    </div>
                    <p className="mt-1 text-[42px] font-light leading-tight text-[#1A1A2E]">{latestBoq.totals.grandTotal.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })}</p>
                    <p className="text-[15px] font-normal text-[#6B7280]">{latestBoq.totals.costPerSqft.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })} per sqft</p>
                    <div className="mt-4 border-t border-[#F0F0ED] pt-3">
                      <div className="grid grid-cols-2 gap-4 text-left md:grid-cols-5">
                        <div><p className="text-[12px] font-medium text-[#6B7280]">Plot</p><p className="text-[15px] font-semibold text-[#1A1A2E]">{latestBoq.input.widthFt}×{latestBoq.input.lengthFt} ft</p></div>
                        <div className="md:border-l md:border-[#F0F0ED] md:pl-4"><p className="text-[12px] font-medium text-[#6B7280]">Built-up</p><p className="text-[15px] font-semibold text-[#1A1A2E]">{Math.round(latestBoq.project.builtUpAreaSqft)} sqft</p></div>
                        <div className="md:border-l md:border-[#F0F0ED] md:pl-4"><p className="text-[12px] font-medium text-[#6B7280]">Steel</p><p className="text-[15px] font-semibold text-[#1A1A2E]">{latestBoq.metrics.steelKg.toLocaleString("en-IN")} kg</p></div>
                        <div className="md:border-l md:border-[#F0F0ED] md:pl-4"><p className="text-[12px] font-medium text-[#6B7280]">Cement</p><p className="text-[15px] font-semibold text-[#1A1A2E]">{Math.round(latestBoq.metrics.totalCementBags).toLocaleString("en-IN")} bags</p></div>
                        <div className="md:border-l md:border-[#F0F0ED] md:pl-4"><p className="text-[12px] font-medium text-[#6B7280]">Duration</p><p className="text-[15px] font-semibold text-[#1A1A2E]">{timelineWeeks} weeks</p></div>
                      </div>
                    </div>
                  </>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={handleShare} disabled={!latestBoq} className={outlineBtnClass}>Share</button>
                <button type="button" onClick={handleDownloadAll} disabled={!latestBoq || isGenerating} className={solidBtnClass}>Download All</button>
              </div>
            </div>

            <p className="mb-6 text-sm font-semibold text-[#6B7280]">31 documents ready</p>
            {phaseOrder.map((group) => {
              const docs = docDescriptors.filter((d) => d.phase === group.phase);
              return (
                <div key={group.phase} className="mb-10">
                  <div className="mb-2 border-b border-[#F0F0ED] pb-1 text-xs font-semibold tracking-wide text-[#6B7280]">{group.label}</div>
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    {docs.map((doc) => (
                      <div key={doc.key} className={`group flex min-h-[176px] flex-col justify-between p-6 transition hover:-translate-y-0.5 ${shellCardClass}`}>
                        <div className="flex items-start justify-between">
                          <div className="flex gap-3">
                            <div className={`flex h-12 w-12 items-center justify-center rounded-lg text-lg ${doc.format === "XLSX" ? "bg-[#F0F4FF] text-[#2563EB]" : "bg-[#FFF0F0] text-[#DC2626]"}`}>{doc.icon}</div>
                            <div><p className="text-[16px] font-semibold text-[#1A1A2E]">{doc.name}</p><p className="text-[13px] text-[#6B7280]">{doc.subtitle}</p></div>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${doc.format === "XLSX" ? "bg-[#EFF6FF] text-[#2563EB]" : "bg-[#FEF2F2] text-[#DC2626]"}`}>{doc.format}</span>
                            {doc.key === "boq" && <div className="mt-1">{boqAiBadge()}</div>}
                          </div>
                        </div>
                        <div className="mt-4 flex items-center justify-end border-t border-[#F0F0ED] pt-3"><div className="flex gap-2"><button type="button" onClick={() => void openPreviewByKey(doc.key)} disabled={!latestBoq || isGenerating} className={outlineBtnClass}>👁 Preview</button><button type="button" onClick={() => downloadDocByKey(doc.key)} disabled={!latestBoq || isGenerating} className={outlineBtnClass}>⬇ Download</button></div></div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {latestBoq && (
              <>
                <section className={`mt-10 ${shellCardClass} ${showCompareQuoteSection ? "border-b-transparent" : ""}`}>
                  <button type="button" onClick={() => setShowCompareQuoteSection((v) => !v)} className={collapseHeaderClass}>
                    <span>Compare Contractor Quote</span>
                    <span className={`inline-block transition-transform duration-300 ${showCompareQuoteSection ? "rotate-90" : ""}`}>▶</span>
                  </button>
                  <div className={`overflow-hidden px-6 transition-all duration-300 ${showCompareQuoteSection ? "max-h-[1200px] pb-5 opacity-100" : "max-h-0 opacity-0"}`}>
                    <textarea value={quoteText} onChange={(e) => setQuoteText(e.target.value)} placeholder="Paste contractor quotation text or rate sheet..." className="h-32 w-full rounded-[10px] border border-[#E5E7EB] p-3 text-sm outline-none focus:border-[#0066FF] focus:shadow-[0_0_0_3px_rgba(0,102,255,0.1)]" />
                    <div className="mt-3 flex items-center gap-3"><button type="button" onClick={() => void handleCompareQuote()} disabled={compareLoading || !quoteText.trim() || !aiEnabled} className={solidBtnClass}>{compareLoading ? "Comparing..." : "Compare with AI"}</button>{compareError && <p className="text-sm text-red-600">{compareError}</p>}</div>
                    {compareResult && <div className="mt-4 overflow-auto"><table className="min-w-full border-collapse text-sm"><thead><tr className="bg-blue-50"><th className="border p-2 text-left">Item</th><th className="border p-2 text-right">BOQ Rate</th><th className="border p-2 text-right">Contractor Rate</th><th className="border p-2 text-right">Diff %</th><th className="border p-2 text-left">Verdict</th></tr></thead><tbody>{compareResult.items.map((item, i) => <tr key={`${item.description}-${i}`} className={item.verdict === "fair" ? "bg-green-50" : item.verdict === "overpriced" ? "bg-yellow-50" : "bg-red-50"}><td className="border p-2">{item.description}</td><td className="border p-2 text-right">{item.boq_rate}</td><td className="border p-2 text-right">{item.contractor_rate}</td><td className="border p-2 text-right">{item.difference_percent}%</td><td className="border p-2">{item.verdict}</td></tr>)}</tbody></table><p className="mt-3 text-sm font-semibold text-ink">{compareResult.overall_assessment}</p><ul className="mt-2 list-disc pl-5 text-sm text-gray-700">{compareResult.negotiation_tips.map((t, i) => <li key={`${t}-${i}`}>{t}</li>)}</ul></div>}
                  </div>
                </section>

                <section className={`mt-10 ${shellCardClass} ${showCostDistribution ? "border-b-transparent" : ""}`}>
                  <button type="button" onClick={() => setShowCostDistribution((v) => !v)} className={collapseHeaderClass}>
                    <span>Cost Distribution by Category</span>
                    <span className={`inline-block transition-transform duration-300 ${showCostDistribution ? "rotate-90" : ""}`}>▶</span>
                  </button>
                  <div className={`overflow-hidden px-6 transition-all duration-300 ${showCostDistribution ? "max-h-[1200px] pb-5 opacity-100" : "max-h-0 opacity-0"}`}>
                    <div className="space-y-3 pt-1">
                      {scheduleChart.map((s) => <div key={s.id} className={`rounded-lg border p-2 ${s.isMax ? "border-[#2563EB]" : "border-gray-200"}`}><div className="mb-1 flex justify-between text-sm"><span className="font-medium text-ink">{s.label}</span><span className="text-gray-600">{s.amount.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })} ({s.pct.toFixed(1)}%)</span></div><div className="h-3 rounded-full bg-gray-100"><div className="h-3 rounded-full" style={{ width: `${Math.max(2, s.pct)}%`, backgroundColor: s.color }} /></div></div>)}
                    </div>
                  </div>
                </section>
                <section className={`mt-10 ${shellCardClass} ${showRateIntelligence ? "border-b-transparent" : ""}`}>
                  <div className="flex items-center justify-between">
                    <button type="button" onClick={() => setShowRateIntelligence((v) => !v)} className={collapseHeaderClass}>
                      <span>Rate Intelligence</span>
                      <span className={`inline-block transition-transform duration-300 ${showRateIntelligence ? "rotate-90" : ""}`}>▶</span>
                    </button>
                    <button type="button" onClick={() => void refreshRates()} disabled={rateIntelLoading || !aiEnabled} className={`${outlineBtnClass} mr-5`}>
                      {rateIntelLoading ? "Refreshing..." : "Refresh Rates"}
                    </button>
                  </div>
                  <div className={`overflow-hidden px-6 transition-all duration-300 ${showRateIntelligence ? "max-h-[1200px] pb-5 opacity-100" : "max-h-0 opacity-0"}`}>
                    {rateIntelError && <p className="mt-2 text-sm text-red-600">{rateIntelError}</p>}
                    {rateIntel && (
                      <>
                        <div className="mt-3 grid grid-cols-1 gap-4 text-sm md:grid-cols-2">
                          {rateIntel.rates.map((r) => (
                            <div key={r.material} className={`p-4 ${shellCardClass}`}>
                              <p className="font-medium text-[#1A1A2E] capitalize">{r.material}</p>
                              <p className="text-[#1A1A2E]">
                                ₹{Math.round(r.current_price).toLocaleString("en-IN")}{" "}
                                <span className={`text-xs ${r.current_price > baseRates[r.material as keyof MaterialRates] ? "text-red-600" : "text-green-600"}`}>
                                  ({r.current_price > baseRates[r.material as keyof MaterialRates] ? "+" : "-"}
                                  {((Math.abs(r.current_price - baseRates[r.material as keyof MaterialRates]) / baseRates[r.material as keyof MaterialRates]) * 100).toFixed(1)}%)
                                </span>
                              </p>
                              <p className="text-xs text-[#9CA3AF]">Updated: {r.last_updated}</p>
                            </div>
                          ))}
                        </div>
                        <p className="mt-3 text-xs text-gray-600">{rateIntel.note}</p>
                      </>
                    )}
                  </div>
                </section>
              </>
            )}
          </section>
        </section>}

        {!isToolRoute && <section id="pricing" className="space-y-3 py-[120px]">
          <h3 className="text-center text-[32px] font-medium text-[#1A1A2E]">Simple, transparent pricing</h3>
          <p className="text-center text-[15px] text-[#6B7280]">Start free. Upgrade when you need more.</p>
          <div className="grid gap-4 md:grid-cols-3">
            <div className={`flex min-h-[340px] flex-col p-5 ${shellCardClass}`}><p className="text-sm font-semibold text-[#6B7280]">Free</p><p className="mt-2 text-3xl font-light text-[#1A1A2E]">₹0</p><ul className="mt-3 space-y-2 text-[13px] text-[#6B7280]"><li>· 1 project</li><li>· BOQ document only</li><li>· Material summary</li><li>· BuildDocs watermark</li></ul><button className={`${outlineBtnClass} mt-auto w-fit`}>Try Free</button></div>
            <div className="flex min-h-[340px] flex-col rounded-[16px] border border-[#2563EB] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]"><p className="inline-block rounded-full bg-[#EFF6FF] px-2 py-0.5 text-xs font-semibold text-[#2563EB]">Most Popular</p><p className="mt-2 text-sm font-semibold text-[#6B7280]">Starter</p><p className="mt-2 text-3xl font-light text-[#1A1A2E]">₹999/project</p><ul className="mt-3 space-y-2 text-[13px] text-[#6B7280]"><li>· All 6 documents</li><li>· No watermark</li><li>· AI BOQ review</li><li>· Excel + PDF downloads</li><li>· City-wise rates</li></ul><button className={`${solidBtnClass} mt-auto w-fit`}>Get Started</button></div>
            <div className="flex min-h-[340px] flex-col rounded-[16px] border border-transparent bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] [background:linear-gradient(white,white)_padding-box,linear-gradient(90deg,#2563EB,#06B6A4)_border-box]"><p className="text-sm font-semibold text-[#6B7280]">Pro</p><p className="mt-2 text-3xl font-light text-[#1A1A2E]">₹2,499/month</p><ul className="mt-3 space-y-2 text-[13px] text-[#6B7280]"><li>· Unlimited projects</li><li>· Contractor quote comparison</li><li>· AI chat assistant</li><li>· Rate intelligence</li><li>· Priority support</li></ul><button className={`${outlineBtnClass} mt-auto w-fit`}>Contact Us</button></div>
          </div>
          <p className="text-center text-sm text-[#9CA3AF]">All plans include CPWD/DSR format and IS code references</p>
        </section>}

        {!isToolRoute && <section id="faq" className="space-y-3 py-[120px]">
          <h3 className="text-center text-[32px] font-medium text-[#1A1A2E]">Frequently asked questions</h3>
          <div className="mx-auto max-w-[700px] space-y-3">
          {[
            ["What documents are included?", "BOQ, estimates, schedules, procurement sheets, agreements and DPR templates."],
            ["Are rates city-specific?", "Yes, rates adapt by city and profile, and you can override with custom rates."],
            ["Can I edit outputs?", "Yes, generated Excel/PDF files are ready to download and further edit."],
            ["Is this suitable for homeowners?", "Yes, it is designed for non-technical users and contractors alike."],
            ["Does AI review replace an engineer?", "No, it helps flag issues quickly before professional validation."],
            ["Do plans include standards?", "Yes, plans are aligned with CPWD/DSR format and IS references."]
          ].map(([q, a]) => (
            <details key={q} className={`${shellCardClass} group`}>
              <summary className={collapseHeaderClass}><span>{q}</span><span className="transition-transform group-open:rotate-90">▶</span></summary>
              <p className="px-6 pb-6 text-sm text-[#6B7280]">{a}</p>
            </details>
          ))}
          </div>
        </section>}

        {!isToolRoute && <footer className="border-t border-[#ECEFF3] py-16">
          <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
            <div className="flex items-center gap-2"><div className="h-6 w-6 rounded-md bg-gradient-to-r from-[#2563EB] to-[#06B6A4]" /><span className="font-semibold">BuildDocs.ai</span></div>
            <div className="flex gap-4 text-sm text-[#6B7280]"><a href="#">About</a><a href="#">Contact</a><a href="#">Privacy</a></div>
            <button className="rounded-full border border-green-600 px-4 py-2 text-sm font-semibold text-green-700">Need help? WhatsApp us</button>
          </div>
          <p className="mt-3 text-xs text-[#9CA3AF]">Made in India 🇮🇳 for Indian builders · © 2026 BuildDocs.ai</p>
        </footer>}
      </div>

      {isToolRoute && <button type="button" onClick={() => setChatOpen((v) => !v)} className="fixed bottom-5 right-5 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-[#0066FF] text-white shadow-[0_4px_12px_rgba(0,0,0,0.16)]">⌕</button>}
      {isToolRoute && chatOpen && (
        <div className="fixed bottom-0 left-0 right-0 z-50 flex h-[75vh] flex-col rounded-t-2xl border border-gray-200 bg-white shadow-xl md:bottom-24 md:left-auto md:right-5 md:h-[500px] md:w-[400px] md:max-w-[calc(100vw-2rem)] md:rounded-xl">
          <div className="flex items-center justify-between border-b px-4 py-3"><h3 className="font-semibold text-ink">BuildDocs AI Assistant</h3><button type="button" onClick={() => setChatOpen(false)}>✕</button></div>
          <div className="flex-1 space-y-2 overflow-auto p-3 text-sm">{chatMessages.map((m, idx) => <div key={`${m.role}-${idx}`} className={`rounded-lg p-2 ${m.role === "user" ? "ml-8 bg-blue-50" : "mr-8 bg-gray-100"}`}>{m.content}</div>)}</div>
          {!aiEnabled && <p className="px-3 pb-2 text-xs text-amber-700">Add your Anthropic API key in .env.local to enable AI features</p>}
          <div className="border-t p-3"><div className="mb-2 flex flex-wrap gap-2">{latestBoq && ["What approvals do I need in " + latestBoq.input.city + "?", "Is my steel quantity reasonable?", "How to check cement quality on site?", "What should I pay a mason in " + latestBoq.input.city + "?"].map((q) => <button key={q} type="button" onClick={() => void handleChatSend(q)} disabled={!aiEnabled || chatLoading} className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-700">{q}</button>)}</div><div className="flex gap-2"><input value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void handleChatSend(); }} placeholder="Ask about costs, approvals, timeline..." className="flex-1 rounded-md border px-3 py-2 text-sm" /><button type="button" onClick={() => void handleChatSend()} disabled={!aiEnabled || chatLoading} className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">{chatLoading ? "..." : "Send"}</button></div></div>
        </div>
      )}

      {isToolRoute && previewDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="flex h-[85vh] w-full max-w-6xl flex-col rounded-xl bg-white">
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3"><h3 className="text-base font-semibold text-ink">{previewDoc.name}</h3><button type="button" onClick={closePreview} className="rounded-md px-2 py-1 text-sm text-gray-600 hover:bg-gray-100">✕</button></div>
            <div className="min-h-0 flex-1 overflow-auto p-4">{previewDoc.format === "PDF" && previewPdfUrl && <iframe src={previewPdfUrl} className="h-full min-h-[520px] w-full rounded-lg border border-gray-200" />}{previewDoc.format === "XLSX" && <div className="space-y-3"><div className="flex flex-wrap gap-2">{previewSheets.map((sheet, idx) => <button key={sheet.name} type="button" onClick={() => setActiveSheet(idx)} className={`rounded-md px-3 py-1 text-xs font-semibold ${idx === activeSheet ? "bg-primary text-white" : "bg-gray-100 text-gray-700"}`}>{sheet.name}</button>)}</div><div className="overflow-auto rounded-lg border border-gray-200"><table className="min-w-full border-collapse text-xs"><tbody>{(previewSheets[activeSheet]?.rows ?? []).map((row, rIdx) => <tr key={`${rIdx}-${row.length}`} className={rIdx % 2 === 0 ? "bg-white" : "bg-gray-50"}>{row.map((cell, cIdx) => <td key={`${rIdx}-${cIdx}`} className={`border border-gray-200 px-2 py-1 ${rIdx === 0 ? "bg-blue-50 font-semibold" : ""}`}>{String(cell)}</td>)}</tr>)}</tbody></table></div></div>}</div>
            <div className="flex justify-end gap-2 border-t border-gray-200 px-4 py-3"><button type="button" onClick={closePreview} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm">Close</button><button type="button" onClick={() => downloadDoc(previewDoc)} className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-white">Download</button></div>
          </div>
        </div>
      )}
    </main>  );
}

