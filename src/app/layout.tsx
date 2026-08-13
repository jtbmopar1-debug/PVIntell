import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PVIntell — Power, made clear",
  description: "AI-first design, commissioning, monitoring, and diagnostics for solar power systems.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
