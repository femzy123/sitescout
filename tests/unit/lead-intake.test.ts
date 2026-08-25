import { describe, expect, it } from "vitest";

import {
  cleanCell,
  csvImportRequestSchema,
  leadIntakeSchema,
  matchLeadBusiness,
  normalizeDomain,
  normalizeWebsiteUrl,
  resolveImportedRow,
  suggestColumnMapping,
  type MatchableBusiness,
} from "@/lib/lead-intake";

function business(
  values: Partial<MatchableBusiness> & Pick<MatchableBusiness, "id" | "name">,
): MatchableBusiness {
  return {
    googlePlaceId: null,
    externalSource: null,
    externalId: null,
    normalizedDomain: null,
    normalizedName: null,
    normalizedAddress: null,
    websiteUrl: null,
    formattedAddress: null,
    ...values,
  };
}

describe("lead intake normalization", () => {
  it("treats known placeholders as blank", () => {
    for (const value of ["", "-", "n/a", "NA", "null", "unknown"]) {
      expect(cleanCell(value)).toBeUndefined();
    }
    expect(cleanCell("  Acme  ")).toBe("Acme");
  });

  it("normalizes scheme-less websites and domains", () => {
    expect(normalizeWebsiteUrl("www.Example.com/path#section")).toBe(
      "https://www.example.com/path",
    );
    expect(normalizeDomain("https://www.Example.com/about")).toBe(
      "example.com",
    );
  });

  it("accepts a lead containing only a business name", () => {
    expect(
      leadIntakeSchema.parse({ businessName: "  Atlas Studio  " }),
    ).toEqual({ businessName: "Atlas Studio" });
  });
});

describe("CSV suggestions and row resolution", () => {
  it("accepts an import when optional fields are not mapped", () => {
    const parsed = csvImportRequestSchema.parse({
      fileName: "leads.csv",
      sourceName: "leads",
      mapping: { businessName: ["Business name"] },
      rows: [
        {
          rowNumber: 2,
          values: { "Business name": "Atlas Studio" },
        },
      ],
    });

    expect(parsed.mapping).toEqual({ businessName: ["Business name"] });
  });

  it("maps name to business unless a company column is present", () => {
    expect(suggestColumnMapping(["name"])).toMatchObject({
      businessName: ["name"],
    });
    expect(suggestColumnMapping(["Company", "name"])).toMatchObject({
      businessName: ["Company"],
      contactName: ["name"],
    });
  });

  it("maps the licensing CSV conservatively with location-first fallbacks", () => {
    const headers = [
      "License ID",
      "License Type",
      "Licensee Name",
      "DBA Name",
      "LM_StreetAddress",
      "LM_CITY",
      "LM_ZIP",
      "LM_STATE",
      "LM_PhoneNice",
      "LL_StreetAddress",
      "LL_CITY",
      "Zip",
      "LL_PhoneNice",
    ];
    const mapping = suggestColumnMapping(headers);
    expect(mapping.businessName).toEqual(["DBA Name"]);
    expect(mapping.contactName).toBeUndefined();
    expect(mapping.metadata).toContain("Licensee Name");
    expect(mapping.businessPhone).toEqual(["LL_PhoneNice", "LM_PhoneNice"]);
    expect(mapping.address).toEqual(["LL_StreetAddress", "LM_StreetAddress"]);

    const resolved = resolveImportedRow(
      {
        "License ID": "9226823",
        "License Type": "Vending",
        "Licensee Name": "COMPASS GROUP USA",
        "DBA Name": "SMUGGLERS",
        LM_StreetAddress: "2589 CONSULATE DR",
        LM_CITY: "ORLANDO",
        LM_ZIP: "32819",
        LM_STATE: "FL",
        LM_PhoneNice: "(321) 354-0484",
        LL_StreetAddress: "351 STUDIO DR",
        LL_CITY: "LAKE BUENA VISTA",
        Zip: "32830",
        LL_PhoneNice: "-",
      },
      mapping,
      "Sample Lead Import File - Sheet1",
    );
    expect(resolved).toMatchObject({
      businessName: "SMUGGLERS",
      category: "Vending",
      externalId: "9226823",
      businessPhone: "(321) 354-0484",
      formattedAddress: "351 STUDIO DR, LAKE BUENA VISTA, FL, 32830",
      sourceMetadata: { "Licensee Name": "COMPASS GROUP USA" },
    });
    expect(resolved.contactName).toBeUndefined();
  });
});

describe("conservative duplicate matching", () => {
  it("uses external identity before other signals", () => {
    const expected = business({
      id: "external",
      name: "Old name",
      externalSource: "city-data",
      externalId: "42",
    });
    expect(
      matchLeadBusiness([expected], {
        businessName: "New name",
        externalSource: "city-data",
        externalId: "42",
      }),
    ).toEqual({ kind: "match", business: expected });
  });

  it("matches a unique domain but rejects an ambiguous domain", () => {
    const first = business({
      id: "one",
      name: "Acme One",
      normalizedDomain: "acme.test",
    });
    const second = business({
      id: "two",
      name: "Acme Two",
      normalizedDomain: "acme.test",
    });
    expect(
      matchLeadBusiness([first], {
        businessName: "Acme",
        websiteUrl: "www.acme.test",
      }).kind,
    ).toBe("match");
    expect(
      matchLeadBusiness([first, second], {
        businessName: "Acme",
        websiteUrl: "acme.test",
      }).kind,
    ).toBe("ambiguous");
  });

  it("matches normalized name plus address but never a name alone", () => {
    const existing = business({
      id: "one",
      name: "Acme Dental",
      formattedAddress: "10 High Street, Lagos",
    });
    expect(
      matchLeadBusiness([existing], {
        businessName: "  ACME DENTAL ",
        formattedAddress: "10 high street,  lagos",
        businessPhone: "+234 800 000 0000",
      }).kind,
    ).toBe("match");
    expect(
      matchLeadBusiness([existing], {
        businessName: "Acme Dental",
        businessPhone: "+234 800 000 0000",
      }).kind,
    ).toBe("none");
  });
});
