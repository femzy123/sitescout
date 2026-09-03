const URL_PATTERN = /\b[a-z][a-z\d+.-]*:\/\/[^\s"'<>]+/gi;
const SECRET_PATTERN =
  /\b(api[\s_-]?key|access[\s_-]?token|refresh[\s_-]?token|token|secret|authorization|password|passwd|pwd|key)\b\s*[:=]\s*(?:bearer\s+)?[^\s,;]+/gi;
const BEARER_PATTERN = /\bbearer\s+[^\s,;]+/gi;

export function redactDiagnosticText(input: string, maxLength = 500) {
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
    .slice(0, maxLength);
}
