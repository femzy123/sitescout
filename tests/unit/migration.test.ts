import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "drizzle/0000_sitescout_initial.sql"),
  "utf8",
);
const workspaceMigration = readFileSync(
  resolve(process.cwd(), "drizzle/0001_per_user_workspaces.sql"),
  "utf8",
);

describe("initial Neon migration", () => {
  it("guards enums, tables, constraints, and indexes for replay", () => {
    expect(migration).not.toMatch(/^CREATE TYPE/m);
    expect(migration).not.toMatch(/^CREATE TABLE\s+"/m);
    expect(migration).not.toMatch(/^ALTER TABLE/m);
    expect(migration).not.toMatch(/^CREATE (?:UNIQUE )?INDEX\s+"/m);
    expect(migration.match(/CREATE TABLE IF NOT EXISTS/g)).toHaveLength(14);
    expect(
      migration.match(/EXCEPTION WHEN duplicate_object/g)?.length,
    ).toBeGreaterThan(30);
  });

  it("contains no background-job table", () => {
    expect(migration).not.toContain("background_jobs");
  });

  it("creates composite referenced indexes before their foreign keys", () => {
    expect(migration.indexOf('"discovery_searches_org_id_uidx"')).toBeLessThan(
      migration.indexOf('"discovery_results_search_org_fk"'),
    );
    expect(migration.indexOf('"leads_org_id_uidx"')).toBeLessThan(
      migration.indexOf('"website_audits_lead_org_fk"'),
    );
  });

  it("enforces one user per organization and one organization per user", () => {
    expect(workspaceMigration).toContain(
      'CREATE UNIQUE INDEX IF NOT EXISTS "organization_members_organization_uidx"',
    );
    expect(workspaceMigration).toContain(
      'CREATE UNIQUE INDEX IF NOT EXISTS "organization_members_user_uidx"',
    );
    expect(workspaceMigration).toContain(
      'ALTER TABLE IF EXISTS "organizations" ALTER COLUMN "timezone" SET DEFAULT \'UTC\'',
    );
  });
});
