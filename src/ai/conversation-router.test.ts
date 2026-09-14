import { describe, expect, it } from "vitest";
import { parseWattsonConversationState, reduceWattsonUserTurn } from "./conversation-state";
import { actionsAllowedByDecision, routeWattsonTurn } from "./conversation-router";

describe("single Wattson intent and consent router", () => {
  it.each([
    "Why is my battery going flat?",
    "What size inverter would this need?",
    "Can you explain what a schematic is?",
  ])("keeps technical questions read-only: %s", (message) => {
    const decision = routeWattsonTurn(message, parseWattsonConversationState(undefined));
    expect(decision.mutationConsent).toBe(false);
    expect(decision.mode).toBe("answer");
  });

  it("does not mistake a request for an update as permission to update records", () => {
    expect(routeWattsonTurn("Can you update me on how the system is performing?", parseWattsonConversationState(undefined))).toMatchObject({ mode: "answer", mutationConsent: false });
  });

  it("routes a new Site request to setup rather than equipment recording", () => {
    expect(routeWattsonTurn("Add a new site", parseWattsonConversationState(undefined))).toMatchObject({ intent: "new_system", mode: "offer", mutationConsent: false });
  });

  it("treats an explicit schematic build request as consent, but not a mention", () => {
    expect(routeWattsonTurn("Build a schematic for this setup", parseWattsonConversationState(undefined))).toMatchObject({ intent: "schematic", mode: "execute", mutationConsent: true });
    expect(routeWattsonTurn("i need a schematic pls - 8x630w panels in a 4p2s", parseWattsonConversationState(undefined))).toMatchObject({ intent: "schematic", mode: "execute", mutationConsent: true });
    expect(routeWattsonTurn("What is a schematic?", parseWattsonConversationState(undefined))).toMatchObject({ intent: "schematic", mode: "answer", mutationConsent: false });
  });

  it("requires explicit record language before model tools may mutate", () => {
    const state = parseWattsonConversationState(undefined);
    const readOnly = routeWattsonTurn("This is a 12 V battery", state);
    const explicit = routeWattsonTurn("Record this as a 12 V battery", state);
    const actions = [{ name: "record_added_component", arguments: {} }];
    expect(actionsAllowedByDecision(actions, readOnly)).toEqual([]);
    expect(actionsAllowedByDecision(actions, explicit)).toEqual(actions);
  });

  it("keeps discovery help only for an answer or same-subject follow-up", () => {
    const state = parseWattsonConversationState(undefined);
    state.activeIntent = "discovery_help";
    state.activeSubject = { kind: "site", description: "Available roof area and obstructions", association: "unassociated" };
    expect(routeWattsonTurn("About 3 by 17 metres", state).intent).toBe("discovery_help");
    expect(routeWattsonTurn("What counts as a roof obstruction?", state).intent).toBe("discovery_help");
    expect(routeWattsonTurn("Why is my battery going flat?", state).intent).toBe("technical_answer");
  });

  it("confirms only a typed pending action and clears it on rejection", () => {
    let state = parseWattsonConversationState(undefined);
    expect(routeWattsonTurn("Yes", state).mutationConsent).toBe(false);
    state.pendingAction = { kind: "attach_record", status: "offered", description: "Attach evidence" };
    state = reduceWattsonUserTurn(state, "Yes, do it");
    expect(routeWattsonTurn("Yes, do it", state)).toMatchObject({ mode: "execute", mutationConsent: true });
    state = reduceWattsonUserTurn(state, "No, cancel that");
    expect(state.pendingAction).toBeUndefined();
  });

  it("offers a new-system workflow without creating records", () => {
    expect(routeWattsonTurn("Help me set up a new solar system", parseWattsonConversationState(undefined))).toMatchObject({ intent: "new_system", mode: "offer", mutationConsent: false });
  });

  it("routes Site discovery without allowing record actions", () => {
    expect(routeWattsonTurn("Help me with site discovery", parseWattsonConversationState(undefined))).toMatchObject({ intent: "site_discovery", mode: "offer", mutationConsent: false });
  });
});
