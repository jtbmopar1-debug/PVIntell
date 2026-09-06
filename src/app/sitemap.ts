import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://pv-intell.vercel.app";
  const lastModified = new Date();
  return [
    { url: base, lastModified, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/login`, lastModified, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/faq`, lastModified, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/glossary`, lastModified, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/help`, lastModified, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/privacy`, lastModified, changeFrequency: "yearly", priority: 0.2 },
    { url: `${base}/terms`, lastModified, changeFrequency: "yearly", priority: 0.2 },
  ];
}
