import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PVIntell — Your solar. Answered.",
    short_name: "PVIntell",
    id: "/",
    description: "Design, understand and manage solar power systems with Wattson.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f3f6fa",
    theme_color: "#f6c945",
    orientation: "any",
    categories: ["utilities", "productivity", "education"],
    shortcuts: [
      { name: "Dashboard", short_name: "Dashboard", url: "/dashboard" },
      { name: "Glossary", short_name: "Glossary", url: "/glossary" },
      { name: "Account", short_name: "Account", url: "/account" },
      { name: "Settings", short_name: "Settings", url: "/settings" },
    ],
    icons: [
      { src: "/pwa-icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa-icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa-icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/pwa-icon-maskable.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
