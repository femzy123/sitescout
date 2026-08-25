import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Bricolage_Grotesque, Instrument_Sans } from "next/font/google";
import type { ReactNode } from "react";

import { Toaster } from "@/components/ui/toaster";

import "./globals.css";

const display = Bricolage_Grotesque({
  variable: "--font-display",
  subsets: ["latin"],
});
const sans = Instrument_Sans({ variable: "--font-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "SiteScout", template: "%s · SiteScout" },
  description:
    "Find overlooked businesses, uncover website opportunities, and turn evidence into the next sales conversation.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${sans.variable}`}
      suppressHydrationWarning
    >
      <body suppressHydrationWarning>
        <ClerkProvider>
          {children}
          <Toaster />
        </ClerkProvider>
      </body>
    </html>
  );
}
