import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const entry = z.object({ id: z.string().min(1).max(100), type: z.enum(["purchase", "other_cost", "rebate", "buyback", "other_income"]), date: z.string().date(), description: z.string().trim().min(1).max(200), amount: z.number().positive().max(1_000_000_000), vendor: z.string().max(200).optional(), notes: z.string().max(1000).optional() });
const schema = z.object({ projectId: z.string().uuid(), financials: z.object({ currency: z.string().regex(/^[A-Z]{3}$/), entries: z.array(entry).max(5000), updatedAt: z.string().datetime().optional() }) });

export async function PUT(request: Request) {
  const parsed = schema.safeParse(await request.json()); if (!parsed.success) return Response.json({ error: "Invalid financial entry." }, { status: 400 });
  const supabase = await createClient(); const claims = await supabase.auth.getClaims(); const userId = claims.data?.claims?.sub; if (claims.error || typeof userId !== "string") return Response.json({ error: "Unauthorized" }, { status: 401 });
  const current = await supabase.from("projects").select("settings").eq("id", parsed.data.projectId).eq("owner_id", userId).maybeSingle(); if (current.error || !current.data) return Response.json({ error: current.error?.message ?? "System not found." }, { status: 404 });
  const settings = { ...((current.data.settings ?? {}) as Record<string, unknown>), systemFinancials: parsed.data.financials };
  const saved = await supabase.from("projects").update({ settings }).eq("id", parsed.data.projectId).eq("owner_id", userId); if (saved.error) return Response.json({ error: saved.error.message }, { status: 400 });
  return Response.json({ ok: true });
}
