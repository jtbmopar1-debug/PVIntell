import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("complete workspace deletion", () => {
  const migration = readFileSync(resolve(process.cwd(), "supabase/migrations/202609130035_complete_workspace_deletion.sql"), "utf8");
  const systemRoute = readFileSync(resolve(process.cwd(), "src/app/api/systems/[id]/route.ts"), "utf8");
  const draftRoute = readFileSync(resolve(process.cwd(), "src/app/api/discovery/drafts/[id]/route.ts"), "utf8");
  const siteRoute = readFileSync(resolve(process.cwd(), "src/app/api/sites/[id]/route.ts"), "utf8");

  it("deletes the parent Site when its final system is deleted", () => {
    expect(systemRoute).toContain('rpc("delete_system_workspace"');
    expect(migration).toMatch(/delete from public\.projects[\s\S]*if not exists \(select 1 from public\.projects where site_id = parent_site_id\) then[\s\S]*delete_site_workspace\(parent_site_id\)/);
  });

  it("deletes the grouped conversation with a deleted discovery", () => {
    expect(draftRoute).toContain('rpc("delete_discovery_draft_workspace"');
    expect(migration).toMatch(/delete from public\.discovery_drafts[\s\S]*delete from public\.user_conversations/);
  });

  it("cleans existing orphan Sites and all explicit Site deletion references", () => {
    expect(siteRoute).toContain('rpc("delete_site_workspace"');
    expect(migration).toContain("where not exists (select 1 from public.projects project where project.site_id = site.id)");
    expect(migration).toContain("assessment - 'lastGuidedDiscovery'");
    expect(migration).toContain("assessment - 'guidedNewSystem'");
  });
});
