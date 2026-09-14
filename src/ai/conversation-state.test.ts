import { describe, expect, it } from "vitest";
import {
  parseWattsonConversationState,
  recordWattsonAssistantTurn,
  reduceWattsonUserTurn,
  removeAnsweredWattsonQuestions,
} from "./conversation-state";

describe("authoritative Wattson conversation state", () => {
  it("persists image evidence without treating it as record consent", () => {
    const state = reduceWattsonUserTurn(undefined, "What does this label say?", {
      image: { imagePath: "owner/chat/photo.jpg", extraction: { equipmentType: "controller", manufacturer: "Victron", model: "100/30", ratedCurrent: "30 A" } },
    });
    expect(state.evidence.some((item) => item.source === "image")).toBe(true);
    expect(state.facts).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: "controller.manufacturer", value: "Victron", source: "image" }),
      expect.objectContaining({ key: "controller.model", value: "100/30", source: "image" }),
    ]));
    expect(state.pendingAction).toBeUndefined();
  });

  it("lets a user correction override older image evidence", () => {
    let state = reduceWattsonUserTurn(undefined, "What is this battery?", {
      image: { extraction: { equipmentType: "battery", ratedVoltage: "24 V" } },
    });
    state = reduceWattsonUserTurn(state, "No, I told you earlier: the battery is 12 V, 100 Ah AGM.");
    expect(state.facts.find((fact) => fact.key === "battery.nominal_voltage_v")).toMatchObject({ value: 12, source: "user", correctedAtRevision: 2 });
    expect(state.facts.find((fact) => fact.key === "battery.capacity_ah")?.value).toBe(100);
    expect(state.corrections.at(-1)?.statement).toMatch(/12 V, 100 Ah AGM/i);
  });

  it("does not collapse multiple messages or components into one kind slot", () => {
    let state = reduceWattsonUserTurn(undefined, "The starter battery is 12 V 80 Ah.");
    state = reduceWattsonUserTurn(state, "The house battery is 12 V 110 Ah.");
    expect(state.evidence.filter((item) => item.source === "user")).toHaveLength(2);
    expect(state.evidence.map((item) => item.summary).join(" ")).toMatch(/starter battery.*house battery/i);
  });

  it("clears a rejected pending action and cannot capture a later yes", () => {
    const initial = parseWattsonConversationState(undefined);
    initial.pendingAction = { kind: "record_equipment", status: "offered", description: "Record the pictured controller" };
    let state = reduceWattsonUserTurn(initial, "No, don't save it.");
    expect(state.pendingAction).toBeUndefined();
    state = reduceWattsonUserTurn(state, "Is a 30 A controller large enough?");
    state = reduceWattsonUserTurn(state, "Yes");
    expect(state.pendingAction).toBeUndefined();
  });

  it("drops an old offer and open question when the user changes topic", () => {
    let state = reduceWattsonUserTurn(undefined, "Tell me about my battery");
    state.pendingAction = { kind: "record_equipment", status: "offered", description: "Record the battery" };
    state = recordWattsonAssistantTurn(state, "What is the battery model?");
    state = reduceWattsonUserTurn(state, "Now about a separate boat setup");
    expect(state.pendingAction).toBeUndefined();
    expect(state.questions.some((question) => !question.answered)).toBe(false);
    expect(state.activeSubject?.description).toContain("separate boat setup");
  });

  it("does not restore the previous system onto an explicitly separate setup", () => {
    const state = reduceWattsonUserTurn(undefined, "Now about a separate boat system", {
      site: { id: "site-1", name: "River Views" },
      system: { id: "system-1", name: "Main House" },
    });
    expect(state.activeSubject).toMatchObject({ association: "unassociated" });
    expect(state.activeSubject?.systemId).toBeUndefined();
  });

  it("blocks an already answered follow-up without using transcript truncation", () => {
    let state = recordWattsonAssistantTurn(parseWattsonConversationState(undefined), "Which Site is this setup for?");
    state = reduceWattsonUserTurn(state, "River Views");
    for (let index = 0; index < 70; index += 1) state = reduceWattsonUserTurn(state, `Long conversation fact ${index}`);
    expect(removeAnsweredWattsonQuestions("I have the setup. Which Site is this setup for?", state)).toBe("I have the setup.");
  });

  it("blocks a reworded model question when the confirmed fact already answers it", () => {
    const state = reduceWattsonUserTurn(undefined, "The inverter model is Victron MultiPlus-II 48/5000.");
    expect(removeAnsweredWattsonQuestions("What make and model is the inverter?", state)).toBe("");
  });

  it("keeps corrections and facts after evidence compaction", () => {
    let state = parseWattsonConversationState(undefined);
    for (let index = 0; index < 130; index += 1) state = reduceWattsonUserTurn(state, `Observation ${index}`);
    state = reduceWattsonUserTurn(state, "Actually, the battery is 48 V 200 Ah LFP.");
    expect(state.evidence).toHaveLength(100);
    expect(state.facts.find((fact) => fact.key === "battery.nominal_voltage_v")?.value).toBe(48);
    expect(state.corrections.at(-1)?.statement).toMatch(/48 V 200 Ah LFP/i);
  });

  it("keeps separate conversations independent", () => {
    const boat = reduceWattsonUserTurn(undefined, "The boat battery is 12 V 100 Ah.");
    const cabin = reduceWattsonUserTurn(undefined, "The cabin battery is 48 V 200 Ah.");
    expect(boat.facts.find((fact) => fact.key === "battery.nominal_voltage_v")?.value).toBe(12);
    expect(cabin.facts.find((fact) => fact.key === "battery.nominal_voltage_v")?.value).toBe(48);
  });
});
