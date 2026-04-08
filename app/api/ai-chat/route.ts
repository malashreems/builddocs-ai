import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

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

    const system = `You are BuildDocs AI, a helpful construction assistant for Indian residential projects. The user is building a ${payload.context?.bhk_type} house of ${payload.context?.area}sqft in ${payload.context?.city} with ${payload.context?.spec_profile} specifications. Their estimated cost is ₹${payload.context?.total}. Their BOQ has been generated with these key quantities: steel=${payload.context?.steel}kg, cement=${payload.context?.cement}bags, bricks=${payload.context?.bricks}. Answer their questions about construction, materials, costs, approvals, and timelines specific to their project and city. Be concise and practical. If asked about approvals, include city-specific government offices and typical timelines.`;

    const messages = (payload.history ?? []).map((m: { role: "user" | "assistant"; content: string }) => ({
      role: m.role,
      content: m.content
    }));

    const msg = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system,
      messages
    });

    const text = msg.content
      .filter((c) => c.type === "text")
      .map((c) => c.text)
      .join("\n");
    return NextResponse.json({ reply: text });
  } catch (error) {
    return NextResponse.json({ error: "AI chat failed", detail: String(error) }, { status: 500 });
  }
}

