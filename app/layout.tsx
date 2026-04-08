import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"]
});

export const metadata: Metadata = {
  title: "BuildDocs.ai — Construction BOQ & Document Generator India",
  description:
    "Generate BOQ, estimates, schedules, agreements, and construction documents for Indian residential projects in minutes.",
  openGraph: {
    title: "BuildDocs.ai — Construction BOQ & Document Generator India",
    description:
      "Generate BOQ, estimates, schedules, agreements, and construction documents for Indian residential projects in minutes.",
    images: ["https://builddocs.ai/og-image.png"]
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
