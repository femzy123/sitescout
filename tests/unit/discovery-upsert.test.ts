import { randomUUID } from "node:crypto";

import { drizzle } from "drizzle-orm/neon-http";
import { describe, expect, it } from "vitest";

import * as schema from "@/server/db/schema";
import { buildGooglePlaceBusinessUpsert } from "@/server/services/places";

describe("discovery business upsert", () => {
  it("matches the partial organization and Google Place unique index", () => {
    const organizationId = randomUUID();
    const query = buildGooglePlaceBusinessUpsert(
      drizzle.mock({ schema }),
      {
        id: "ChIJ-test-place",
        displayName: { text: "Atlas Studio" },
        formattedAddress: "1 Example Road",
      },
      organizationId,
      new Date("2026-08-31T12:00:00.000Z"),
    ).toSQL();

    expect(query.sql).toContain(
      'on conflict ("organization_id","google_place_id") where "businesses"."google_place_id" is not null do update',
    );
    expect(query.params).toEqual(
      expect.arrayContaining([organizationId, "ChIJ-test-place"]),
    );
  });
});
