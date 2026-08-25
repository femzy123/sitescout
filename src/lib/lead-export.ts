import Papa from "papaparse";
import { z } from "zod";

export const leadExportColumns = [
  "lead_id",
  "business_name",
  "category",
  "website",
  "business_phone",
  "formatted_address",
  "google_maps_url",
  "rating",
  "review_count",
  "contact_name",
  "contact_email",
  "contact_phone",
  "qualification",
  "opportunity_score",
  "score_status",
  "website_status",
  "lost_reason",
  "last_contacted_at",
  "next_follow_up_at",
] as const;

const selectedLeadIds = z
  .array(z.string().uuid())
  .min(1)
  .max(200)
  .refine((ids) => new Set(ids).size === ids.length, {
    message: "Selected lead IDs must be unique",
  });

export const leadExportRequestSchema = z.discriminatedUnion("scope", [
  z.object({ scope: z.literal("all") }).strict(),
  z
    .object({
      scope: z.literal("selected"),
      leadIds: selectedLeadIds,
    })
    .strict(),
]);

export type LeadExportRequest = z.infer<typeof leadExportRequestSchema>;

export type LeadExportRow = {
  leadId: string;
  businessName: string;
  category: string | null;
  website: string | null;
  businessPhone: string | null;
  formattedAddress: string | null;
  googleMapsUrl: string | null;
  rating: number | null;
  reviewCount: number | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  qualification: "unqualified" | "low" | "medium" | "high" | "hot";
  opportunityScore: number | null;
  scoreStatus: "not_scored" | "provisional" | "complete";
  websiteStatus: "unknown" | "missing" | "reachable" | "unreachable" | "unsafe";
  lostReason: string | null;
  lastContactedAt: Date | null;
  nextFollowUpAt: Date | null;
};

function isoDate(value: Date | null) {
  return value?.toISOString() ?? "";
}

export function serializeLeadExport(rows: LeadExportRow[]) {
  const records = rows.map((row) => ({
    lead_id: row.leadId,
    business_name: row.businessName,
    category: row.category ?? "",
    website: row.website ?? "",
    business_phone: row.businessPhone ?? "",
    formatted_address: row.formattedAddress ?? "",
    google_maps_url: row.googleMapsUrl ?? "",
    rating: row.rating ?? "",
    review_count: row.reviewCount ?? "",
    contact_name: row.contactName ?? "",
    contact_email: row.contactEmail ?? "",
    contact_phone: row.contactPhone ?? "",
    qualification: row.qualification,
    opportunity_score: row.opportunityScore ?? "",
    score_status: row.scoreStatus,
    website_status: row.websiteStatus,
    lost_reason: row.lostReason ?? "",
    last_contacted_at: isoDate(row.lastContactedAt),
    next_follow_up_at: isoDate(row.nextFollowUpAt),
  }));

  return `\uFEFF${Papa.unparse(records, {
    columns: [...leadExportColumns],
    header: true,
    newline: "\r\n",
    escapeFormulae: true,
  })}`;
}

export function leadExportFilename(
  scope: LeadExportRequest["scope"],
  date = new Date(),
) {
  const datePart = date.toISOString().slice(0, 10);
  return `sitescout-${scope === "selected" ? "selected" : "all"}-leads-${datePart}.csv`;
}
