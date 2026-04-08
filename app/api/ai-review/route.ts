import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

function extractJson(text: string) {
  const cleaned = text.replace(/```json|```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start >= 0 && end > start) return cleaned.slice(start, end + 1);
  return cleaned;
}

export async function POST(req: Request) {
  const apiKey = process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY;
  if (!apiKey || apiKey === "your_key_here") {
    return NextResponse.json(
      { error: "Add your Anthropic API key in .env.local to enable AI features" },
      { status: 400 }
    );
  }

  try {
    const payload = await req.json();
    const client = new Anthropic({ apiKey });

    const system = `You are an experienced Indian quantity surveyor reviewing a BOQ summary. Use these EXACT benchmark ranges to evaluate. If a value falls WITHIN the range, mark it as ok — do not add caveats or suggest it might be inadequate. Only flag issues for values clearly outside the range.
BENCHMARK RANGES:

Steel: RCC Framed = 3.5-5.0 kg/sqft, Load Bearing = 2.0-3.5 kg/sqft. WITHIN range = ok.
Cement: 0.35-0.45 bags/sqft. WITHIN range = ok.
Cost per sqft: Economy ₹1,400-1,800, Standard ₹1,800-2,400, Premium ₹2,400-3,200. WITHIN range = ok.
Plastering: 8-12% of total. WITHIN range = ok.
Concrete: 15-22% of total. WITHIN range = ok.
Steel cost: 12-18% of total. WITHIN range = ok.

VERDICT RULES:

ALL values within ranges = overall_verdict must be "Looks Good"
1-2 values within 10% outside range = overall_verdict "Needs Review"
Any value more than 15% outside range = overall_verdict "Concerns Found"

Do NOT second-guess values that are within range. Do NOT add warnings like "appears low but within range" or "verify structural adequacy" for in-range values. If it is within the benchmark, it is ok. Period.
Respond in JSON format with fields: overall_verdict, confidence_score, observations (array of {item, status, comment}), suggestions (array), estimated_savings_possible.`;

    const msg = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1200,
      system,
      messages: [
        {
          role: "user",
          content: `BOQ summary:\n${JSON.stringify(payload, null, 2)}`
        }
      ]
    });

    const text = msg.content
      .filter((c) => c.type === "text")
      .map((c) => c.text)
      .join("\n");
    const parsed = JSON.parse(extractJson(text));
    return NextResponse.json(parsed);
  } catch (error) {
    return NextResponse.json({ error: "AI review failed", detail: String(error) }, { status: 500 });
  }
}

