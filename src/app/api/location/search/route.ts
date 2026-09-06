import { createClient } from "@/lib/supabase/server";

type OpenMeteoResult = { name: string; admin1?: string; admin2?: string; country?: string; latitude: number; longitude: number; timezone?: string };

export async function GET(request: Request) {
  const supabase = await createClient();
  const claims = await supabase.auth.getClaims();
  if (claims.error || typeof claims.data?.claims?.sub !== "string") return Response.json({ error: "Unauthorized" }, { status: 401 });
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length < 2 || query.length > 200) return Response.json({ error: "Enter at least two characters." }, { status: 400 });
  try {
    const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=6&language=en&format=json`, { next: { revalidate: 86_400 } });
    if (!response.ok) throw new Error("Location service unavailable");
    const body = await response.json() as { results?: OpenMeteoResult[] };
    const results = (body.results ?? []).map((result) => ({
      name: result.name,
      label: [result.name, result.admin2, result.admin1, result.country].filter((part, index, all) => part && all.indexOf(part) === index).join(", "),
      latitude: result.latitude,
      longitude: result.longitude,
      timezone: result.timezone || "UTC",
    }));
    return Response.json({ results });
  } catch {
    return Response.json({ error: "Location search is temporarily unavailable. Try again shortly." }, { status: 503 });
  }
}
