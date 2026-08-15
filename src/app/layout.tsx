import type { Metadata, Viewport } from "next";
import { ServiceWorkerRegister } from "@/components/service-worker-register";
import "./globals.css";

export const metadata: Metadata = {
  title: "PVIntell — Power, made clear",
  description: "AI-first design, commissioning, monitoring, and diagnostics for solar power systems.",
  applicationName: "PVIntell",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "PVIntell" },
  icons: { icon: "/pwa-icon.svg", apple: "/pwa-icon-192.png" },
};

export const viewport: Viewport = {
  themeColor: "#f6c945",
  colorScheme: "light",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">{children}<ServiceWorkerRegister /></body>
    </html>
  );
}
