import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Frontend Project Planner",
  description: "Decompose vague product briefs into navigable, editable, and coherent page-level component trees.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="dark h-full antialiased"
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
