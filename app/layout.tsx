import type { Metadata } from "next";
import type { ReactNode } from "react";
import localFont from "next/font/local";
import { getSiteUrl } from "@/lib/site.js";
import { ScrollRestore } from "@/components/scroll-restore";
import "./globals.css";

const newsreader = localFont({
  src: [
    { path: "./fonts/newsreader-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/newsreader-600.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-newsreader",
  display: "swap",
});

const sourceSans = localFont({
  src: [
    { path: "./fonts/source-sans-3-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/source-sans-3-600.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-source-sans",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: { default: "News, explained", template: "%s" },
  description: "Short explanations of news from Brazil and the world.",
  openGraph: {
    images: [{ url: "/og/default.png", width: 1200, height: 630, alt: "News, explained" }],
    type: "website",
  },
  twitter: { card: "summary_large_image" },
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" className={`${newsreader.variable} ${sourceSans.variable}`} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: "document.documentElement.lang=location.pathname.indexOf('/en/')===0?'en':'pt-BR'",
          }}
        />
      </head>
      <body>
        <ScrollRestore />
        {children}
      </body>
    </html>
  );
}
