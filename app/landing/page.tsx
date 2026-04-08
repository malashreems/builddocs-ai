"use client";

import Link from "next/link";
import { useState } from "react";

const phases = {
  "Pre-Construction": ["📐 Site Feasibility Note", "📊 BOQ (Base)", "🧱 Preliminary Material List"],
  Approval: ["📝 Drawing Submission Checklist", "🏛 Approval Process Guide", "📍 Utility NOCs Tracker"],
  Execution: ["📅 Construction Timeline", "🧾 Daily Progress Report Template", "🛠 Quality Checklists"],
  Financial: ["💰 Cost Abstract", "📉 Payment Schedule", "🤝 Contractor Agreement"],
  Handover: ["✅ Snag List", "📦 Handover Checklist", "📘 Maintenance Notes"]
} as const;

const faqs = [
  {
    q: "What documents are included?",
    a: "BuildDocs generates BOQ, estimates, procurement plans, payment schedules, timeline PDFs, DPR templates, and contractor agreement documents."
  },
  {
    q: "Are the rates accurate for my city?",
    a: "Yes, rates are adjusted city-wise and spec-wise. You can also override with your own custom material rates."
  },
  {
    q: "Can I edit the generated BOQ?",
    a: "Yes. Excel outputs are fully editable so you can adjust line items, rates, and assumptions."
  },
  {
    q: "Do I need a civil engineering degree to use this?",
    a: "No. The flow is designed for homeowners, builders, and contractors with plain-language guidance."
  },
  {
    q: "How is this different from hiring a quantity surveyor?",
    a: "BuildDocs gives fast, structured first-cut outputs at a fraction of cost, while still allowing expert review when needed."
  },
  {
    q: "Is the contractor agreement legally valid?",
    a: "It is a practical work-order draft format. You should get final legal vetting for your jurisdiction and project specifics."
  }
];

export default function LandingPage() {
  const [active, setActive] = useState<keyof typeof phases>("Pre-Construction");
  const [openFaq, setOpenFaq] = useState(0);

  return (
    <main className="bg-white text-ink">
      <header className="sticky top-0 z-30 border-b border-[#F0F0ED] bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-[1100px] items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-md bg-gradient-to-r from-[#2563EB] to-[#06B6A4]" />
            <span className="text-lg font-extrabold text-[#1A1A2E]">BuildDocs.ai</span>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <a href="#sample" className="text-[#6B7280] hover:text-[#2563EB]">Features</a>
            <a href="#pricing" className="text-[#6B7280] hover:text-[#2563EB]">Pricing</a>
            <Link href="/" className="rounded-full bg-[#2563EB] px-3 py-1.5 font-semibold text-white">Try Free →</Link>
          </div>
        </div>
      </header>
      <section className="relative overflow-hidden border-b border-gray-200 bg-[linear-gradient(to_right,#f1f5f9_1px,transparent_1px),linear-gradient(to_bottom,#f1f5f9_1px,transparent_1px)] bg-[size:28px_28px]">
        <div className="mx-auto max-w-6xl px-4 py-20 text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Every Construction Document. One Click.</h1>
          <p className="mx-auto mt-5 max-w-3xl text-base text-gray-600 sm:text-lg">
            Stop paying ₹25,000 to quantity surveyors. BuildDocs.ai generates your complete BOQ, estimates,
            schedules, and agreements in minutes.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/" className="rounded-lg bg-primary px-5 py-3 font-semibold text-white hover:brightness-110">
              Generate Documents Free →
            </Link>
            <a href="#sample" className="rounded-lg border border-gray-300 px-5 py-3 font-semibold text-ink hover:bg-gray-50">
              See Sample Output
            </a>
          </div>
          <p className="mt-6 text-sm text-gray-600">Trusted by 500+ builders across India</p>
          <p className="mt-2 text-sm text-gray-500">Mumbai • Delhi • Bangalore • Chennai • Hyderabad • Pune • Ahmedabad • Kolkata</p>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl grid-cols-2 gap-3 px-4 py-8 text-center text-sm font-semibold sm:grid-cols-4">
        <div className="rounded-lg border p-4">33+ Documents</div>
        <div className="rounded-lg border p-4">20 Cities</div>
        <div className="rounded-lg border p-4">CPWD/DSR Compliant</div>
        <div className="rounded-lg border p-4">&lt; 2 Min Generation</div>
      </section>

      <section id="sample" className="mx-auto max-w-6xl px-4 py-10">
        <h2 className="text-2xl font-semibold">What You Get</h2>
        <p className="mt-2 text-sm text-gray-600">All this comes from filling one simple form.</p>
        <div className="mt-5 flex flex-wrap gap-2">
          {(Object.keys(phases) as Array<keyof typeof phases>).map((tab) => (
            <button
              key={tab}
              onClick={() => setActive(tab)}
              className={`rounded-full px-4 py-2 text-sm font-semibold ${active === tab ? "bg-primary text-white" : "bg-gray-100 text-gray-700"}`}
            >
              {tab}
            </button>
          ))}
        </div>
        <div className="mt-5 rounded-xl border p-5">
          <ul className="space-y-2 text-sm">
            {phases[active].map((doc) => (
              <li key={doc}>{doc}</li>
            ))}
          </ul>
        </div>
      </section>

      <section id="pricing" className="mx-auto max-w-6xl px-4 py-10">
        <h2 className="text-2xl font-semibold">How It Works</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border p-5"><p className="text-3xl">📝</p><h3 className="mt-2 font-semibold">Fill Basic Details</h3><p className="mt-1 text-sm text-gray-600">Enter plot size, city, floors and building type.</p></div>
          <div className="rounded-xl border p-5"><p className="text-3xl">⚙️</p><h3 className="mt-2 font-semibold">AI Generates Everything</h3><p className="mt-1 text-sm text-gray-600">BuildDocs compiles BOQ, schedules, agreements and summaries.</p></div>
          <div className="rounded-xl border p-5"><p className="text-3xl">📦</p><h3 className="mt-2 font-semibold">Download & Build</h3><p className="mt-1 text-sm text-gray-600">Preview, share, export ZIP and execute confidently on site.</p></div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10">
        <h2 className="text-2xl font-semibold">Pricing</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border p-5"><h3 className="font-semibold">Free</h3><p className="mt-1 text-2xl font-bold">₹0</p><p className="mt-2 text-sm">1 project, BOQ + Material List only, BuildDocs watermark</p></div>
          <div className="rounded-xl border-2 border-primary p-5"><p className="mb-2 inline-block rounded-full bg-blue-100 px-2 py-1 text-xs font-semibold text-primary">Most Popular</p><h3 className="font-semibold">Starter</h3><p className="mt-1 text-2xl font-bold">₹999/project</p><p className="mt-2 text-sm">All documents, no watermark, AI review, PDF + Excel</p></div>
          <div className="rounded-xl border p-5"><h3 className="font-semibold">Pro</h3><p className="mt-1 text-2xl font-bold">₹2,499/month</p><p className="mt-2 text-sm">Unlimited projects, contractor comparison, AI chat, priority support</p></div>
        </div>
        <p className="mt-3 text-sm text-gray-600">All plans include CPWD/DSR format and IS code references.</p>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10">
        <h2 className="text-2xl font-semibold">FAQ</h2>
        <div className="mt-5 space-y-2">
          {faqs.map((faq, i) => (
            <div key={faq.q} className="rounded-lg border">
              <button onClick={() => setOpenFaq(openFaq === i ? -1 : i)} className="flex w-full items-center justify-between px-4 py-3 text-left font-medium">
                {faq.q}
                <span>{openFaq === i ? "−" : "+"}</span>
              </button>
              {openFaq === i && <p className="px-4 pb-4 text-sm text-gray-600">{faq.a}</p>}
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t bg-gray-50">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-lg font-semibold">📄 BuildDocs.ai</p>
            <p className="text-sm text-gray-600">Made in India 🇮🇳 for Indian builders</p>
          </div>
          <div className="flex gap-4 text-sm">
            <a href="#">About</a>
            <a href="#">Contact</a>
            <a href="#">Privacy Policy</a>
          </div>
          <button className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white">Need help? WhatsApp us</button>
        </div>
      </footer>
    </main>
  );
}

