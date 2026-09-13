export function mentionedExistingSite<T extends { name: string }>(message: string, sites: T[]) {
  const normalized = message.trim().toLocaleLowerCase();
  return sites.find((site) => {
    const name = site.name.trim().toLocaleLowerCase();
    return normalized === name || normalized.includes(`to ${name}`) || normalized.includes(`at ${name}`) || normalized.includes(`under ${name}`);
  });
}

export function confirmedBatterySystemVoltage(text: string) {
  const values = [...text.matchAll(/(?:battery|batteries|bank)[^\n.!?]{0,45}?\b(12|24|36|48)\s*v\b|\b(12|24|36|48)\s*v\b[^\n.!?]{0,45}?(?:battery|batteries|bank)/gi)]
    .map((match) => Number(match[1] ?? match[2]));
  return values.length && values.every((value) => value === values[0]) ? values[0] : undefined;
}
