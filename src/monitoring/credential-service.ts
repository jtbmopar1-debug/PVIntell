import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { MonitoringCredentialResolver, MonitoringCredentialScope } from "@/monitoring/connector";

type JsonCredential = Record<string, unknown>;

function requireCredentialObject(value: unknown): JsonCredential {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Monitoring credential must be an object");
  return value as JsonCredential;
}

/**
 * Trusted-server credential boundary. The supplied client must use the
 * Supabase service role; never instantiate this service in a client module.
 */
export class SupabaseVaultCredentialService implements MonitoringCredentialResolver {
  constructor(private readonly admin: SupabaseClient) {}

  async store(scope: MonitoringCredentialScope, credential: JsonCredential): Promise<void> {
    const serialized = JSON.stringify(requireCredentialObject(credential));
    const { error } = await this.admin.rpc("store_monitoring_connection_secret", {
      target_owner_id: scope.ownerId,
      target_site_id: scope.siteId,
      target_project_id: scope.systemId,
      target_connection_id: scope.connectionId,
      secret_value: serialized,
    });
    if (error) throw new Error("Could not securely store monitoring credentials");
  }

  async resolve(scope: MonitoringCredentialScope): Promise<JsonCredential> {
    const { data, error } = await this.admin.rpc("resolve_monitoring_connection_secret", {
      target_owner_id: scope.ownerId,
      target_site_id: scope.siteId,
      target_project_id: scope.systemId,
      target_connection_id: scope.connectionId,
    });
    if (error || typeof data !== "string" || !data) throw new Error("Monitoring credentials are unavailable");
    try {
      return requireCredentialObject(JSON.parse(data));
    } catch {
      throw new Error("Stored monitoring credentials are invalid");
    }
  }

  async delete(scope: MonitoringCredentialScope): Promise<void> {
    const { error } = await this.admin.rpc("delete_monitoring_connection_secret", {
      target_owner_id: scope.ownerId,
      target_site_id: scope.siteId,
      target_project_id: scope.systemId,
      target_connection_id: scope.connectionId,
    });
    if (error) throw new Error("Could not remove monitoring credentials");
  }
}
