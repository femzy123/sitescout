import { randomUUID } from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { LeadExportRow } from "@/lib/lead-export";
import { requireOwnerContext } from "@/server/auth/owner-context";
import { getLeadExportRows } from "@/server/services/leads";

vi.mock("@/server/auth/owner-context", () => ({
  requireOwnerContext: vi.fn(),
}));
vi.mock("@/server/services/leads", () => ({
  getLeadExportRows: vi.fn(),
}));

import { POST } from "@/app/api/leads/export/route";

const organizationId = randomUUID();
const leadId = randomUUID();
const row: LeadExportRow = {
  leadId,
  businessName: "Atlas Studio",
  category: null,
  website: null,
  businessPhone: null,
  formattedAddress: null,
  googleMapsUrl: null,
  rating: null,
  reviewCount: null,
  contactName: null,
  contactEmail: null,
  contactPhone: null,
  qualification: "unqualified",
  opportunityScore: null,
  scoreStatus: "not_scored",
  websiteStatus: "missing",
  lostReason: null,
  lastContactedAt: null,
  nextFollowUpAt: null,
};

function request(body: unknown) {
  return new Request("http://localhost/api/leads/export", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("lead export route", () => {
  beforeEach(() => {
    vi.mocked(requireOwnerContext).mockResolvedValue({
      clerkUserId: "user_clerk",
      userId: randomUUID(),
      organizationId,
      organizationName: "Atlas Agency",
      timezone: "UTC",
    });
    vi.mocked(getLeadExportRows).mockResolvedValue([row]);
  });

  it("exports every organization-owned lead without a display limit", async () => {
    const response = await POST(request({ scope: "all" }));

    expect(getLeadExportRows).toHaveBeenCalledWith(organizationId, undefined);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(
      "text/csv; charset=utf-8",
    );
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("content-disposition")).toMatch(
      /sitescout-all-leads-\d{4}-\d{2}-\d{2}\.csv/,
    );
  });

  it("scopes selected exports to the requested lead IDs", async () => {
    const response = await POST(
      request({ scope: "selected", leadIds: [leadId] }),
    );

    expect(getLeadExportRows).toHaveBeenCalledWith(organizationId, [leadId]);
    expect(response.status).toBe(200);
  });

  it("rejects a partial selected result instead of leaking another tenant", async () => {
    vi.mocked(getLeadExportRows).mockResolvedValue([]);
    const response = await POST(
      request({ scope: "selected", leadIds: [leadId] }),
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringContaining("no longer available"),
    });
  });

  it("returns 404 when an organization has no leads", async () => {
    vi.mocked(getLeadExportRows).mockResolvedValue([]);
    const response = await POST(request({ scope: "all" }));

    expect(response.status).toBe(404);
  });
});
