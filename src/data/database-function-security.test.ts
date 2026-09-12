import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(join(process.cwd(), "supabase/migrations/202609130037_restrict_security_definer_functions.sql"), "utf8");

describe("database function exposure", () => {
  it.each([
    "delete_discovery_draft_workspace(uuid)",
    "delete_site_workspace(uuid)",
    "delete_system_workspace(uuid)",
    "owns_project(uuid)",
    "owns_site(uuid)",
    "owns_monitoring_scope(uuid, uuid, uuid)",
    "touch_wattson_conversation()",
  ])("removes SECURITY DEFINER from %s", (signature) => {
    expect(migration).toContain(`alter function public.${signature} security invoker;`);
  });

  it("does not expose internal trigger functions to API roles", () => {
    expect(migration).toContain("revoke all on function public.handle_new_user() from public, anon, authenticated;");
    expect(migration).toContain("revoke all on function public.touch_wattson_conversation() from public, anon, authenticated;");
  });

  it("allows only signed-in callers to use owner-scoped deletion RPCs", () => {
    expect(migration.match(/grant execute on function public\.delete_[^(]+\(uuid\) to authenticated;/g)).toHaveLength(3);
    expect(migration).not.toMatch(/grant execute[\s\S]*delete_[^(]+\(uuid\) to anon/);
  });
});

