import type { NextConfig } from "next";

function supabaseImagePattern() {
  const value = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!value) return [];
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return [];
    return [{
      protocol: url.protocol.slice(0, -1) as "https" | "http",
      hostname: url.hostname,
      port: url.port,
      pathname: "/storage/v1/object/sign/project-photos/**",
    }];
  } catch {
    return [];
  }
}

const nextConfig: NextConfig = {
  images: { remotePatterns: supabaseImagePattern() },
  async headers() {
    return [{
      source: "/sw.js",
      headers: [
        { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
      ],
    }];
  },
};

export default nextConfig;
