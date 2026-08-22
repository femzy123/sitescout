import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("permanent deletion contract", () => {
  it("scopes discovery-result deletion to the active organization", () => {
    const route = source("src/app/api/discovery/results/route.ts");

    expect(route).toContain("requireOwnerContext()");
    expect(route).toContain(
      "eq(discoveryResults.organizationId, context.organizationId)",
    );
    expect(route).toContain("inArray(discoveryResults.id");
    expect(route).not.toContain("delete(businesses)");
    expect(route).not.toContain("delete(leads)");
  });

  it("guards running audits and restores discovery candidacy before lead deletion", () => {
    const route = source("src/app/api/leads/route.ts");

    expect(route).toContain("eq(leads.organizationId, context.organizationId)");
    expect(route).toContain('eq(websiteAudits.status, "running")');
    expect(route).toContain("{ status: 409 }");
    expect(route).toContain('.set({ state: "new" })');
    expect(route).toContain("db.batch");
  });

  it("relies on database cascades for every lead-owned record", () => {
    const schema = source("src/server/db/schema.ts");

    for (const foreignKey of [
      "website_audits_lead_org_fk",
      "lead_scores_lead_org_fk",
      "outreach_lead_org_fk",
      "notes_lead_org_fk",
      "follow_ups_lead_org_fk",
      "ai_generations_lead_org_fk",
      "lead_events_lead_org_fk",
    ]) {
      const start = schema.indexOf(foreignKey);
      expect(start).toBeGreaterThan(-1);
      expect(schema.slice(start, start + 280)).toContain(
        '.onDelete("cascade")',
      );
    }
  });
});
