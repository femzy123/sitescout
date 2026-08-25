import { randomUUID } from "node:crypto";

import Papa from "papaparse";
import { describe, expect, it } from "vitest";

import {
  leadExportColumns,
  leadExportFilename,
  leadExportRequestSchema,
  serializeLeadExport,
  type LeadExportRow,
} from "@/lib/lead-export";

const row: LeadExportRow = {
  leadId: randomUUID(),
  businessName: "=2+3",
  category: "Dental clinic",
  website: "https://example.com",
  businessPhone: "+234 800 000 0000",
  formattedAddress: "Line 1,\nLine 2",
  googleMapsUrl: null,
  rating: 4.8,
  reviewCount: 42,
  contactName: 'Ada "Dee"',
  contactEmail: "ada@example.com",
  contactPhone: null,
  qualification: "high",
  opportunityScore: 84,
  scoreStatus: "complete",
  websiteStatus: "reachable",
  lostReason: null,
  lastContactedAt: new Date("2026-08-25T10:30:00.000Z"),
  nextFollowUpAt: null,
};

describe("lead export request validation", () => {
  it("accepts all and selected export requests", () => {
    expect(leadExportRequestSchema.parse({ scope: "all" })).toEqual({
      scope: "all",
    });
    const leadId = randomUUID();
    expect(
      leadExportRequestSchema.parse({ scope: "selected", leadIds: [leadId] }),
    ).toEqual({ scope: "selected", leadIds: [leadId] });
  });

  it("rejects empty, duplicate, malformed, and oversized selections", () => {
    const leadId = randomUUID();
    expect(() =>
      leadExportRequestSchema.parse({ scope: "selected", leadIds: [] }),
    ).toThrow();
    expect(() =>
      leadExportRequestSchema.parse({
        scope: "selected",
        leadIds: [leadId, leadId],
      }),
    ).toThrow("Selected lead IDs must be unique");
    expect(() =>
      leadExportRequestSchema.parse({
        scope: "selected",
        leadIds: ["not-a-uuid"],
      }),
    ).toThrow();
    expect(() =>
      leadExportRequestSchema.parse({
        scope: "selected",
        leadIds: Array.from({ length: 201 }, () => randomUUID()),
      }),
    ).toThrow();
  });
});

describe("lead export CSV", () => {
  it("uses the approved columns in the exact order", () => {
    const csv = serializeLeadExport([row]);
    const parsed = Papa.parse<Record<string, string>>(csv.slice(1), {
      header: true,
    });

    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain("\r\n");
    expect(parsed.meta.fields).toEqual([...leadExportColumns]);
    expect(parsed.meta.fields).not.toEqual(
      expect.arrayContaining([
        "pipeline_stage",
        "stage_changed_at",
        "created_at",
        "updated_at",
        "external_source",
        "external_id",
      ]),
    );
  });

  it("formats dates and blanks while protecting spreadsheet formulas", () => {
    const csv = serializeLeadExport([row]);
    const parsed = Papa.parse<Record<string, string>>(csv.slice(1), {
      header: true,
    });
    const exported = parsed.data[0];

    expect(exported.business_name).toBe("'=2+3");
    expect(exported.business_phone).toBe("'+234 800 000 0000");
    expect(exported.formatted_address).toBe("Line 1,\nLine 2");
    expect(exported.contact_name).toBe('Ada "Dee"');
    expect(exported.last_contacted_at).toBe("2026-08-25T10:30:00.000Z");
    expect(exported.next_follow_up_at).toBe("");
    expect(exported.google_maps_url).toBe("");
  });

  it("creates stable selected and all filenames", () => {
    const date = new Date("2026-08-26T12:00:00.000Z");
    expect(leadExportFilename("selected", date)).toBe(
      "sitescout-selected-leads-2026-08-26.csv",
    );
    expect(leadExportFilename("all", date)).toBe(
      "sitescout-all-leads-2026-08-26.csv",
    );
  });
});
