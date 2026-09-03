import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const example = readFileSync(resolve(process.cwd(), ".env.example"), "utf8");
const schema = readFileSync(resolve(process.cwd(), "src/lib/env.ts"), "utf8");

describe("environment contract", () => {
  it("does not expose retired global-owner or unused settings", () => {
    for (const variable of [
      "CLERK_OWNER_USER_ID",
      "INITIAL_ORGANIZATION_NAME",
      "INITIAL_ORGANIZATION_SLUG",
      "APP_TIMEZONE",
      "APP_URL",
      "AI_PROVIDER",
      "AUDIT_MAX_PAGES",
      "AUDIT_BATCH_LIMIT",
      "LOG_LEVEL",
      "CLERK_E2E_USER_EMAIL",
      "CLERK_E2E_USER_PASSWORD",
    ]) {
      expect(example).not.toContain(variable);
      expect(schema).not.toContain(variable);
    }
  });

  it("documents public Clerk signup and optional database tooling", () => {
    expect(example).toContain("NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up");
    expect(example).toContain(
      "NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/dashboard",
    );
    expect(example).toContain("DATABASE_URL_UNPOOLED=");
  });

  it("documents the temporary audit diagnostics switch", () => {
    expect(example).toContain("AUDIT_DEBUG=false");
    expect(schema).toContain("AUDIT_DEBUG");
  });
});
