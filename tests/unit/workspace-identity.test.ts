import { describe, expect, it } from "vitest";

import { workspaceName, workspaceSlug } from "@/server/auth/workspace-identity";

describe("per-user workspace identity", () => {
  it("derives a friendly agency name from the Clerk profile", () => {
    expect(workspaceName("Ada Lovelace", "ada@example.com")).toBe(
      "Ada Lovelace's Agency",
    );
  });

  it("falls back to the email label and finally a generic name", () => {
    expect(workspaceName(null, "femzy@example.com")).toBe("femzy's Agency");
    expect(workspaceName(null, "@example.com")).toBe("My Agency");
  });

  it("uses the stable local user ID to isolate workspace slugs", () => {
    expect(workspaceSlug("11111111-1111-4111-8111-111111111111")).toBe(
      "agency-11111111-1111-4111-8111-111111111111",
    );
    expect(workspaceSlug("11111111-1111-4111-8111-111111111111")).not.toBe(
      workspaceSlug("22222222-2222-4222-8222-222222222222"),
    );
  });
});
