import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("temporary audit diagnostics contract", () => {
  it("reports browser, Lighthouse, AI, and fatal audit stages", () => {
    const browserAudit = source("src/server/services/audit/browser-audit.ts");
    const runAudit = source("src/server/services/audit/run-audit.ts");
    const route = source("src/app/api/audits/stream/route.ts");

    expect(browserAudit).toContain('"chromium_setup"');
    expect(browserAudit).toContain('"page_load"');
    expect(browserAudit).toContain('"lighthouse"');
    expect(runAudit).toContain('"ai_assessment"');
    expect(route).toContain('"audit_fatal"');
    expect(route).toContain("formatAuditDiagnostic(error)");
    expect(route).toMatch(/const \{ runLeadAudit \} =\s+await import\(/);
    expect(route).toContain('"@/server/services/audit/run-audit"');
    expect(runAudit).toContain('await import("./browser-audit")');
    expect(runAudit).toContain('diagnostic("chromium_setup", error, 10)');
  });

  it("logs diagnostic stream events in single and bulk analysis clients", () => {
    for (const path of [
      "src/features/leads/single-audit-button.tsx",
      "src/features/leads/leads-table.tsx",
    ]) {
      const client = source(path);
      expect(client).toContain('event.type === "diagnostic"');
      expect(client).toContain('console.error("[SiteScout audit diagnostic]"');
    }
  });

  it("keeps settings hidden while rendering environment diagnostics", () => {
    const settings = source("src/app/(app)/settings/page.tsx");
    const shell = source("src/components/app-shell.tsx");

    expect(settings).toContain("getEnvironmentDiagnostics");
    expect(settings).toContain("diagnosticGroups");
    expect(shell).not.toContain('href="/settings"');
  });
});
