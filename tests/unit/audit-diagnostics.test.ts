import { afterEach, describe, expect, it, vi } from "vitest";

import {
  formatAuditDiagnostic,
  isAuditDebugEnabled,
  reportAuditDiagnostic,
} from "@/server/services/audit/diagnostics";

describe("audit diagnostics", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("redacts secrets and URL credentials while preserving a bounded cause chain", () => {
    const nested = new Error(
      "API key=abc123 password: letmein authorization=Bearer private-token key=standalone-secret pwd=short-secret postgresql://dbuser:dbpass@db.example.com/app?sslmode=require",
    );
    const error = new Error(
      "Download failed at https://alice:hunter2@example.com/chromium.tar?token=signed-secret#fragment",
      { cause: nested },
    );
    const details = formatAuditDiagnostic(error);

    expect(details.name).toBe("Error");
    expect(details.message).toContain("https://example.com/chromium.tar");
    expect(details.message).not.toMatch(
      /alice|hunter2|signed-secret|fragment/i,
    );
    expect(details.causes).toHaveLength(1);
    expect(details.causes[0]).not.toMatch(
      /abc123|letmein|private-token|standalone-secret|short-secret|dbuser|dbpass|sslmode/i,
    );
  });

  it("limits message length and cause depth", () => {
    const fourth = new Error("fourth");
    const third = new Error("third", { cause: fourth });
    const second = new Error("second", { cause: third });
    const first = new Error("x".repeat(700), { cause: second });
    const details = formatAuditDiagnostic(first);

    expect(details.message.length).toBeLessThanOrEqual(500);
    expect(details.causes).toEqual(["second", "third", "fourth"]);
  });

  it("logs original errors but emits browser details only when enabled", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const emit = vi.fn().mockResolvedValue(undefined);
    const error = new Error("Chrome executable was not found");

    await reportAuditDiagnostic({
      enabled: false,
      emit,
      error,
      stage: "chromium_setup",
      progress: 10,
      leadId: "lead-1",
    });
    expect(consoleError).toHaveBeenCalledWith(
      "[SiteScout audit:chromium_setup]",
      error,
    );
    expect(emit).not.toHaveBeenCalled();

    await reportAuditDiagnostic({
      enabled: true,
      emit,
      error,
      stage: "chromium_setup",
      progress: 10,
      leadId: "lead-1",
      auditId: "audit-1",
    });
    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "diagnostic",
        stage: "chromium_setup",
        leadId: "lead-1",
        auditId: "audit-1",
        details: expect.objectContaining({
          message: "Chrome executable was not found",
        }),
      }),
    );
  });

  it("enables browser diagnostics only for the literal true value", () => {
    expect(isAuditDebugEnabled({ AUDIT_DEBUG: "true" })).toBe(true);
    expect(isAuditDebugEnabled({ AUDIT_DEBUG: "false" })).toBe(false);
    expect(isAuditDebugEnabled({ AUDIT_DEBUG: "yes" })).toBe(false);
    expect(isAuditDebugEnabled({})).toBe(false);
  });
});
