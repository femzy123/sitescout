import type { AuditDiagnosticDetails, AuditProgress } from "@/lib/audit-events";

const MAX_MESSAGE_LENGTH = 500;
const MAX_CAUSE_DEPTH = 3;
const URL_PATTERN = /\b[a-z][a-z\d+.-]*:\/\/[^\s"'<>]+/gi;
const SECRET_PATTERN =
  /\b(api[\s_-]?key|access[\s_-]?token|refresh[\s_-]?token|token|secret|authorization|password|passwd|pwd|key)\b\s*[:=]\s*(?:bearer\s+)?[^\s,;]+/gi;
const BEARER_PATTERN = /\bbearer\s+[^\s,;]+/gi;

function sanitizeText(input: string) {
  const withoutSensitiveUrls = input.replace(URL_PATTERN, (value) => {
    try {
      const url = new URL(value);
      url.username = "";
      url.password = "";
      url.search = "";
      url.hash = "";
      return url.toString();
    } catch {
      return "[REDACTED URL]";
    }
  });
  return withoutSensitiveUrls
    .replace(SECRET_PATTERN, "$1=[REDACTED]")
    .replace(BEARER_PATTERN, "Bearer [REDACTED]")
    .slice(0, MAX_MESSAGE_LENGTH);
}

function errorName(error: unknown) {
  return error instanceof Error && error.name.trim()
    ? sanitizeText(error.name)
    : "UnknownError";
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return sanitizeText(error.message);
  return sanitizeText(String(error));
}

export function formatAuditDiagnostic(error: unknown): AuditDiagnosticDetails {
  const causes: string[] = [];
  const seen = new Set<unknown>();
  let cause = error instanceof Error ? error.cause : undefined;

  while (cause !== undefined && causes.length < MAX_CAUSE_DEPTH) {
    if (seen.has(cause)) break;
    seen.add(cause);
    causes.push(errorMessage(cause));
    cause = cause instanceof Error ? cause.cause : undefined;
  }

  return {
    name: errorName(error),
    message: errorMessage(error),
    causes,
  };
}

export function isAuditDebugEnabled(
  environment: Record<string, string | undefined> = process.env,
) {
  return environment.AUDIT_DEBUG === "true";
}

export async function reportAuditDiagnostic({
  enabled,
  emit,
  error,
  stage,
  progress,
  leadId,
  auditId,
}: {
  enabled: boolean;
  emit: (event: AuditProgress) => Promise<void>;
  error: unknown;
  stage: string;
  progress: number;
  leadId: string;
  auditId?: string;
}) {
  console.error(`[SiteScout audit:${stage}]`, error);
  if (!enabled) return;

  try {
    await emit({
      type: "diagnostic",
      progress,
      stage,
      message: `Diagnostic captured for ${stage}`,
      leadId,
      auditId,
      details: formatAuditDiagnostic(error),
    });
  } catch (emitError) {
    console.error("[SiteScout audit:diagnostic_emit]", emitError);
  }
}
