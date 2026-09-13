import { z } from "zod";

export const installedSystemInputSchema = z.object({
  idempotencyKey: z.uuid(),
  siteId: z.string().min(1),
  siteName: z.preprocess(
    (value) => value === null || value === "" ? undefined : value,
    z.string().trim().max(120).optional(),
  ),
  systemName: z.string().trim().min(1).max(120),
  projectType: z.enum(["off-grid", "hybrid", "grid-tied"]),
  systemVoltage: z.number().int().positive().max(1000).optional(),
}).refine(
  (value) => value.siteId !== "__new__" || Boolean(value.siteName),
  { message: "Enter a name for the Site.", path: ["siteName"] },
);
