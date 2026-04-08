import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import type { City } from "@/lib/rates";
import { getLastRateUpdate, getMaterialPriceIndexForCity, upsertMaterialPrice } from "@/lib/rates/material-price-index";

type PriceRow = {
  material: string;
  price: number;
  unit: string;
  source: string;
};

const MATERIAL_ALIAS: Record<string, "cement" | "steel" | "sand" | "aggregate" | "bricks" | "labour" | null> = {
  cement: "cement",
  "cement price per 50kg bag (opc 53 grade)": "cement",
  "steel tmt fe500d price per kg": "steel",
  steel: "steel",
  "river sand price per brass": "sand",
  sand: "sand",
  "20mm aggregate price per brass": "aggregate",
  aggregate: "aggregate",
  "first class brick price per 1000 numbers": "bricks",
  bricks: "bricks",
  "mason daily wage": "labour",
  labour: "labour"
};

function extractJson(text: string) {
  const cleaned = text.replace(/```json|```/g, "").trim();
  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start >= 0 && end > start) return cleaned.slice(start, end + 1);
  return cleaned;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const city = (url.searchParams.get("city") ?? "Mumbai") as City;
  return NextResponse.json({
    city,
    last_updated: getLastRateUpdate(city),
    rates: getMaterialPriceIndexForCity(city),
    note: `Rates sourced from: CPWD DSR 2024 base + market price adjustment as of ${getLastRateUpdate(city)}`
  });
}

export async function POST(req: Request) {
  const apiKey = process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY;
  if (!apiKey || apiKey === "your_key_here") {
    return NextResponse.json({ error: "Add your Anthropic API key in .env.local to enable rate refresh" }, { status: 400 });
  }

  try {
    const payload = await req.json();
    const city = (payload?.city ?? "Mumbai") as City;
    const today = new Date().toISOString().slice(0, 10);
    const prompt = `Search the web for current construction material prices in ${city}, India as of ${today}. Find: 1) Cement price per 50kg bag (OPC 53 grade), 2) Steel TMT Fe500D price per kg, 3) River sand price per brass, 4) 20mm aggregate price per brass, 5) First class brick price per 1000 numbers, 6) Mason daily wage. Return as JSON with fields: material, price, unit, source. Use only reliable sources like industry publications, government notifications, or major supplier websites.`;
    const client = new Anthropic({ apiKey });
    const msg = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1200,
      system: "Return only a valid JSON array. No markdown.",
      messages: [{ role: "user", content: prompt }]
    });

    const text = msg.content.filter((c) => c.type === "text").map((c) => c.text).join("\n");
    const rows = JSON.parse(extractJson(text)) as PriceRow[];
    const updates = rows
      .map((row) => {
        const normalized = (row.material || "").toLowerCase().trim();
        const material = MATERIAL_ALIAS[normalized] ?? null;
        if (!material || !Number.isFinite(row.price) || row.price <= 0) return null;
        return upsertMaterialPrice({
          city,
          material,
          current_price: Number(row.price),
          last_updated: today,
          source_url: row.source || "https://cpwd.gov.in/"
        });
      })
      .filter((x) => Boolean(x));

    return NextResponse.json({
      city,
      updated_count: updates.length,
      last_updated: getLastRateUpdate(city),
      rates: getMaterialPriceIndexForCity(city),
      note: `Rates sourced from: CPWD DSR 2024 base + market price adjustment as of ${getLastRateUpdate(city)}`
    });
  } catch (error) {
    return NextResponse.json({ error: "Rate update failed", detail: String(error) }, { status: 500 });
  }
}

