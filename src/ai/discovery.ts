export type UtilityRelationship = "off_grid" | "grid_connected";

type ConversationLine = { role: string; content: string };

function userTranscript(recentConversation: ConversationLine[], currentMessage: string) {
  return [...recentConversation, { role: "user", content: currentMessage }]
    .filter((item) => item.role === "user")
    .map((item) => item.content)
    .join("\n");
}

export function confirmedUtilityRelationship(
  recentConversation: ConversationLine[],
  currentMessage: string,
): UtilityRelationship | null {
  const userText = userTranscript(recentConversation, currentMessage);
  if (/\b(off[- ]?grid|not connected to (?:the )?(?:grid|mains)|no (?:public |utility |electricity-company )?(?:grid|mains|electricity supply))\b/i.test(userText))
    return "off_grid";
  if (/\b(connected to (?:the )?(?:public )?(?:grid|mains|electricity supply)|keep (?:the )?(?:grid|mains)|stay connected to (?:the )?(?:grid|mains))\b/i.test(userText))
    return "grid_connected";

  const conversation = [...recentConversation, { role: "user", content: currentMessage }];
  const isUtilityQuestion = (content: string) =>
    /\b(?:connected|connection).{0,45}\b(?:grid|mains|public electricity|electricity supply)\b|\bsupply all of its power without the grid\b/i.test(content);
  const relationshipFromAnswer = (content: string): UtilityRelationship | null => {
    if (/\b(?:no|not connected|no power|no mains|without (?:the )?grid)\b/i.test(content)) return "off_grid";
    if (/\b(?:yes|correct|that'?s right|already connected|has power already|already has power|have (?:(?:grid|mains|public)\s+)?power|connected already|it'?s connected)\b/i.test(content)) return "grid_connected";
    return null;
  };
  for (let index = conversation.length - 1; index > 0; index -= 1) {
    const answer = conversation[index];
    const question = conversation[index - 1];
    if (answer.role === "user" && question.role === "assistant" && isUtilityQuestion(question.content)) {
      const relationship = relationshipFromAnswer(answer.content);
      if (relationship) return relationship;
    }
  }
  return null;
}

export function confirmedPrimaryOutcome(
  recentConversation: ConversationLine[],
  currentMessage: string,
) {
  const userText = userTranscript(recentConversation, currentMessage);
  const mentionsCost = /\b(?:lower|reduce|save|cut).{0,30}(?:bill|cost|electricity)|use more solar\b/i.test(userText);
  const mentionsBackup = /\b(?:backup|outage|blackout|keep (?:the )?(?:lights|power) on)\b/i.test(userText);
  if (/\b(?:both|combination)\b/i.test(userText) || (mentionsCost && mentionsBackup))
    return "Reduce electricity use/cost and improve resilience";
  if (mentionsBackup) return "Keep essential loads running during outages";
  if (mentionsCost) return "Reduce imported electricity and power costs";
  if (/\b(?:less dependent|greater independence|energy independence)\b/i.test(userText))
    return "Become less dependent on public electricity";
  return null;
}

export function workspaceProjectType(
  utilityRelationship: UtilityRelationship,
  primaryOutcome: string | null,
) {
  if (utilityRelationship === "off_grid") return "off-grid" as const;
  return primaryOutcome === "Reduce imported electricity and power costs"
    ? "grid-tied" as const
    : "hybrid" as const;
}

export function userExpressesUncertainty(message: string) {
  return /\b(?:i )?(?:do not|don'?t) (?:know|understand)\b|\bunsure\b|\bnot sure\b|\bno idea\b|\bwhat (?:does|do) (?:that|you) mean\b|\bconfus(?:ed|ing)\b|\bnone\s*\?/i.test(message);
}

export function userIsAskingDiscoveryQuestion(message: string) {
  return /\?\s*$/.test(message.trim())
    || /^\s*(?:what|why|how|where|when|which|who|can|could|do|does|is|are|should|would|will)\b/i.test(message);
}

export function discoveryGuidance(key: string) {
  const guidance: Record<string, string> = {
    current_energy_use: "Your electricity bill normally shows energy in kWh. A monthly or annual total gives us a reliable starting point for panel and battery sizing. You can type that number, attach a clear bill photo, or say you do not have a bill and we’ll build an appliance list instead.",
    backup_preference: "Outage backup means a battery powers chosen parts of the home when public electricity fails. Essentials-only usually covers things such as the fridge, a few lights, internet and perhaps a water pump; most-of-home backup is larger and more expensive. Which sounds closer: no backup, essentials only, or most of the home?",
    outage_essential_loads: "An essential load is simply something you do not want to lose during a blackout. Common examples are refrigeration, basic lighting, internet, a water or sewage pump, medical equipment and selected outlets. Which of those matter at your home?",
    backup_duration: "Backup duration is how long the battery should carry those items before the grid returns or solar recharges it. A few hours covers short cuts, overnight covers a longer outage, and one or more days needs substantially more storage. What duration would make sense for you?",
    cooking_energy: "Cooking can be a major electrical load, but LPG, gas or wood cooking may use little electricity. Tell me which methods are used: electric oven, electric or induction cooktop, LPG/gas, wood, or another method. More than one is fine.",
    water_heating_energy: "Water heating is often one of a home’s largest energy uses. Tell me whether it uses an electric cylinder, heat pump, instant electric heater, LPG/gas, solar hot water, a wood-fire wetback, or a combination.",
    space_heating_energy: "Winter heating can materially change the solar and battery design. Tell me whether the building uses heat pumps, direct electric heaters, wood, LPG/gas, a boiler, or no fixed heating. More than one is fine.",
    heavy_or_surge_loads: "Some appliances need a lot of power or a brief starting surge, which affects inverter size even if they do not run for long. Examples include ovens, electric water heating, heat pumps, pumps, welders, large tools and EV chargers. Which of those—if any—does the home use?",
    building_type: "Building type affects roof access, shared ownership and what mounting options are realistic. Examples are a detached house, townhouse, apartment/unit, shed, workshop or farm building. Which best describes this property?",
    property_authority: "This asks who can approve physical and electrical changes. An owner usually decides directly; a renter normally needs landlord approval; townhouses and apartments may also need body-corporate approval. Which situation applies?",
    proposed_panel_location: "Panels can go on the main roof, another roof such as a garage or shed, or on a ground-mounted frame. If you are unsure, say so and a roof/site photo can help us compare the options.",
    usable_solar_space: "Usable solar space means an area that is structurally suitable and not occupied by vents, chimneys, ridges or required clearances. Rough measurements, a roof plan or clear photos are enough for discovery; exact measurements can come later.",
    shading: "Shade from trees, nearby buildings or hills can reduce output, especially when it crosses panels for long periods. Tell me whether the proposed area is mostly open, partly shaded, or unknown; photos can be assessed later.",
    structure_condition: "The roof material, age and condition affect mounting and whether roofing work should happen before solar installation. If you do not know, a photo and approximate building age are useful, and structural suitability can remain unconfirmed pending inspection.",
    delivery_approach: "A DIY-led build means you do the work your skills and local law allow, while reserving regulated inspection, certification, connection or other restricted work for the appropriate licensed person. Would you prefer DIY-led, shared DIY and trades, or fully supplied and installed?",
  };
  return guidance[key] ?? "No problem—I won’t save that as an answer. I’ll explain the current discovery question another way.";
}

export function nextRequiredDiscoveryQuestion(
  settings: unknown,
  pendingActions: Array<{ name: string; arguments: unknown }> = [],
) {
  const root = settings && typeof settings === "object" ? settings as Record<string, unknown> : {};
  const discovery = root.designDiscovery && typeof root.designDiscovery === "object"
    ? root.designDiscovery as Record<string, unknown>
    : {};
  const recorded = new Set(Object.keys(discovery));
  for (const action of pendingActions) {
    if (action.name !== "record_design_discovery" || !action.arguments || typeof action.arguments !== "object") continue;
    const key = (action.arguments as Record<string, unknown>).key;
    if (typeof key === "string") recorded.add(key);
  }
  const valueOf = (key: string) => {
    const entry = discovery[key];
    return entry && typeof entry === "object" && "value" in entry
      ? String((entry as Record<string, unknown>).value ?? "")
      : "";
  };
  const utility = valueOf("utility_relationship");
  const outcome = valueOf("primary_outcome");
  const needsBackup = /no public|outage|resilience|independent/i.test(`${utility} ${outcome}`);
  const backupPreference = valueOf("backup_preference");
  const wantsNoBackup = /\b(?:no|none|do not want|don'?t want)\b/i.test(backupPreference);
  const wantsWholeHomeBackup = /\b(?:whole|entire|all)\b/i.test(backupPreference);
  const steps = [
    ["current_energy_use", "What is the home’s current energy use? A recent bill or monitoring total is best; otherwise we can build it from appliances one at a time."],
    ...(needsBackup ? [
      ["backup_preference", "Because you chose outage backup, a battery could keep either a few essentials running—such as the fridge, lights and internet—or supply most of the home, which costs more. Would you want no outage backup, essentials only, or most of the home?"],
      ...(!wantsNoBackup && !wantsWholeHomeBackup ? [["outage_essential_loads", "Which essentials should stay on in a blackout? Common examples are the fridge/freezer, a few lights, internet, water pump or medical equipment."]] : []),
      ...(!wantsNoBackup ? [["backup_duration", "Roughly how long should the chosen backup loads run without public electricity—a few hours, overnight, or longer?"]] : []),
    ] : []),
    ["cooking_energy", "How is cooking done at this property—electric oven or cooktop, induction, LPG/gas, wood, or a combination?"],
    ["water_heating_energy", "How is water heated—an electric cylinder, heat pump, instant electric, LPG/gas, solar hot water, wood wetback, or a combination?"],
    ["space_heating_energy", "How is the home or building heated—heat pump, direct electric heating, wood, LPG/gas, a boiler, or another method?"],
    ["heavy_or_surge_loads", "What are the largest appliances or tools that may run at the same time, such as an oven, water heater, pump, welder or EV charger?"],
    ["building_type", "What kind of building is this—for example a detached house, townhouse, apartment, shed or farm building?"],
    ["property_authority", "Do you own the property, rent it, or need approval from a landlord, body corporate or another owner?"],
    ["proposed_panel_location", "Where might panels fit: the main roof, another roof, a ground-mounted area, or are you unsure?"],
    ["usable_solar_space", "Roughly how much usable space is available there? Measurements, a plan or a clear photo can help."],
    ["shading", "Does that area get significant shade from trees, buildings or hills during the day?"],
    ["structure_condition", "What condition is the roof or supporting structure in, and do you know its material and approximate age?"],
    ["expected_expansion", "What might be added later, such as an EV, workshop equipment, another dwelling, electric water heating, more panels or more battery storage?"],
    ["delivery_approach", "Should I plan this as DIY-led, shared between you and selected trades, or fully supplied and installed? I’ll separate tasks according to your skills and the rules at the site location."],
  ] as const;
  return steps.find(([key]) => !recorded.has(key)) ?? null;
}
