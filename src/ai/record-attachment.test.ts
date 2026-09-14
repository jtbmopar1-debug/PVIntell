import { describe, expect, it } from "vitest";
import { resolveRecordAttachmentTarget } from "./record-attachment";

const components = [
  { id: "a", project_id: "system-1", type: "inverter", display_name: "Inverter 1" },
  { id: "b", project_id: "system-1", type: "battery", display_name: "House battery" },
];
const arrays = [{ id: "p", project_id: "system-1", name: "PV1" }];

describe("record attachment targeting", () => {
  it("resolves one exact named record", () => {
    expect(resolveRecordAttachmentTarget("Attach this photo to PV1", components, arrays).target).toMatchObject({ kind: "pv_array", id: "p", projectId: "system-1" });
  });

  it("resolves a unique equipment type", () => {
    expect(resolveRecordAttachmentTarget("Attach this to the inverter", components, arrays).target).toMatchObject({ kind: "component", id: "a", projectId: "system-1" });
  });

  it("does not select between duplicate equipment records", () => {
    const result = resolveRecordAttachmentTarget("Attach this to the inverter", [...components, { id: "c", project_id: "system-1", type: "inverter", display_name: "Inverter 2" }], arrays);
    expect(result.target).toBeUndefined();
    expect(result.candidates).toHaveLength(2);
  });
});
