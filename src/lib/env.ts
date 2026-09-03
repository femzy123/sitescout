import { z } from "zod";

const serverSchema = z.object({
  DATABASE_URL: z.string().url(),
  GOOGLE_PLACES_API_KEY: z.string().min(1).optional(),
  GEMINI_API_KEY: z.string().min(1).optional(),
  AI_MODEL: z.string().min(1).default("gemini-3.7-flash"),
  AUDIT_DEBUG: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
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

export function parseServerEnv(
  environment: Record<string, string | undefined>,
) {
  const result = serverSchema.safeParse(environment);

  if (!result.success) {
    const message = result.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join(", ");
    throw new Error(`Invalid server configuration: ${message}`);
  }

  return result.data;
}

export function getServerEnv() {
  return parseServerEnv(process.env);
}

export type EnvironmentDiagnosticStatus =
  | "Configured"
  | "Using default"
  | "Missing"
  | "Invalid"
  | "Unexpected in production";

export type EnvironmentDiagnostic = {
  key: string;
  description: string;
  status: EnvironmentDiagnosticStatus;
};

export type EnvironmentDiagnosticGroup = {
  label: string;
  items: EnvironmentDiagnostic[];
};

function hasValue(value: string | undefined) {
  return Boolean(value?.trim());
}

function requiredString(
  key: string,
  description: string,
  environment: Record<string, string | undefined>,
): EnvironmentDiagnostic {
  return {
    key,
    description,
    status: hasValue(environment[key]) ? "Configured" : "Missing",
  };
}

function requiredUrl(
  key: string,
  description: string,
  environment: Record<string, string | undefined>,
): EnvironmentDiagnostic {
  const value = environment[key]?.trim();
  if (!value) return { key, description, status: "Missing" };
  try {
    new URL(value);
    return { key, description, status: "Configured" };
  } catch {
    return { key, description, status: "Invalid" };
  }
}

function defaultedString(
  key: string,
  description: string,
  environment: Record<string, string | undefined>,
): EnvironmentDiagnostic {
  const value = environment[key];
  return {
    key,
    description,
    status:
      value === undefined
        ? "Using default"
        : hasValue(value)
          ? "Configured"
          : "Invalid",
  };
}

function defaultedInteger(
  key: string,
  description: string,
  environment: Record<string, string | undefined>,
  minimum: number,
  maximum: number,
): EnvironmentDiagnostic {
  const raw = environment[key];
  if (raw === undefined) return { key, description, status: "Using default" };
  const value = Number(raw);
  return {
    key,
    description,
    status:
      Number.isInteger(value) && value >= minimum && value <= maximum
        ? "Configured"
        : "Invalid",
  };
}

export function getEnvironmentDiagnostics(
  environment: Record<string, string | undefined> = process.env,
  nodeEnvironment = environment.NODE_ENV,
): EnvironmentDiagnosticGroup[] {
  const debug = environment.AUDIT_DEBUG;
  const chromePath = environment.CHROME_EXECUTABLE_PATH;

  return [
    {
      label: "Core",
      items: [
        requiredUrl(
          "DATABASE_URL",
          "Runtime connection to Neon PostgreSQL.",
          environment,
        ),
        requiredString(
          "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
          "Public Clerk application key.",
          environment,
        ),
        requiredString(
          "CLERK_SECRET_KEY",
          "Server-side Clerk authentication key.",
          environment,
        ),
      ],
    },
    {
      label: "Providers",
      items: [
        requiredString(
          "GOOGLE_PLACES_API_KEY",
          "Google Places discovery requests.",
          environment,
        ),
        requiredString(
          "GEMINI_API_KEY",
          "AI opportunity assessment and outreach generation.",
          environment,
        ),
      ],
    },
    {
      label: "Audit runtime",
      items: [
        requiredUrl(
          "CHROMIUM_PACK_URL",
          "Chromium pack used by the production browser audit.",
          environment,
        ),
        defaultedString(
          "AI_MODEL",
          "Gemini model used for structured assessment.",
          environment,
        ),
        defaultedInteger(
          "AUDIT_TIMEOUT_MS",
          "Overall stale-audit threshold (30,000–240,000 ms).",
          environment,
          30_000,
          240_000,
        ),
        defaultedInteger(
          "AUDIT_PAGE_TIMEOUT_MS",
          "Website navigation limit (5,000–60,000 ms).",
          environment,
          5_000,
          60_000,
        ),
        defaultedInteger(
          "AUDIT_LIGHTHOUSE_TIMEOUT_MS",
          "Lighthouse limit (10,000–90,000 ms).",
          environment,
          10_000,
          90_000,
        ),
        defaultedInteger(
          "AUDIT_AI_TIMEOUT_MS",
          "Gemini assessment limit (5,000–60,000 ms).",
          environment,
          5_000,
          60_000,
        ),
        {
          key: "AUDIT_DEBUG",
          description: "Temporary redacted browser diagnostics.",
          status:
            debug === undefined
              ? "Using default"
              : debug === "true" || debug === "false"
                ? "Configured"
                : "Invalid",
        },
      ],
    },
    {
      label: "Local override",
      items: [
        {
          key: "CHROME_EXECUTABLE_PATH",
          description: "Optional local Chrome path; leave unset in production.",
          status: !hasValue(chromePath)
            ? "Using default"
            : nodeEnvironment === "production"
              ? "Unexpected in production"
              : "Configured",
        },
      ],
    },
  ];
}
