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
      <body>{children}</body>
    </html>
  );
}
