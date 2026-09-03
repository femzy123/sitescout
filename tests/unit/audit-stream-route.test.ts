import { randomUUID } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { requireOwnerContext } from "@/server/auth/owner-context";
import { runLeadAudit } from "@/server/services/audit/run-audit";

vi.mock("@/server/auth/owner-context", () => ({
  requireOwnerContext: vi.fn(),
}));
vi.mock("@/server/services/audit/run-audit", () => ({
  runLeadAudit: vi.fn(),
}));

import { POST } from "@/app/api/audits/stream/route";

const originalAuditDebug = process.env.AUDIT_DEBUG;

function request() {
  return new Request("http://localhost/api/audits/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ leadId: randomUUID() }),
  });
}

describe("audit stream route diagnostics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(requireOwnerContext).mockResolvedValue({
      clerkUserId: "user_clerk",
      userId: randomUUID(),
      organizationId: randomUUID(),
      organizationName: "Atlas Agency",
      timezone: "UTC",
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalAuditDebug === undefined) delete process.env.AUDIT_DEBUG;
    else process.env.AUDIT_DEBUG = originalAuditDebug;
  });

  it("streams redacted fatal details only when debug mode is enabled", async () => {
    process.env.AUDIT_DEBUG = "true";
    vi.mocked(runLeadAudit).mockRejectedValue(
      new Error(
        "Provider failed with api_key=top-secret at https://user:pass@example.com/audit?token=signed",
      ),
    );

    const response = await POST(request());
    const body = await response.text();
    const event = JSON.parse(body.trim());

    expect(event).toMatchObject({
      type: "error",
      stage: "audit_fatal",
      message: "Website analysis failed",
      details: {
        name: "Error",
        causes: [],
      },
    });
    expect(body).not.toMatch(/top-secret|user:pass|signed/);
  });

  it("omits fatal details when debug mode is disabled", async () => {
    process.env.AUDIT_DEBUG = "false";
    vi.mocked(runLeadAudit).mockRejectedValue(new Error("internal failure"));

    const response = await POST(request());
    const event = JSON.parse((await response.text()).trim());

    expect(event).toMatchObject({
      type: "error",
      message: "Website analysis failed",
    });
    expect(event).not.toHaveProperty("details");
  });
});
