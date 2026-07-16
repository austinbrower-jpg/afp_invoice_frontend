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
        {/* Applies the saved theme and layout before paint so there is no flash of the default.
            Runs before React hydrates; React does not manage these attributes, so no mismatch.
            Fails safe to the defaults. Kept in sync with app/useSettings.ts. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var s=JSON.parse(localStorage.getItem('afp.cockpit.settings.v1')||'{}');" +
              "var t=['station','ion','ember','daylight','overdrive','mono'];" +
              "var l=['balanced','invoice','instruments'];" +
              "document.documentElement.dataset.theme=t.indexOf(s.theme)>=0?s.theme:'station';" +
              "document.documentElement.dataset.layout=l.indexOf(s.layout)>=0?s.layout:'balanced';" +
              "}catch(e){document.documentElement.dataset.theme='station';document.documentElement.dataset.layout='balanced';}",
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
