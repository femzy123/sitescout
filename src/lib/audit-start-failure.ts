import { redactDiagnosticText } from "@/lib/diagnostic-redaction";

const MAX_RESPONSE_PREVIEW_LENGTH = 2_000;
const SENSITIVE_FIELD = /token|key|secret|authorization|password|passwd|pwd/i;

type AuditStartFailureDiagnostic = {
  status: number;
  statusText: string;
  contentType: string | null;
  contentLength: string | null;
  requestId: string | null;
  platformError: string | null;
  matchedPath: string | null;
  response: unknown;
};

export type AuditStartFailure = {
  message: string;
  diagnostic: AuditStartFailureDiagnostic;
};

function sanitizeJson(value: unknown, depth = 0): unknown {
  if (depth > 5) return "[TRUNCATED]";
  if (typeof value === "string")
    return redactDiagnosticText(value, MAX_RESPONSE_PREVIEW_LENGTH);
  if (value === null || typeof value === "number" || typeof value === "boolean")
    return value;
  if (Array.isArray(value))
    return value.slice(0, 20).map((item) => sanitizeJson(item, depth + 1));
  if (typeof value !== "object") return String(value);

  return Object.fromEntries(
    Object.entries(value)
      .slice(0, 20)
      .map(([key, item]) => [
        key,
        SENSITIVE_FIELD.test(key)
          ? "[REDACTED]"
          : sanitizeJson(item, depth + 1),
      ]),
  );
}

function messageFromJson(value: unknown) {
  if (!value || typeof value !== "object" || !("error" in value)) return null;
  const error = value.error;
  return typeof error === "string" ? redactDiagnosticText(error, 500) : null;
}

export async function readAuditStartFailure(
  response: Response,
): Promise<AuditStartFailure> {
  const rawBody = await response.text();
  let parsed: unknown;
  let responsePreview: unknown = "<empty response body>";

  if (rawBody) {
    try {
      parsed = JSON.parse(rawBody);
      responsePreview = sanitizeJson(parsed);
    } catch {
      responsePreview = redactDiagnosticText(
        rawBody,
        MAX_RESPONSE_PREVIEW_LENGTH,
      );
    }
  }

  return {
    message: messageFromJson(parsed) ?? "Audit could not start",
    diagnostic: {
      status: response.status,
      statusText: response.statusText,
      contentType: response.headers.get("content-type"),
      contentLength: response.headers.get("content-length"),
      requestId: response.headers.get("x-vercel-id"),
      platformError: response.headers.get("x-vercel-error"),
      matchedPath: response.headers.get("x-matched-path"),
      response: responsePreview,
    },
  };
}
