import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import Script from "next/script";
import { ServiceWorkerRegister } from "@/components/service-worker-register";
import { LocalMonitoringProvider } from "@/components/local-monitoring-provider";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://pv-intell.vercel.app"),
  title: "PVIntell — Your solar. Answered.",
  description: "AI-first design, commissioning, monitoring, and diagnostics for solar power systems.",
  applicationName: "PVIntell",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "PVIntell" },
  icons: { icon: "/brand/pvintell-mark.png", apple: "/pwa-icon-192.png" },
};

export const viewport: Viewport = {
  themeColor: "#f6c945",
  colorScheme: "light dark",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full"><LocalMonitoringProvider>{children}</LocalMonitoringProvider><ServiceWorkerRegister /><Script id="pvintell-theme" strategy="beforeInteractive">{`(function(){try{var t=localStorage.getItem('pvintell:theme:v1')==='dark'?'dark':'light';document.documentElement.dataset.theme=t;document.documentElement.style.colorScheme=t}catch(e){}})()`}</Script></body>
    </html>
  );
}
