import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const supportRequestSchema = z.object({
  category: z.enum(["account", "billing", "technical", "feedback", "other"]),
  subject: z.string().trim().min(3).max(120),
  context: z.string().trim().max(160).optional().default(""),
  message: z.string().trim().min(20).max(5000),
  website: z.string().max(0).optional().default(""),
});

const categoryLabels: Record<z.infer<typeof supportRequestSchema>["category"], string> = {
  account: "Account",
  billing: "Billing",
  technical: "Technical",
  feedback: "Feedback",
  other: "Other",
};

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const parsed = supportRequestSchema.safeParse(payload);
  if (!parsed.success) return Response.json({ error: "Check the subject and message, then try again." }, { status: 400 });

  const supabase = await createClient();
  const claims = await supabase.auth.getClaims();
  const userId = claims.data?.claims?.sub;
  const email = claims.data?.claims?.email;
  if (claims.error || typeof userId !== "string" || typeof email !== "string") {
    return Response.json({ error: "Sign in again before contacting support." }, { status: 401 });
  }

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const recent = await supabase
    .from("support_requests")
    .select("created_at")
    .eq("owner_id", userId)
    .gte("created_at", oneHourAgo)
    .order("created_at", { ascending: false });
  if (recent.error) return Response.json({ error: "Support messaging is not ready on this deployment." }, { status: 503 });
  if ((recent.data?.length ?? 0) >= 5) return Response.json({ error: "You have sent several messages recently. Please wait an hour before trying again." }, { status: 429 });
  const latestAt = recent.data?.[0]?.created_at ? new Date(recent.data[0].created_at).getTime() : 0;
  if (latestAt && Date.now() - latestAt < 30_000) return Response.json({ error: "Please wait a moment before sending another message." }, { status: 429 });

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  const to = process.env.PVINTELL_SUPPORT_EMAIL || "pvintell1@gmail.com";
  if (!apiKey || !from) return Response.json({ error: "Email support is not configured on this deployment." }, { status: 503 });

  const delivery = await supabase
    .from("support_requests")
    .insert({ owner_id: userId, status: "pending" })
    .select("id")
    .single();
  if (delivery.error) return Response.json({ error: "Your message could not be prepared. Please try again." }, { status: 500 });

  const { category, subject, context, message } = parsed.data;
  const details = [
    `PVIntell support request`,
    `Category: ${categoryLabels[category]}`,
    `Account: ${email}`,
    `User ID: ${userId}`,
    context ? `Site or system: ${context}` : "",
  ].filter((line) => line !== "").join("\n");
  const text = `${details}\n\n${message}`;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": delivery.data.id,
      },
      body: JSON.stringify({
        from,
        to: [to],
        reply_to: email,
        subject: `[PVIntell ${categoryLabels[category]}] ${subject}`,
        text,
      }),
    });
    const result = await response.json().catch(() => ({})) as { id?: string; message?: string };
    if (!response.ok || !result.id) {
      await supabase.from("support_requests").update({ status: "failed" }).eq("id", delivery.data.id);
      return Response.json({ error: result.message || "The email service could not send your message." }, { status: 502 });
    }
    await supabase.from("support_requests").update({ status: "sent", resend_email_id: result.id }).eq("id", delivery.data.id);
    return Response.json({ sent: true });
  } catch {
    await supabase.from("support_requests").update({ status: "failed" }).eq("id", delivery.data.id);
    return Response.json({ error: "The email service could not be reached. Please try again." }, { status: 502 });
  }
}
