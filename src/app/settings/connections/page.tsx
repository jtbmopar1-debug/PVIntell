import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MonitoringConnections } from "@/components/monitoring-connections";

export default async function ConnectionsPage() {
  const db = await createClient(); const claims = await db.auth.getClaims();
  if (claims.error || typeof claims.data?.claims?.sub !== "string") redirect("/login");
  return <MonitoringConnections/>;
}
