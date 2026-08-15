import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PVIntell — Power, made clear",
    short_name: "PVIntell",
    description: "Design, understand and manage solar power systems with Wattson.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#f3f6fa",
    theme_color: "#f6c945",
    orientation: "any",
    icons: [
      { src: "/pwa-icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa-icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa-icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/pwa-icon-maskable.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
