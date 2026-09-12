export function conversationKind(title: string | null | undefined) {
  const value = (title ?? "").trim();
  if (/^(?:Discovery\b|Guided system discovery$)/i.test(value)) return "discovery" as const;
  if (/^(?:Build It|Configure|Schematic)\b/i.test(value)) return "component" as const;
  return "dashboard" as const;
}

export function confirmedDestinationNames(message: string) {
  const parts = message.split(/[,;]+/).map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 2 && /^(?:yes|yes please|sure|ok|okay|please|do it)$/i.test(parts[0])) parts.shift();
  return parts.length === 2 ? { siteName: parts[0], systemName: parts[1] } : null;
}
