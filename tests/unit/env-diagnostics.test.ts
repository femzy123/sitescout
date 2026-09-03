import { describe, expect, it } from "vitest";

import { getEnvironmentDiagnostics, parseServerEnv } from "@/lib/env";

function item(
  groups: ReturnType<typeof getEnvironmentDiagnostics>,
  key: string,
) {
  const match = groups
    .flatMap((group) => group.items)
    .find((row) => row.key === key);
  if (!match) throw new Error(`Missing diagnostic for ${key}`);
  return match;
}

describe("environment diagnostics", () => {
  it("classifies configured, defaulted, missing, invalid, and unexpected values", () => {
    const diagnostics = getEnvironmentDiagnostics(
      {
        DATABASE_URL: "postgresql://user:secret@db.example.com/sitescout",
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_live_secret-value",
        CLERK_SECRET_KEY: "sk_live_secret-value",
        GEMINI_API_KEY: "gemini-secret-value",
        CHROMIUM_PACK_URL: "not-a-url",
        AUDIT_TIMEOUT_MS: "1000",
        CHROME_EXECUTABLE_PATH: "C:\\Program Files\\Chrome\\chrome.exe",
      },
      "production",
    );

    expect(item(diagnostics, "DATABASE_URL").status).toBe("Configured");
    expect(item(diagnostics, "GOOGLE_PLACES_API_KEY").status).toBe("Missing");
    expect(item(diagnostics, "AI_MODEL").status).toBe("Using default");
    expect(item(diagnostics, "CHROMIUM_PACK_URL").status).toBe("Invalid");
    expect(item(diagnostics, "AUDIT_TIMEOUT_MS").status).toBe("Invalid");
    expect(item(diagnostics, "CHROME_EXECUTABLE_PATH").status).toBe(
      "Unexpected in production",
    );
  });

  it("never returns configured environment values", () => {
    const diagnostics = getEnvironmentDiagnostics(
      {
        DATABASE_URL: "postgresql://user:database-password@db.example.com/app",
        GEMINI_API_KEY: "gemini-secret-value",
        CHROMIUM_PACK_URL:
          "https://downloads.example.com/chromium.tar?signature=signed-secret",
      },
      "production",
    );
    const serialized = JSON.stringify(diagnostics);

    expect(serialized).not.toContain("database-password");
    expect(serialized).not.toContain("gemini-secret-value");
    expect(serialized).not.toContain("signed-secret");
  });
});

describe("AUDIT_DEBUG configuration", () => {
  it("defaults to disabled and accepts explicit booleans", () => {
    expect(
      parseServerEnv({ DATABASE_URL: "postgresql://localhost/sitescout" })
        .AUDIT_DEBUG,
    ).toBe(false);
    expect(
      parseServerEnv({
        DATABASE_URL: "postgresql://localhost/sitescout",
        AUDIT_DEBUG: "true",
      }).AUDIT_DEBUG,
    ).toBe(true);
    expect(
      parseServerEnv({
        DATABASE_URL: "postgresql://localhost/sitescout",
        AUDIT_DEBUG: "false",
      }).AUDIT_DEBUG,
    ).toBe(false);
  });

  it("rejects ambiguous debug values", () => {
    expect(() =>
      parseServerEnv({
        DATABASE_URL: "postgresql://localhost/sitescout",
        AUDIT_DEBUG: "yes",
      }),
    ).toThrow(/AUDIT_DEBUG/);
  });
});
