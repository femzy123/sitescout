import { describe, expect, it } from "vitest";

import { readAuditStartFailure } from "@/lib/audit-start-failure";

describe("audit start failure diagnostics", () => {
  it("captures an empty Vercel 500 response without throwing while parsing", async () => {
    const response = new Response(null, {
      status: 500,
      statusText: "Internal Server Error",
      headers: {
        "x-vercel-id": "iad1::request-id",
        "x-matched-path": "/api/audits/stream",
      },
    });

    const failure = await readAuditStartFailure(response);

    expect(failure).toEqual({
      message: "Audit could not start",
      diagnostic: {
        status: 500,
        statusText: "Internal Server Error",
        contentType: null,
        contentLength: null,
        requestId: "iad1::request-id",
        platformError: null,
        matchedPath: "/api/audits/stream",
        response: "<empty response body>",
      },
    });
  });

  it("uses redacted JSON details returned by the audit endpoint", async () => {
    const response = Response.json(
      {
        error: "Could not start analysis",
        details: {
          name: "Error",
          message: "Connection failed at https://example.com/",
          causes: [],
        },
      },
      { status: 500 },
    );

    const failure = await readAuditStartFailure(response);

    expect(failure.message).toBe("Could not start analysis");
    expect(failure.diagnostic.response).toEqual({
      error: "Could not start analysis",
      details: {
        name: "Error",
        message: "Connection failed at https://example.com/",
        causes: [],
      },
    });
  });

  it("sanitizes and truncates non-JSON response previews", async () => {
    const response = new Response(
      `Failure at https://user:pass@example.com/path?token=signed password=secret ${"x".repeat(2500)}`,
      {
        status: 500,
        headers: { "content-type": "text/plain" },
      },
    );

    const failure = await readAuditStartFailure(response);
    const preview = failure.diagnostic.response as string;

    expect(preview.length).toBeLessThanOrEqual(2000);
    expect(preview).not.toMatch(/user:pass|signed|password=secret/);
    expect(preview).toContain("https://example.com/path");
  });
});
