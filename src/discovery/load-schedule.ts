export function timerRuntimeMinutes(start?: string, end?: string) {
  if (!start || !end) return undefined;
  const [startHour, startMinute] = start.split(":").map(Number);
  const [endHour, endMinute] = end.split(":").map(Number);
  if (![startHour, startMinute, endHour, endMinute].every(Number.isFinite)) return undefined;
  const startTotal = startHour * 60 + startMinute;
  const endTotal = endHour * 60 + endMinute;
  const duration = (endTotal - startTotal + 24 * 60) % (24 * 60);
  return duration || undefined;
}
