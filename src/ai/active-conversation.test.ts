import { describe, expect, it } from "vitest";
import {
  buildActiveConversationState,
  conceptualSchematicForActiveSetup,
  conversationRetrievalPolicy,
  equipmentTargetClarification,
  removeRepeatedAnsweredQuestions,
  type ActiveConversationState,
} from "./active-conversation";

const sites = [{ id: "river-views", name: "River Views" }];

function assistant(content: string, state: ActiveConversationState) {
  return { role: "assistant", content, structured_context: { activeConversation: state } };
}

describe("Wattson active conversation regression", () => {
  it("uses the dashboard-selected Site without associating the subject to its saved system", () => {
    const state = buildActiveConversationState({
      messages: [],
      currentMessage: "What is this controller?",
      knownSites: sites,
      knownSystems: [{ id: "main-house", name: "Main House", siteId: "river-views", siteName: "River Views" }],
      ambientSite: sites[0],
    });
    expect(state.currentSite).toMatchObject({ id: "river-views", name: "River Views", source: "application" });
    expect(state.currentSubject).toMatchObject({ association: "unassociated" });
    expect(state.currentSubject?.associatedSystemId).toBeUndefined();
  });

  it("asks for an explicit target when a clean dashboard chat reports a dying battery", () => {
    const state = buildActiveConversationState({
      messages: [],
      currentMessage: "Why is my battery dying?",
      knownSites: sites,
      knownSystems: [{ id: "main-house", name: "Main House", siteId: "river-views", siteName: "River Views" }],
      ambientSite: sites[0],
    });
    expect(state.currentSubject).toMatchObject({ kind: "component", association: "unassociated" });
    expect(equipmentTargetClarification(state)).toBe("Which Site and power system or battery do you mean? I won’t associate this question with a saved battery until you confirm it.");
  });

  it("asks only for the system after the user explicitly identifies the Site", () => {
    const state = buildActiveConversationState({
      messages: [{ role: "assistant", content: "Which Site and power system or battery do you mean?" }],
      currentMessage: "River Views",
      knownSites: sites,
    });
    state.currentSubject = { kind: "component", description: "the battery mentioned by the user", source: "recent-conversation", association: "unassociated" };
    state.currentUserRequest = "Why is my battery dying?";
    expect(equipmentTargetClarification(state)).toBe("Which power system or battery record at River Views do you mean? I won’t assume it is one of the saved systems.");
  });

  it("keeps the pictured standalone setup active through the complete correction/action/schematic conversation", () => {
    const messages: Array<{ role: string; content: string; structured_context?: unknown }> = [];

    let state = buildActiveConversationState({
      messages,
      currentMessage: "What is this controller showing, and what do b01 to b04 mean?",
      knownSites: sites,
      currentImageCapture: {
        extraction: { equipmentType: "other", manufacturer: "", model: "", ratedCurrent: "", ratedPower: "", confidence: "low" },
        warning: "No readable model label",
      },
    });
    messages.push({ role: "user", content: "What is this controller showing, and what do b01 to b04 mean?" });
    messages.push(assistant("It appears to be a solar charge controller, but its exact model and rating are unknown. The b01–b04 meanings cannot be confirmed without its manual. Is this the controller you mean?", state));

    state = buildActiveConversationState({ messages, currentMessage: "Yes. Can I use one of these 250 W panels with it?", knownSites: sites });
    messages.push({ role: "user", content: "Yes. Can I use one of these 250 W panels with it?" });
    messages.push(assistant("I found a NOARK device and the Studio battery in River Views. Is this for the Main House?", state));

    state = buildActiveConversationState({ messages, currentMessage: "No, just this setup. I told you earlier: the battery is 12 V, 100 Ah, AGM.", knownSites: sites });
    messages.push({ role: "user", content: "No, just this setup. I told you earlier: the battery is 12 V, 100 Ah, AGM." });
    messages.push(assistant("Which Site is this setup for?", state));

    state = buildActiveConversationState({ messages, currentMessage: "River Views", knownSites: sites });
    messages.push({ role: "user", content: "River Views" });
    messages.push(assistant("Would you like to record this setup as a new standalone system on River Views?", state));

    state = buildActiveConversationState({ messages, currentMessage: "Yes", knownSites: sites });
    expect(state.proposedAction).toMatchObject({
      type: "create-standalone-system",
      confirmed: true,
      siteName: "River Views",
      subject: "active-setup",
      parameters: { standalone: true },
    });
    expect(state.currentSite).toMatchObject({ id: "river-views", name: "River Views" });
    expect(state.currentSubject).toMatchObject({ kind: "setup", association: "unassociated" });
    expect(state.rejectedInterpretations.join(" ")).toMatch(/Main House/i);
    expect(state.rejectedInterpretations.join(" ")).toMatch(/Studio battery/i);
    expect(state.rejectedInterpretations.join(" ")).toMatch(/NOARK/i);

    messages.push({ role: "user", content: "Yes" });
    messages.push(assistant("Yes—I’ll keep the existing setup and Site. What name would you like for the system?", state));
    state = buildActiveConversationState({ messages, currentMessage: "Can you build me a schematic?", knownSites: sites });

    const panel = state.confirmedComponents.find((component) => component.kind === "panel");
    const battery = state.confirmedComponents.find((component) => component.kind === "battery");
    const controller = state.confirmedComponents.find((component) => component.kind === "controller");
    expect(panel?.specifications).toMatchObject({ ratedPowerW: 250 });
    expect(battery?.specifications).toMatchObject({ nominalVoltageV: 12, capacityAh: 100, chemistry: "AGM" });
    expect(controller?.label).toMatch(/attached image/i);
    expect(state.currentUserRequest).toBe("Provide a schematic for the active setup");
    expect(state.unknownInformation).toEqual(expect.arrayContaining(["controller exact model", "controller rating", "panel Voc", "panel Vmp", "panel Isc", "panel Imp"]));

    const policy = conversationRetrievalPolicy(state);
    expect(policy.retrievedRecordsMaySupplementButNeverReplaceActiveSubject).toBe(true);
    expect(policy.associateActiveSetupWithSavedEquipmentOnlyAfterExplicitUserConfirmation).toBe(true);

    const schematic = conceptualSchematicForActiveSetup(state)!;
    expect(schematic).toContain("250 W panel");
    expect(schematic).toContain("12 V 100 Ah AGM battery");
    expect(schematic).toContain("Site: River Views");
    expect(schematic).toContain("exact model/rating unknown");
    expect(schematic).toContain("panel Voc, Vmp, Isc and Imp are still unknown");
    expect(schematic).toContain("b01–b04 are model-specific");
    expect(schematic).not.toMatch(/Main House|Studio battery|NOARK/i);
  });

  it("does not ask for River Views again after the user answered the Site question", () => {
    const state = buildActiveConversationState({
      messages: [
        { role: "assistant", content: "Which Site is this setup for?" },
        { role: "user", content: "River Views" },
      ],
      currentMessage: "Can you continue?",
      knownSites: sites,
    });
    const guarded = removeRepeatedAnsweredQuestions("I have the setup. Which Site is this setup for?", state);
    expect(guarded).toBe("I have the setup.");
  });
});
