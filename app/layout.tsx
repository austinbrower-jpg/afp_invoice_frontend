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
        {/* Two type systems on purpose, matching the two design systems.
            Saira + JetBrains Mono are Station's, for the console (docs/10).
            Instrument Sans + IBM Plex Mono are the paper's, unchanged from the
            prototype. The paper's type is part of a print output already verified in
            Phase 3, so it does not get restyled along with the console. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Instrument+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&family=Saira:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
