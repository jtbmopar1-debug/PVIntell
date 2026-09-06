import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://pv-intell.vercel.app";
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/account", "/dashboard", "/onboarding", "/settings", "/sites/", "/systems", "/wattson"] },
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
