import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AFP Invoice Builder",
  description: "Read AFP work sessions from Notion and produce a print-ready invoice.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {/* The prototype's fonts, kept as-is. The stylesheet names these families
            directly in dozens of rules, including the print block, so swapping in
            next/font would mean rewriting the CSS that is the deliverable. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Instrument+Sans:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
