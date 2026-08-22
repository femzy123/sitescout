import { z } from "zod";

const serverSchema = z.object({
  DATABASE_URL: z.string().url(),
  GOOGLE_PLACES_API_KEY: z.string().min(1).optional(),
  GEMINI_API_KEY: z.string().min(1).optional(),
  AI_MODEL: z.string().min(1).default("gemini-3.7-flash"),
  AUDIT_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(30_000)
    .max(240_000)
    .default(180_000),
  AUDIT_PAGE_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(5_000)
    .max(60_000)
    .default(30_000),
  AUDIT_LIGHTHOUSE_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(10_000)
    .max(90_000)
    .default(60_000),
  AUDIT_AI_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(5_000)
    .max(60_000)
    .default(45_000),
  CHROMIUM_PACK_URL: z.string().url().optional(),
  CHROME_EXECUTABLE_PATH: z.string().min(1).optional(),
});

export function getServerEnv() {
  const result = serverSchema.safeParse(process.env);

  if (!result.success) {
    const message = result.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join(", ");
    throw new Error(`Invalid server configuration: ${message}`);
  }

  return result.data;
}
