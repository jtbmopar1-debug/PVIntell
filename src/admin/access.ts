export const ADMIN_EMAILS = ["jtbmopar1@gmail.com", "local.dev26@gmail.com"] as const;

export function isAdminEmail(email: string | null | undefined) {
  const normalized = email?.trim().toLowerCase();
  return Boolean(normalized && ADMIN_EMAILS.includes(normalized as (typeof ADMIN_EMAILS)[number]));
}

