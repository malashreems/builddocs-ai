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

    const prompt = `Compare this contractor quotation against our BOQ rates. The BOQ was generated for a ${payload.bhk_type} house of ${payload.area}sqft in ${payload.city} with ${payload.spec_profile} specifications. Our BOQ rates are: ${JSON.stringify(
      payload.key_rates
    )}. The contractor's quotation is: ${payload.contractor_quote}. Identify items where the contractor is overcharging (more than 15% above BOQ rates) and undercharging (more than 15% below - which could indicate quality concerns). Respond in JSON format with: items (array of {description, boq_rate, contractor_rate, difference_percent, verdict: 'fair'|'overpriced'|'underpriced'|'suspicious'}), overall_assessment (string), negotiation_tips (array of strings).`;

    const msg = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1600,
      messages: [{ role: "user", content: prompt }]
    });

    const text = msg.content
      .filter((c) => c.type === "text")
      .map((c) => c.text)
      .join("\n");
    const parsed = JSON.parse(extractJson(text));
    return NextResponse.json(parsed);
  } catch (error) {
    return NextResponse.json({ error: "AI comparison failed", detail: String(error) }, { status: 500 });
  }
}

