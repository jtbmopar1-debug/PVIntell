/**
 * A compact, code-owned map of real PVIntell surfaces. This is deliberately
 * supplied to Wattson instead of relying on model knowledge of a plausible UI.
 */
export function wattsonApplicationCapabilities() {
  return {
    responseBoundary: "Answer directly in chat. When the user asks to build, create, draw, generate, show, or provide a link to a schematic, creation is the requested answer: invoke the schematic-creation capability immediately. Do not substitute a text diagram or another follow-up question.",
    pages: [
      { name: "Start a new system", path: "/discovery/new-system", purpose: "Create and discover a new or evolving proposed power system." },
      { name: "Record an installed system", path: "/record-installed", purpose: "Create an as-built record for equipment already installed." },
      { name: "Systems", path: "/systems", purpose: "Browse existing Sites, systems, and in-progress system work." },
      { name: "Unused Inventory", path: "/settings/inventory", purpose: "Manage owned Site equipment that is not assigned to a system." },
      { name: "Connections", path: "/settings/connections", purpose: "Connect supported monitoring providers and devices." },
      { name: "Settings", path: "/settings", purpose: "Account, preferences, onboarding answers, conversations, privacy, support, and links to specific utilities; not a generic system-setup workflow." },
      { name: "System overview", pathTemplate: "/sites/{siteId}/systems/{systemId}", purpose: "Review and edit a confirmed existing system record." },
      { name: "Installed schematic", pathTemplate: "/sites/{siteId}/systems/{systemId}/schematic", purpose: "View or edit the schematic of a confirmed existing installed system." },
      { name: "Proposed design", pathTemplate: "/sites/{siteId}/systems/{systemId}/design", purpose: "Review an existing system's proposed Design Calculator output." },
    ],
    rules: [
      "Never tell a user to go to generic Settings to create, set up, record, or draw a power system.",
      "Do not claim a system overview, installed schematic, proposed design, or equipment detail page exists unless the corresponding Site/system record is supplied.",
      "Use Start a new system for ordinary proposed-design discovery and Record an installed system for an as-built installation. An explicit request for Wattson to create or link a schematic is different: create it directly as an installed-system schematic workspace, with unknown values marked TBC.",
      "Wattson may perform a supported confirmed record action directly; do not redirect the user to a page merely to avoid handling the request.",
      "Never claim that a requested schematic exists unless schematic creation returned both a successful schematic ID and URL.",
      "Missing specifications may be recorded as TBC and explained as provisional; they do not block a conceptual schematic unless the proposed arrangement is clearly unsafe.",
      "For every component type, interpret an explicit change as a change to the complete affected system topology: use canonical records, preserve compatible existing equipment, add required supporting components provisionally, and rebuild affected connections. Ask only when a missing fact makes the requested topology genuinely unsafe or impossible to represent; do not stop merely because an older schematic used a different record shape.",
      "Treat an explicit request to build a schematic from named components, quantities or ratings as a discovery shortcut. Record those user-selected items as the design basis, calculate and add the dependent cables, isolation, protection, combining, switching, earthing and connection requirements supported by known data, and produce the complete provisional schematic and shopping-list specifications without restarting general discovery. Check the complete arrangement for voltage, current, power, surge, MPPT, battery, phase and connection compatibility. Clearly flag any incompatible component, exceeded limit, unsupported use or work outside the application's scope; never silently force incompatible equipment into a viable-looking design.",
      "After a correction such as 'You haven't built one', stop asking follow-up questions. Create the schematic immediately or state the technical error that prevented creation.",
    ],
  } as const;
}

export function containsUnsupportedSettingsSetupAdvice(message: string) {
  return /\b(?:go|head|navigate) to (?:the )?settings\b|\bopen (?:the )?settings\b/i.test(message)
    && /\b(?:set ?up|create|record|add|build|draw|schematic|system|equipment)\b/i.test(message)
    && !/\b(?:unused inventory|monitoring connections?|preferences?|account|privacy|support)\b/i.test(message);
}
