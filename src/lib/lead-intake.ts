import { z } from "zod";

export const importTargetFields = [
  "businessName",
  "contactName",
  "contactEmail",
  "businessPhone",
  "contactPhone",
  "websiteUrl",
  "address",
  "city",
  "state",
  "postalCode",
  "country",
  "category",
  "externalId",
  "googleMapsUrl",
  "note",
  "metadata",
] as const;

export type ImportTargetField = (typeof importTargetFields)[number];
export type ColumnMapping = Partial<Record<ImportTargetField, string[]>>;

export type LeadIntakeInput = {
  businessName: string;
  category?: string;
  websiteUrl?: string;
  businessPhone?: string;
  formattedAddress?: string;
  googleMapsUrl?: string;
  googlePlaceId?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  externalSource?: string;
  externalId?: string;
  sourceMetadata?: Record<string, string | number | boolean | null>;
  note?: string;
};

const optionalText = (max: number) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() ? value : undefined),
    z.string().trim().max(max).optional(),
  );

export const leadIntakeSchema = z.object({
  businessName: z.string().trim().min(1).max(240),
  category: optionalText(160),
  websiteUrl: optionalText(2048),
  businessPhone: optionalText(80),
  formattedAddress: optionalText(500),
  googleMapsUrl: optionalText(2048),
  googlePlaceId: optionalText(240),
  contactName: optionalText(200),
  contactEmail: z.preprocess(
    (value) => (typeof value === "string" && value.trim() ? value : undefined),
    z.string().trim().email().max(320).optional(),
  ),
  contactPhone: optionalText(80),
  externalSource: optionalText(160),
  externalId: optionalText(240),
  sourceMetadata: z
    .record(
      z.string().max(160),
      z.union([z.string(), z.number(), z.boolean(), z.null()]),
    )
    .optional(),
  note: optionalText(5000),
});

export const manualLeadRequestSchema = leadIntakeSchema.omit({
  externalSource: true,
  externalId: true,
  sourceMetadata: true,
  googlePlaceId: true,
});

export type MatchableBusiness = {
  id: string;
  googlePlaceId: string | null;
  externalSource: string | null;
  externalId: string | null;
  normalizedDomain: string | null;
  normalizedName: string | null;
  normalizedAddress: string | null;
  name: string;
  websiteUrl: string | null;
  formattedAddress: string | null;
};

export type BusinessMatch<T extends MatchableBusiness> =
  | { kind: "match"; business: T }
  | { kind: "ambiguous"; reason: string }
  | { kind: "none" };

export function matchLeadBusiness<T extends MatchableBusiness>(
  candidates: T[],
  input: LeadIntakeInput,
): BusinessMatch<T> {
  if (input.externalSource && input.externalId) {
    const match = candidates.find(
      (business) =>
        business.externalSource === input.externalSource &&
        business.externalId === input.externalId,
    );
    if (match) return { kind: "match", business: match };
  }

  if (input.googlePlaceId) {
    const match = candidates.find(
      (business) => business.googlePlaceId === input.googlePlaceId,
    );
    if (match) return { kind: "match", business: match };
  }

  const domain = normalizeDomain(input.websiteUrl);
  if (domain) {
    const matches = candidates.filter(
      (business) =>
        (business.normalizedDomain ??
          normalizeDomain(business.websiteUrl ?? undefined)) === domain,
    );
    if (matches.length === 1) return { kind: "match", business: matches[0] };
    if (matches.length > 1) {
      return {
        kind: "ambiguous",
        reason: `Website domain ${domain} matches multiple businesses`,
      };
    }
  }

  const normalizedName = normalizeText(input.businessName);
  const normalizedAddress = normalizeText(input.formattedAddress);
  if (normalizedName && normalizedAddress) {
    const matches = candidates.filter(
      (business) =>
        (business.normalizedName ?? normalizeText(business.name)) ===
          normalizedName &&
        (business.normalizedAddress ??
          normalizeText(business.formattedAddress ?? undefined)) ===
          normalizedAddress,
    );
    if (matches.length === 1) return { kind: "match", business: matches[0] };
    if (matches.length > 1) {
      return {
        kind: "ambiguous",
        reason: "Business name and address match multiple businesses",
      };
    }
  }

  return { kind: "none" };
}

const rowValueSchema = z
  .record(z.string().max(160), z.string().max(5000))
  .refine((row) => Object.keys(row).length <= 100, {
    message: "CSV rows can contain at most 100 columns",
  });
const mappingSchema = z
  .partialRecord(
    z.enum(importTargetFields),
    z.array(z.string().max(160)).max(100),
  )
  .refine((mapping) => (mapping.businessName?.length ?? 0) > 0, {
    message: "Map at least one column to Business name",
  });

export const csvImportRequestSchema = z
  .object({
    fileName: z.string().trim().min(1).max(255),
    sourceName: z.string().trim().min(1).max(160),
    mapping: mappingSchema,
    rows: z
      .array(
        z.object({
          rowNumber: z.number().int().min(2).max(1002),
          values: rowValueSchema,
        }),
      )
      .min(1)
      .max(1000),
  })
  .superRefine((payload, context) => {
    const headers = new Set(Object.keys(payload.rows[0]?.values ?? {}));
    const mappedColumns = Object.values(payload.mapping).flatMap(
      (columns) => columns ?? [],
    );
    if (mappedColumns.some((column) => !headers.has(column))) {
      context.addIssue({
        code: "custom",
        message: "The mapping refers to a column that is not in the CSV",
      });
    }
    const approximateBytes =
      [...headers].reduce((total, header) => total + header.length + 1, 0) +
      payload.rows.reduce(
        (total, row) =>
          total +
          Object.values(row.values).reduce(
            (rowTotal, value) => rowTotal + value.length + 1,
            0,
          ),
        0,
      );
    if (approximateBytes > 2 * 1024 * 1024) {
      context.addIssue({
        code: "custom",
        message: "CSV files must be 2 MB or smaller",
      });
    }
  });

const blankValues = new Set(["", "-", "n/a", "na", "null", "unknown"]);

export function cleanCell(value: unknown) {
  if (value == null) return undefined;
  const text = String(value).trim();
  return blankValues.has(text.toLowerCase()) ? undefined : text;
}

export function normalizeText(value: string | undefined) {
  return cleanCell(value)?.toLowerCase().replace(/\s+/g, " ");
}

export function normalizeExternalKey(value: string | undefined) {
  return normalizeText(value)?.replace(/\s+/g, "-");
}

export function normalizeWebsiteUrl(value: string | undefined) {
  const clean = cleanCell(value);
  if (!clean) return undefined;
  const candidate = /^[a-z][a-z\d+.-]*:/i.test(clean)
    ? clean
    : `https://${clean}`;
  const parsed = new URL(candidate);
  if (!["http:", "https:"].includes(parsed.protocol))
    throw new Error("Website must use http or https");
  parsed.hash = "";
  return parsed.toString();
}

export function normalizeDomain(value: string | undefined) {
  try {
    const url = normalizeWebsiteUrl(value);
    return url
      ? new URL(url).hostname.toLowerCase().replace(/^www\./, "")
      : undefined;
  } catch {
    return undefined;
  }
}

function firstValue(
  row: Record<string, string>,
  columns: string[] | undefined,
) {
  for (const column of columns ?? []) {
    const value = cleanCell(row[column]);
    if (value) return value;
  }
  return undefined;
}

export function resolveImportedRow(
  row: Record<string, string>,
  mapping: ColumnMapping,
  externalSource: string,
): LeadIntakeInput {
  const addressParts = [
    firstValue(row, mapping.address),
    firstValue(row, mapping.city),
    firstValue(row, mapping.state),
    firstValue(row, mapping.postalCode),
    firstValue(row, mapping.country),
  ].filter(Boolean) as string[];
  const sourceMetadata = Object.fromEntries(
    (mapping.metadata ?? [])
      .map((column) => [column, cleanCell(row[column])])
      .filter((entry): entry is [string, string] => Boolean(entry[1])),
  );

  return {
    businessName: firstValue(row, mapping.businessName) ?? "",
    category: firstValue(row, mapping.category),
    websiteUrl: firstValue(row, mapping.websiteUrl),
    businessPhone: firstValue(row, mapping.businessPhone),
    formattedAddress: addressParts.length ? addressParts.join(", ") : undefined,
    googleMapsUrl: firstValue(row, mapping.googleMapsUrl),
    contactName: firstValue(row, mapping.contactName),
    contactEmail: firstValue(row, mapping.contactEmail),
    contactPhone: firstValue(row, mapping.contactPhone),
    externalSource,
    externalId: firstValue(row, mapping.externalId),
    sourceMetadata: Object.keys(sourceMetadata).length
      ? sourceMetadata
      : undefined,
    note: firstValue(row, mapping.note),
  };
}

const aliases: Record<Exclude<ImportTargetField, "metadata">, string[]> = {
  businessName: [
    "business name",
    "business_name",
    "company name",
    "company_name",
    "company",
    "business",
    "dba name",
    "dba_name",
  ],
  contactName: [
    "contact name",
    "contact_name",
    "owner name",
    "owner_name",
    "contact person",
  ],
  contactEmail: [
    "email",
    "email address",
    "email_address",
    "work email",
    "contact email",
  ],
  businessPhone: [
    "business phone",
    "business_phone",
    "phone",
    "telephone",
    "ll_phonenice",
    "lm_phonenice",
  ],
  contactPhone: ["contact phone", "contact_phone", "mobile", "cell"],
  websiteUrl: [
    "website",
    "website url",
    "website_url",
    "url",
    "domain",
    "site",
  ],
  address: [
    "address",
    "street address",
    "street_address",
    "ll_streetaddress",
    "lm_streetaddress",
  ],
  city: ["city", "ll_city", "lm_city"],
  state: ["state", "region", "province", "ll_state", "lm_state"],
  postalCode: [
    "zip",
    "zip code",
    "zipcode",
    "postal code",
    "postal_code",
    "ll_zip",
    "lm_zip",
  ],
  country: ["country", "country code", "country_code"],
  category: [
    "category",
    "business category",
    "primary category",
    "license type",
  ],
  externalId: [
    "external id",
    "external_id",
    "license id",
    "record id",
    "source id",
  ],
  googleMapsUrl: [
    "google maps",
    "google maps url",
    "google_maps_url",
    "maps url",
  ],
  note: ["note", "notes", "comments"],
};

function canonicalHeader(header: string) {
  return header
    .trim()
    .toLowerCase()
    .replace(/[-.]+/g, "_")
    .replace(/\s+/g, " ");
}

function fallbackPriority(header: string) {
  const normalized = header.toLowerCase();
  if (normalized.startsWith("ll_")) return 0;
  if (normalized.startsWith("lm_")) return 2;
  return 1;
}

export function suggestColumnMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  const hasExplicitBusinessName = headers.some((header) =>
    aliases.businessName.includes(canonicalHeader(header)),
  );

  for (const header of headers) {
    const normalized = canonicalHeader(header);
    let target: ImportTargetField | undefined = (
      Object.entries(aliases) as Array<
        [Exclude<ImportTargetField, "metadata">, string[]]
      >
    ).find(([, candidates]) => candidates.includes(normalized))?.[0];

    if (!target && normalized === "name")
      target = hasExplicitBusinessName ? "contactName" : "businessName";
    if (!target && normalized === "licensee name") target = "metadata";
    if (!target) continue;
    mapping[target] = [...(mapping[target] ?? []), header].sort(
      (left, right) => fallbackPriority(left) - fallbackPriority(right),
    );
  }

  for (const field of importTargetFields) {
    if (field !== "metadata" && mapping[field]) {
      mapping[field] = mapping[field]?.slice(0, 2);
    }
  }

  return mapping;
}

export const importFieldLabels: Record<ImportTargetField, string> = {
  businessName: "Business name",
  contactName: "Contact name",
  contactEmail: "Contact email",
  businessPhone: "Business phone",
  contactPhone: "Contact phone",
  websiteUrl: "Website",
  address: "Street address",
  city: "City",
  state: "State / region",
  postalCode: "Postal code",
  country: "Country",
  category: "Category",
  externalId: "External ID",
  googleMapsUrl: "Google Maps URL",
  note: "Notes",
  metadata: "Source metadata",
};
