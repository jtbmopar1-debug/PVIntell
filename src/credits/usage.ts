import type { SupabaseClient } from "@supabase/supabase-js";
import { wattsonCreditCost, type WattsonCreditAction } from "./catalog";

export async function recordShadowCreditUsage(
  db: SupabaseClient,
  input: {
    ownerId: string;
    action: WattsonCreditAction;
    projectId?: string;
    siteId?: string;
    idempotencyKey?: string;
    metadata?: Record<string, unknown>;
  },
) {
  const recorded = await db.from("wattson_credit_usage").insert({
    owner_id: input.ownerId,
    project_id: input.projectId ?? null,
    site_id: input.siteId ?? null,
    action_key: input.action,
    proposed_credits: wattsonCreditCost(input.action),
    idempotency_key: input.idempotencyKey ?? null,
    metadata: input.metadata ?? {},
  });

  // Credit tracking is observational during testing and must never break the
  // successful product action it is measuring.
  if (recorded.error && recorded.error.code !== "23505")
    console.error("Could not record shadow Wattson Credit usage", recorded.error.message);
}

export async function recordOwnShadowCreditUsage(
  db: SupabaseClient,
  input: {
    action: WattsonCreditAction;
    projectId?: string;
    siteId?: string;
    idempotencyKey?: string;
    metadata?: Record<string, unknown>;
  },
) {
  const recorded = await db.rpc("record_own_wattson_credit_usage", {
    usage_action_key: input.action,
    usage_project_id: input.projectId ?? null,
    usage_site_id: input.siteId ?? null,
    usage_idempotency_key: input.idempotencyKey ?? null,
    usage_metadata: input.metadata ?? {},
  });
  if (recorded.error) console.error("Could not record own shadow Wattson Credit usage", recorded.error.message);
}
