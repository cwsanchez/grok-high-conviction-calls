import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Grok High-Conviction Calls",
  description:
    "One high-conviction options trade per week, decided by 4 competing AI agents and a strict 8-point checklist. Quality over quantity.",
  openGraph: {
    title: "Grok High-Conviction Calls",
    description:
      "One high-conviction options trade per week. Decided by 4 AI agents + strict 8-point checklist.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
