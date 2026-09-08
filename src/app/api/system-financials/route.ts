import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const entry = z.object({ id: z.string().min(1).max(100), type: z.enum(["purchase", "other_cost", "rebate", "buyback", "other_income"]), date: z.string().date(), description: z.string().trim().min(1).max(200), amount: z.number().positive().max(1_000_000_000), vendor: z.string().max(200).optional(), notes: z.string().max(1000).optional() });
const schema = z.object({ projectId: z.string().uuid(), financials: z.object({ currency: z.string().regex(/^[A-Z]{3}$/), entries: z.array(entry).max(5000), updatedAt: z.string().datetime().optional() }) });
const purchaseSchema = z.object({ projectId: z.string().uuid(), purchase: z.object({ date: z.string().date(), description: z.string().trim().min(1).max(200), amount: z.number().positive().max(1_000_000_000), vendor: z.string().trim().max(200).optional(), notes: z.string().trim().max(1000).optional() }) });

export async function PUT(request: Request) {
  const parsed = schema.safeParse(await request.json()); if (!parsed.success) return Response.json({ error: "Invalid financial entry." }, { status: 400 });
  const supabase = await createClient(); const claims = await supabase.auth.getClaims(); const userId = claims.data?.claims?.sub; if (claims.error || typeof userId !== "string") return Response.json({ error: "Unauthorized" }, { status: 401 });
  const current = await supabase.from("projects").select("settings").eq("id", parsed.data.projectId).eq("owner_id", userId).maybeSingle(); if (current.error || !current.data) return Response.json({ error: current.error?.message ?? "System not found." }, { status: 404 });
  const settings = { ...((current.data.settings ?? {}) as Record<string, unknown>), systemFinancials: parsed.data.financials };
  const saved = await supabase.from("projects").update({ settings }).eq("id", parsed.data.projectId).eq("owner_id", userId); if (saved.error) return Response.json({ error: saved.error.message }, { status: 400 });
  return Response.json({ ok: true });
}

export async function POST(request: Request) {
  let payload: unknown;
  try { payload = await request.json(); }
  catch { return Response.json({ error: "Invalid purchase entry." }, { status: 400 }); }
  const parsed = purchaseSchema.safeParse(payload);
  if (!parsed.success) return Response.json({ error: "Add a valid purchase date, description and amount." }, { status: 400 });
  const supabase = await createClient();
  const claims = await supabase.auth.getClaims();
  const userId = claims.data?.claims?.sub;
  if (claims.error || typeof userId !== "string") return Response.json({ error: "Unauthorized" }, { status: 401 });
  const current = await supabase.from("projects").select("settings").eq("id", parsed.data.projectId).eq("owner_id", userId).maybeSingle();
  if (current.error || !current.data) return Response.json({ error: current.error?.message ?? "System not found." }, { status: 404 });
  const settings = (current.data.settings ?? {}) as Record<string, unknown>;
  const existing = z.object({ currency: z.string().regex(/^[A-Z]{3}$/), entries: z.array(entry), updatedAt: z.string().datetime().optional() }).safeParse(settings.systemFinancials);
  const previous = existing.success ? existing.data : { currency: "NZD", entries: [] };
  const purchase = parsed.data.purchase;
  const financials = {
    ...previous,
    entries: [{ id: crypto.randomUUID(), type: "purchase" as const, ...purchase, vendor: purchase.vendor || undefined, notes: purchase.notes || undefined }, ...previous.entries],
    updatedAt: new Date().toISOString(),
  };
  const saved = await supabase.from("projects").update({ settings: { ...settings, systemFinancials: financials } }).eq("id", parsed.data.projectId).eq("owner_id", userId);
  if (saved.error) return Response.json({ error: saved.error.message }, { status: 400 });
  return Response.json({ ok: true, financials });
}
