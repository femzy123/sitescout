import { randomUUID } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { requireOwnerContext } from "@/server/auth/owner-context";
import { runDiscovery } from "@/server/services/places";

vi.mock("@/server/auth/owner-context", () => ({
  requireOwnerContext: vi.fn(),
}));
vi.mock("@/server/services/places", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@/server/services/places")>();
  return { ...original, runDiscovery: vi.fn() };
});

import { POST } from "@/app/api/discovery/search/route";

function request(body: unknown) {
  return new Request("http://localhost/api/discovery/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("discovery search route", () => {
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireOwnerContext).mockResolvedValue({
      clerkUserId: "user_clerk",
      userId: randomUUID(),
      organizationId: randomUUID(),
      organizationName: "Atlas Agency",
      timezone: "UTC",
    });
    consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it("does not expose database query details to the client", async () => {
    const databaseError = new Error(
      'Failed query: insert into "businesses" params: private phone number',
    );
    vi.mocked(runDiscovery).mockRejectedValue(databaseError);

    const response = await POST(
      request({
        location: "Lagos",
        category: "restaurant",
        websiteFilter: "any",
        targetCount: 25,
      }),
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Discovery search failed. Please try again.",
    });
    expect(consoleError).toHaveBeenCalledWith(
      "Discovery search failed",
      databaseError,
    );
  });

  it("returns a safe validation error for invalid search input", async () => {
    const response = await POST(
      request({ location: "L", category: "restaurant", targetCount: 25 }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Invalid discovery search request.",
    });
    expect(runDiscovery).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();
  });
});
