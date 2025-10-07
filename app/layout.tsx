import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";
import { AppProviders } from "@/components/providers";

const manrope = Manrope({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Golden Bridge Loan",
  description:
    "Golden Bridge Loan - AI-native lending concierge for borrowers and brokers across the United States."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${manrope.variable} bg-slate-950 font-sans text-slate-100`}>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
