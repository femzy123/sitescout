import type { AuditDiagnosticDetails, AuditProgress } from "@/lib/audit-events";
import { redactDiagnosticText } from "@/lib/diagnostic-redaction";

const MAX_MESSAGE_LENGTH = 500;
const MAX_CAUSE_DEPTH = 3;

function errorName(error: unknown) {
  return error instanceof Error && error.name.trim()
    ? redactDiagnosticText(error.name, MAX_MESSAGE_LENGTH)
    : "UnknownError";
}

function errorMessage(error: unknown) {
  if (error instanceof Error)
    return redactDiagnosticText(error.message, MAX_MESSAGE_LENGTH);
  return redactDiagnosticText(String(error), MAX_MESSAGE_LENGTH);
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
