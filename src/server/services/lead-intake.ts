import { randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";

import {
  cleanCell,
  leadIntakeSchema,
  matchLeadBusiness,
  normalizeDomain,
  normalizeExternalKey,
  normalizeText,
  normalizeWebsiteUrl,
  resolveImportedRow,
  type ColumnMapping,
  type LeadIntakeInput,
} from "@/lib/lead-intake";
import type { OwnerContext } from "@/server/auth/owner-context";
import { getDb, type Database } from "@/server/db";
import {
  businesses,
  leadEvents,
  leadImports,
  leads,
  notes,
} from "@/server/db/schema";

export type LeadIntakeStatus = "created" | "updated" | "unchanged";
export type LeadImportIssue = { row: number; code: string; message: string };
export type LeadImportPayload = {
  fileName: string;
  sourceName: string;
  mapping: ColumnMapping;
  rows: Array<{ rowNumber: number; values: Record<string, string> }>;
};

type IntakeSource = "manual" | "import";
type BusinessSnapshot = {
  id: string;
  googlePlaceId: string | null;
  externalSource: string | null;
  externalId: string | null;
  normalizedDomain: string | null;
  normalizedName: string | null;
  normalizedAddress: string | null;
  name: string;
  formattedAddress: string | null;
  phone: string | null;
  websiteUrl: string | null;
  googleMapsUrl: string | null;
  primaryCategory: string | null;
  providerData: Record<string, unknown>;
  leadId: string | null;
  websiteStatus:
    "unknown" | "missing" | "reachable" | "unreachable" | "unsafe" | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
};
type BusinessInsert = typeof businesses.$inferInsert;
type LeadInsert = typeof leads.$inferInsert;
type BusinessUpdate = Partial<BusinessInsert>;
type LeadUpdate = Partial<LeadInsert>;
type IntakeOperation = {
  status: LeadIntakeStatus;
  leadId: string;
  businessId: string;
  newBusiness?: BusinessInsert;
  businessUpdate?: BusinessUpdate;
  newLead?: LeadInsert;
  leadUpdate?: LeadUpdate;
  event: typeof leadEvents.$inferInsert;
  note?: typeof notes.$inferInsert;
};

export class AmbiguousLeadMatchError extends Error {
  constructor(message = "More than one business matches this row") {
    super(message);
    this.name = "AmbiguousLeadMatchError";
  }
}

function normalizeInput(input: LeadIntakeInput): LeadIntakeInput {
  const parsed = leadIntakeSchema.parse(input);
  return {
    ...parsed,
    websiteUrl: parsed.websiteUrl
      ? normalizeWebsiteUrl(parsed.websiteUrl)
      : undefined,
    contactEmail: parsed.contactEmail?.toLowerCase(),
    externalSource: normalizeExternalKey(parsed.externalSource),
    externalId: cleanCell(parsed.externalId),
  };
}

function filled(value: string | null | undefined) {
  return Boolean(cleanCell(value));
}

class LeadIntakeSession {
  private constructor(
    private readonly context: OwnerContext,
    private readonly snapshots: BusinessSnapshot[],
  ) {}

  static async create(context: OwnerContext) {
    const rows = await getDb()
      .select({
        id: businesses.id,
        googlePlaceId: businesses.googlePlaceId,
        externalSource: businesses.externalSource,
        externalId: businesses.externalId,
        normalizedDomain: businesses.normalizedDomain,
        normalizedName: businesses.normalizedName,
        normalizedAddress: businesses.normalizedAddress,
        name: businesses.name,
        formattedAddress: businesses.formattedAddress,
        phone: businesses.phone,
        websiteUrl: businesses.websiteUrl,
        googleMapsUrl: businesses.googleMapsUrl,
        primaryCategory: businesses.primaryCategory,
        providerData: businesses.providerData,
        leadId: leads.id,
        websiteStatus: leads.websiteStatus,
        contactName: leads.contactName,
        contactEmail: leads.contactEmail,
        contactPhone: leads.contactPhone,
      })
      .from(businesses)
      .leftJoin(
        leads,
        and(
          eq(leads.organizationId, businesses.organizationId),
          eq(leads.businessId, businesses.id),
        ),
      )
      .where(eq(businesses.organizationId, context.organizationId));
    return new LeadIntakeSession(context, rows);
  }

  private findMatch(input: LeadIntakeInput) {
    const result = matchLeadBusiness(this.snapshots, input);
    if (result.kind === "ambiguous") {
      throw new AmbiguousLeadMatchError(result.reason);
    }
    return result.kind === "match" ? result.business : undefined;
  }

  plan(rawInput: LeadIntakeInput, source: IntakeSource): IntakeOperation {
    const input = normalizeInput(rawInput);
    const match = this.findMatch(input);

    if (!match) return this.planCreate(input, source);
    return this.planMatch(match, input, source);
  }

  private planCreate(
    input: LeadIntakeInput,
    source: IntakeSource,
  ): IntakeOperation {
    const businessId = randomUUID();
    const leadId = randomUUID();
    const newBusiness: BusinessInsert = {
      id: businessId,
      organizationId: this.context.organizationId,
      googlePlaceId: input.googlePlaceId,
      name: input.businessName,
      formattedAddress: input.formattedAddress,
      phone: input.businessPhone,
      websiteUrl: input.websiteUrl,
      googleMapsUrl: input.googleMapsUrl,
      primaryCategory: input.category,
      externalSource: input.externalSource,
      externalId: input.externalId,
      normalizedDomain: normalizeDomain(input.websiteUrl),
      normalizedName: normalizeText(input.businessName),
      normalizedAddress: normalizeText(input.formattedAddress),
      providerData: input.sourceMetadata ?? {},
      source,
    };
    const newLead: LeadInsert = {
      id: leadId,
      organizationId: this.context.organizationId,
      businessId,
      assignedTo: this.context.userId,
      pipelineStage: "new",
      scoreStatus: "not_scored",
      websiteStatus: input.websiteUrl ? "unknown" : "missing",
      contactName: input.contactName,
      contactEmail: input.contactEmail,
      contactPhone: input.contactPhone,
    };
    this.snapshots.push({
      id: businessId,
      googlePlaceId: null,
      externalSource: input.externalSource ?? null,
      externalId: input.externalId ?? null,
      normalizedDomain: normalizeDomain(input.websiteUrl) ?? null,
      normalizedName: normalizeText(input.businessName) ?? null,
      normalizedAddress: normalizeText(input.formattedAddress) ?? null,
      name: input.businessName,
      formattedAddress: input.formattedAddress ?? null,
      phone: input.businessPhone ?? null,
      websiteUrl: input.websiteUrl ?? null,
      googleMapsUrl: input.googleMapsUrl ?? null,
      primaryCategory: input.category ?? null,
      providerData: input.sourceMetadata ?? {},
      leadId,
      websiteStatus: input.websiteUrl ? "unknown" : "missing",
      contactName: input.contactName ?? null,
      contactEmail: input.contactEmail ?? null,
      contactPhone: input.contactPhone ?? null,
    });
    return {
      status: "created",
      leadId,
      businessId,
      newBusiness,
      newLead,
      event: this.event(leadId, source, "created", []),
      note: this.note(leadId, input.note),
    };
  }

  private planMatch(
    match: BusinessSnapshot,
    input: LeadIntakeInput,
    source: IntakeSource,
  ): IntakeOperation {
    const businessUpdate: BusinessUpdate = {};
    const leadUpdate: LeadUpdate = {};
    const changedFields: string[] = [];
    const fillBusiness = (
      field:
        | "formattedAddress"
        | "phone"
        | "websiteUrl"
        | "googleMapsUrl"
        | "primaryCategory",
      value: string | undefined,
    ) => {
      if (!filled(match[field]) && filled(value)) {
        businessUpdate[field] = value;
        match[field] = value ?? null;
        changedFields.push(field);
      }
    };
    fillBusiness("formattedAddress", input.formattedAddress);
    fillBusiness("phone", input.businessPhone);
    fillBusiness("websiteUrl", input.websiteUrl);
    fillBusiness("googleMapsUrl", input.googleMapsUrl);
    fillBusiness("primaryCategory", input.category);

    if (!match.normalizedAddress && input.formattedAddress) {
      match.normalizedAddress = normalizeText(input.formattedAddress) ?? null;
      businessUpdate.normalizedAddress = match.normalizedAddress;
    }
    if (!match.normalizedDomain && input.websiteUrl) {
      match.normalizedDomain = normalizeDomain(input.websiteUrl) ?? null;
      businessUpdate.normalizedDomain = match.normalizedDomain;
    }
    if (
      !match.externalSource &&
      !match.externalId &&
      input.externalSource &&
      input.externalId
    ) {
      match.externalSource = input.externalSource ?? null;
      match.externalId = input.externalId ?? null;
      businessUpdate.externalSource = input.externalSource;
      businessUpdate.externalId = input.externalId;
      changedFields.push("externalSource", "externalId");
    } else if (
      match.externalSource === input.externalSource &&
      !match.externalId &&
      input.externalId
    ) {
      match.externalId = input.externalId;
      businessUpdate.externalId = input.externalId;
      changedFields.push("externalId");
    }
    if (
      input.sourceMetadata &&
      Object.keys(input.sourceMetadata).length &&
      !Object.keys(match.providerData).length
    ) {
      match.providerData = input.sourceMetadata;
      businessUpdate.providerData = input.sourceMetadata;
      changedFields.push("sourceMetadata");
    }

    const fillLead = (
      field: "contactName" | "contactEmail" | "contactPhone",
      value: string | undefined,
    ) => {
      if (!filled(match[field]) && filled(value)) {
        leadUpdate[field] = value;
        match[field] = value ?? null;
        changedFields.push(field);
      }
    };
    fillLead("contactName", input.contactName);
    fillLead("contactEmail", input.contactEmail);
    fillLead("contactPhone", input.contactPhone);
    if (match.leadId && match.websiteStatus === "missing" && input.websiteUrl) {
      match.websiteStatus = "unknown";
      leadUpdate.websiteStatus = "unknown";
      changedFields.push("websiteStatus");
    }

    const leadId = match.leadId ?? randomUUID();
    const newLead: LeadInsert | undefined = match.leadId
      ? undefined
      : {
          id: leadId,
          organizationId: this.context.organizationId,
          businessId: match.id,
          assignedTo: this.context.userId,
          pipelineStage: "new",
          scoreStatus: "not_scored",
          websiteStatus: match.websiteUrl ? "unknown" : "missing",
          contactName: input.contactName,
          contactEmail: input.contactEmail,
          contactPhone: input.contactPhone,
        };
    if (newLead) match.leadId = leadId;
    if (Object.keys(businessUpdate).length)
      businessUpdate.updatedAt = new Date();
    if (Object.keys(leadUpdate).length) leadUpdate.updatedAt = new Date();

    const status: LeadIntakeStatus = newLead
      ? "created"
      : changedFields.length
        ? "updated"
        : "unchanged";
    return {
      status,
      leadId,
      businessId: match.id,
      businessUpdate: Object.keys(businessUpdate).length
        ? businessUpdate
        : undefined,
      newLead,
      leadUpdate:
        !newLead && Object.keys(leadUpdate).length ? leadUpdate : undefined,
      event: this.event(leadId, source, status, changedFields),
      note:
        source === "manual" || status !== "unchanged"
          ? this.note(leadId, input.note)
          : undefined,
    };
  }

  private event(
    leadId: string,
    source: IntakeSource,
    status: LeadIntakeStatus,
    changedFields: string[],
  ): typeof leadEvents.$inferInsert {
    return {
      organizationId: this.context.organizationId,
      leadId,
      actorUserId: this.context.userId,
      type:
        status === "created"
          ? "lead.created"
          : source === "manual"
            ? "lead.manual_enriched"
            : "lead.import_enriched",
      metadata: { source, status, changedFields },
    };
  }

  private note(leadId: string, body: string | undefined) {
    return body
      ? {
          organizationId: this.context.organizationId,
          leadId,
          authorUserId: this.context.userId,
          body,
        }
      : undefined;
  }
}

function operationQueries(db: Database, operation: IntakeOperation) {
  const queries = [];
  if (operation.newBusiness) {
    queries.push(db.insert(businesses).values(operation.newBusiness));
  } else if (operation.businessUpdate) {
    queries.push(
      db
        .update(businesses)
        .set(operation.businessUpdate)
        .where(
          and(
            eq(businesses.organizationId, operation.event.organizationId),
            eq(businesses.id, operation.businessId),
          ),
        ),
    );
  }
  if (operation.newLead) {
    queries.push(db.insert(leads).values(operation.newLead));
  } else if (operation.leadUpdate) {
    queries.push(
      db
        .update(leads)
        .set(operation.leadUpdate)
        .where(
          and(
            eq(leads.organizationId, operation.event.organizationId),
            eq(leads.id, operation.leadId),
          ),
        ),
    );
  }
  if (operation.status !== "unchanged") {
    queries.push(db.insert(leadEvents).values(operation.event));
  }
  if (operation.note) queries.push(db.insert(notes).values(operation.note));
  return queries;
}

async function persistOperations(db: Database, operations: IntakeOperation[]) {
  for (let index = 0; index < operations.length; index += 100) {
    const queries = operations
      .slice(index, index + 100)
      .flatMap((operation) => operationQueries(db, operation));
    if (queries.length) {
      await db.batch(queries as unknown as Parameters<Database["batch"]>[0]);
    }
  }
}

export async function intakeLead(
  input: LeadIntakeInput,
  context: OwnerContext,
  source: IntakeSource,
) {
  const session = await LeadIntakeSession.create(context);
  const operation = session.plan(input, source);
  await persistOperations(getDb(), [operation]);
  return { status: operation.status, leadId: operation.leadId };
}

export async function importLeadRows(
  payload: LeadImportPayload,
  context: OwnerContext,
) {
  const db = getDb();
  const [leadImport] = await db
    .insert(leadImports)
    .values({
      organizationId: context.organizationId,
      createdBy: context.userId,
      fileName: payload.fileName,
      sourceName: payload.sourceName,
      totalRows: payload.rows.length,
      columnMapping: payload.mapping,
    })
    .returning({ id: leadImports.id });
  const issues: LeadImportIssue[] = [];
  let createdCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;

  try {
    const session = await LeadIntakeSession.create(context);
    const operations: IntakeOperation[] = [];
    for (const row of payload.rows) {
      try {
        const operation = session.plan(
          resolveImportedRow(row.values, payload.mapping, payload.sourceName),
          "import",
        );
        operations.push(operation);
      } catch (error) {
        issues.push({
          row: row.rowNumber,
          code:
            error instanceof AmbiguousLeadMatchError
              ? "ambiguous_match"
              : "invalid_row",
          message:
            error instanceof Error
              ? error.message
              : "The row could not be imported",
        });
      }
    }
    await persistOperations(db, operations);
    createdCount = operations.filter(
      (operation) => operation.status === "created",
    ).length;
    updatedCount = operations.filter(
      (operation) => operation.status === "updated",
    ).length;
    skippedCount = operations.filter(
      (operation) => operation.status === "unchanged",
    ).length;
    const completedAt = new Date();
    await db
      .update(leadImports)
      .set({
        status: issues.length ? "partial" : "completed",
        processedRows: payload.rows.length,
        createdCount,
        updatedCount,
        skippedCount,
        rejectedCount: issues.length,
        errorSummary: issues,
        completedAt,
        updatedAt: completedAt,
      })
      .where(eq(leadImports.id, leadImport.id));
    return {
      importId: leadImport.id,
      totalRows: payload.rows.length,
      createdCount,
      updatedCount,
      skippedCount,
      rejectedCount: issues.length,
      issues,
    };
  } catch (error) {
    const completedAt = new Date();
    await db
      .update(leadImports)
      .set({
        status: "failed",
        processedRows:
          createdCount + updatedCount + skippedCount + issues.length,
        createdCount,
        updatedCount,
        skippedCount,
        rejectedCount: issues.length,
        errorSummary: issues,
        completedAt,
        updatedAt: completedAt,
      })
      .where(eq(leadImports.id, leadImport.id));
    throw error;
  }
}
