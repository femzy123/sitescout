import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  doublePrecision,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
};

export const organizationRole = pgEnum("organization_role", [
  "owner",
  "member",
]);
export const provenance = pgEnum("provenance", [
  "provider",
  "import",
  "website",
  "manual",
  "ai",
  "system",
]);
export const leadImportStatus = pgEnum("lead_import_status", [
  "processing",
  "completed",
  "partial",
  "failed",
]);
export const searchStatus = pgEnum("search_status", [
  "running",
  "completed",
  "partial",
  "failed",
]);
export const websiteFilter = pgEnum("website_filter", [
  "any",
  "missing",
  "present",
  "unknown",
]);
export const candidateState = pgEnum("candidate_state", [
  "new",
  "selected",
  "added",
  "dismissed",
]);
export const websiteStatus = pgEnum("website_status", [
  "unknown",
  "missing",
  "reachable",
  "unreachable",
  "unsafe",
]);
export const auditStatus = pgEnum("audit_status", [
  "running",
  "completed",
  "failed",
  "cancelled",
]);
export const pipelineStage = pgEnum("pipeline_stage", [
  "new",
  "researching",
  "ready_to_contact",
  "contacted",
  "replied",
  "meeting",
  "proposal",
  "won",
  "lost",
]);
export const qualification = pgEnum("qualification", [
  "unqualified",
  "low",
  "medium",
  "high",
  "hot",
]);
export const scoreStatus = pgEnum("score_status", [
  "not_scored",
  "provisional",
  "complete",
]);
export const outreachType = pgEnum("outreach_type", [
  "call",
  "email",
  "dm",
  "meeting",
  "other",
]);
export const outreachDirection = pgEnum("outreach_direction", [
  "outbound",
  "inbound",
]);
export const outreachOutcome = pgEnum("outreach_outcome", [
  "no_answer",
  "voicemail",
  "sent",
  "replied",
  "interested",
  "not_interested",
  "meeting_booked",
  "other",
]);
export const aiGenerationType = pgEnum("ai_generation_type", [
  "lead_summary",
  "sales_angle",
  "call_brief",
  "cold_email",
  "dm",
  "follow_up",
  "audit_summary",
]);
export const followUpStatus = pgEnum("follow_up_status", [
  "pending",
  "completed",
  "cancelled",
]);

export const organizations = pgTable(
  "organizations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    timezone: text("timezone").default("UTC").notNull(),
    ...timestamps,
  },
  (table) => [uniqueIndex("organizations_slug_uidx").on(table.slug)],
);

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clerkUserId: text("clerk_user_id").notNull(),
    email: text("email").notNull(),
    displayName: text("display_name"),
    avatarUrl: text("avatar_url"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("users_clerk_user_id_uidx").on(table.clerkUserId),
    index("users_email_idx").on(table.email),
  ],
);

export const organizationMembers = pgTable(
  "organization_members",
  {
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: organizationRole("role").default("owner").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({
      name: "organization_members_pk",
      columns: [table.organizationId, table.userId],
    }),
    uniqueIndex("organization_members_organization_uidx").on(
      table.organizationId,
    ),
    uniqueIndex("organization_members_user_uidx").on(table.userId),
  ],
);

export const businesses = pgTable(
  "businesses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    googlePlaceId: text("google_place_id"),
    externalSource: text("external_source"),
    externalId: text("external_id"),
    normalizedDomain: text("normalized_domain"),
    normalizedName: text("normalized_name"),
    normalizedAddress: text("normalized_address"),
    name: text("name").notNull(),
    formattedAddress: text("formatted_address"),
    phone: text("phone"),
    websiteUrl: text("website_url"),
    googleMapsUrl: text("google_maps_url"),
    rating: doublePrecision("rating"),
    userRatingCount: integer("user_rating_count"),
    primaryCategory: text("primary_category"),
    categories: jsonb("categories").$type<string[]>().default([]).notNull(),
    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),
    businessStatus: text("business_status"),
    providerData: jsonb("provider_data")
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    manualOverrides: jsonb("manual_overrides")
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    source: provenance("source").default("provider").notNull(),
    lastProviderSyncAt: timestamp("last_provider_sync_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
    websiteCheckedAt: timestamp("website_checked_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("businesses_org_id_uidx").on(table.organizationId, table.id),
    uniqueIndex("businesses_org_google_place_uidx")
      .on(table.organizationId, table.googlePlaceId)
      .where(sql`${table.googlePlaceId} is not null`),
    uniqueIndex("businesses_org_external_uidx")
      .on(table.organizationId, table.externalSource, table.externalId)
      .where(
        sql`${table.externalSource} is not null and ${table.externalId} is not null`,
      ),
    index("businesses_org_domain_idx").on(
      table.organizationId,
      table.normalizedDomain,
    ),
    index("businesses_org_name_address_idx").on(
      table.organizationId,
      table.normalizedName,
      table.normalizedAddress,
    ),
    index("businesses_org_name_idx").on(table.organizationId, table.name),
  ],
);

export const discoverySearches = pgTable(
  "discovery_searches",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    createdBy: uuid("created_by").notNull(),
    query: text("query").notNull(),
    location: text("location").notNull(),
    category: text("category").notNull(),
    websiteFilter: websiteFilter("website_filter").default("any").notNull(),
    targetCount: integer("target_count").notNull(),
    status: searchStatus("status").default("running").notNull(),
    resultCount: integer("result_count").default(0).notNull(),
    providerPageCount: integer("provider_page_count").default(0).notNull(),
    isPartial: boolean("is_partial").default(false).notNull(),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("discovery_searches_org_id_uidx").on(
      table.organizationId,
      table.id,
    ),
    foreignKey({
      name: "discovery_searches_creator_membership_fk",
      columns: [table.organizationId, table.createdBy],
      foreignColumns: [
        organizationMembers.organizationId,
        organizationMembers.userId,
      ],
    }),
    check(
      "discovery_searches_target_count_check",
      sql`${table.targetCount} in (25, 50, 100)`,
    ),
    index("discovery_searches_org_created_idx").on(
      table.organizationId,
      table.createdAt,
    ),
  ],
);

export const discoveryResults = pgTable(
  "discovery_results",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    searchId: uuid("search_id").notNull(),
    businessId: uuid("business_id").notNull(),
    rank: integer("rank").notNull(),
    state: candidateState("state").default("new").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("discovery_results_search_business_uidx").on(
      table.searchId,
      table.businessId,
    ),
    foreignKey({
      name: "discovery_results_search_org_fk",
      columns: [table.organizationId, table.searchId],
      foreignColumns: [discoverySearches.organizationId, discoverySearches.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "discovery_results_business_org_fk",
      columns: [table.organizationId, table.businessId],
      foreignColumns: [businesses.organizationId, businesses.id],
    }).onDelete("restrict"),
    check("discovery_results_rank_check", sql`${table.rank} > 0`),
    index("discovery_results_org_state_idx").on(
      table.organizationId,
      table.state,
    ),
  ],
);

export const leads = pgTable(
  "leads",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    businessId: uuid("business_id").notNull(),
    assignedTo: uuid("assigned_to"),
    pipelineStage: pipelineStage("pipeline_stage").default("new").notNull(),
    qualification: qualification("qualification")
      .default("unqualified")
      .notNull(),
    qualificationOverridden: boolean("qualification_overridden")
      .default(false)
      .notNull(),
    scoreStatus: scoreStatus("score_status").default("not_scored").notNull(),
    opportunityScore: integer("opportunity_score"),
    websiteStatus: websiteStatus("website_status").default("unknown").notNull(),
    contactName: text("contact_name"),
    contactEmail: text("contact_email"),
    contactPhone: text("contact_phone"),
    lostReason: text("lost_reason"),
    stageChangedAt: timestamp("stage_changed_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    lastContactedAt: timestamp("last_contacted_at", { withTimezone: true }),
    nextFollowUpAt: timestamp("next_follow_up_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("leads_org_business_uidx").on(
      table.organizationId,
      table.businessId,
    ),
    uniqueIndex("leads_org_id_uidx").on(table.organizationId, table.id),
    foreignKey({
      name: "leads_assignee_membership_fk",
      columns: [table.organizationId, table.assignedTo],
      foreignColumns: [
        organizationMembers.organizationId,
        organizationMembers.userId,
      ],
    }),
    foreignKey({
      name: "leads_business_org_fk",
      columns: [table.organizationId, table.businessId],
      foreignColumns: [businesses.organizationId, businesses.id],
    }).onDelete("restrict"),
    check(
      "leads_opportunity_score_check",
      sql`${table.opportunityScore} is null or (${table.opportunityScore} between 0 and 100)`,
    ),
    index("leads_org_stage_idx").on(table.organizationId, table.pipelineStage),
    index("leads_org_qualification_idx").on(
      table.organizationId,
      table.qualification,
    ),
    index("leads_org_score_idx").on(
      table.organizationId,
      table.opportunityScore,
    ),
    index("leads_org_follow_up_idx").on(
      table.organizationId,
      table.nextFollowUpAt,
    ),
  ],
);

export const leadImports = pgTable(
  "lead_imports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    createdBy: uuid("created_by").notNull(),
    fileName: text("file_name").notNull(),
    sourceName: text("source_name").notNull(),
    status: leadImportStatus("status").default("processing").notNull(),
    totalRows: integer("total_rows").default(0).notNull(),
    processedRows: integer("processed_rows").default(0).notNull(),
    createdCount: integer("created_count").default(0).notNull(),
    updatedCount: integer("updated_count").default(0).notNull(),
    skippedCount: integer("skipped_count").default(0).notNull(),
    rejectedCount: integer("rejected_count").default(0).notNull(),
    columnMapping: jsonb("column_mapping")
      .$type<Record<string, string[]>>()
      .default({})
      .notNull(),
    errorSummary: jsonb("error_summary")
      .$type<Array<{ row: number; code: string; message: string }>>()
      .default([])
      .notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    foreignKey({
      name: "lead_imports_creator_membership_fk",
      columns: [table.organizationId, table.createdBy],
      foreignColumns: [
        organizationMembers.organizationId,
        organizationMembers.userId,
      ],
    }),
    check(
      "lead_imports_counts_check",
      sql`
        ${table.totalRows} >= 0 and
        ${table.processedRows} >= 0 and
        ${table.createdCount} >= 0 and
        ${table.updatedCount} >= 0 and
        ${table.skippedCount} >= 0 and
        ${table.rejectedCount} >= 0 and
        ${table.processedRows} <= ${table.totalRows}
      `,
    ),
    index("lead_imports_org_created_idx").on(
      table.organizationId,
      table.createdAt,
    ),
  ],
);

export const websiteAudits = pgTable(
  "website_audits",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    leadId: uuid("lead_id").notNull(),
    websiteUrl: text("website_url"),
    normalizedUrl: text("normalized_url"),
    status: auditStatus("status").default("running").notNull(),
    progress: integer("progress").default(0).notNull(),
    currentStage: text("current_stage").default("validating").notNull(),
    performanceScore: integer("performance_score"),
    seoScore: integer("seo_score"),
    accessibilityScore: integer("accessibility_score"),
    mobileScore: integer("mobile_score"),
    designScore: integer("design_score"),
    businessFunctionalityScore: integer("business_functionality_score"),
    overallWebsiteScore: integer("overall_website_score"),
    technicalFindings: jsonb("technical_findings")
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    businessFindings: jsonb("business_findings")
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    strengths: jsonb("strengths").$type<string[]>().default([]).notNull(),
    opportunities: jsonb("opportunities")
      .$type<string[]>()
      .default([])
      .notNull(),
    aiSummary: text("ai_summary"),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    durationMs: integer("duration_ms"),
    auditVersion: text("audit_version").default("v1").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("website_audits_active_uidx")
      .on(table.organizationId, table.leadId, table.normalizedUrl)
      .where(sql`${table.status} = 'running'`),
    foreignKey({
      name: "website_audits_lead_org_fk",
      columns: [table.organizationId, table.leadId],
      foreignColumns: [leads.organizationId, leads.id],
    }).onDelete("cascade"),
    check(
      "website_audits_progress_check",
      sql`${table.progress} between 0 and 100`,
    ),
    check(
      "website_audits_scores_check",
      sql`
    (${table.performanceScore} is null or ${table.performanceScore} between 0 and 100) and
    (${table.seoScore} is null or ${table.seoScore} between 0 and 100) and
    (${table.accessibilityScore} is null or ${table.accessibilityScore} between 0 and 100) and
    (${table.mobileScore} is null or ${table.mobileScore} between 0 and 100) and
    (${table.designScore} is null or ${table.designScore} between 0 and 100) and
    (${table.businessFunctionalityScore} is null or ${table.businessFunctionalityScore} between 0 and 100) and
    (${table.overallWebsiteScore} is null or ${table.overallWebsiteScore} between 0 and 100)
  `,
    ),
    index("website_audits_lead_created_idx").on(table.leadId, table.createdAt),
  ],
);

export const leadScores = pgTable(
  "lead_scores",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    leadId: uuid("lead_id").notNull(),
    auditId: uuid("audit_id").references(() => websiteAudits.id, {
      onDelete: "set null",
    }),
    ruleScore: integer("rule_score").notNull(),
    aiScore: integer("ai_score"),
    finalScore: integer("final_score").notNull(),
    isProvisional: boolean("is_provisional").default(false).notNull(),
    suggestedQualification: qualification("suggested_qualification").notNull(),
    evidence: jsonb("evidence")
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    summary: text("summary"),
    scoringVersion: text("scoring_version").default("v1").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      name: "lead_scores_lead_org_fk",
      columns: [table.organizationId, table.leadId],
      foreignColumns: [leads.organizationId, leads.id],
    }).onDelete("cascade"),
    check(
      "lead_scores_range_check",
      sql`
    ${table.ruleScore} between 0 and 100 and
    (${table.aiScore} is null or ${table.aiScore} between 0 and 100) and
    ${table.finalScore} between 0 and 100
  `,
    ),
    index("lead_scores_lead_created_idx").on(table.leadId, table.createdAt),
  ],
);

export const outreachActivities = pgTable(
  "outreach_activities",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    leadId: uuid("lead_id").notNull(),
    actorUserId: uuid("actor_user_id").notNull(),
    type: outreachType("type").notNull(),
    direction: outreachDirection("direction").default("outbound").notNull(),
    outcome: outreachOutcome("outcome"),
    subject: text("subject"),
    body: text("body"),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      name: "outreach_lead_org_fk",
      columns: [table.organizationId, table.leadId],
      foreignColumns: [leads.organizationId, leads.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "outreach_actor_org_fk",
      columns: [table.organizationId, table.actorUserId],
      foreignColumns: [
        organizationMembers.organizationId,
        organizationMembers.userId,
      ],
    }),
    index("outreach_lead_occurred_idx").on(table.leadId, table.occurredAt),
  ],
);

export const notes = pgTable(
  "notes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    leadId: uuid("lead_id").notNull(),
    authorUserId: uuid("author_user_id").notNull(),
    body: text("body").notNull(),
    ...timestamps,
  },
  (table) => [
    foreignKey({
      name: "notes_lead_org_fk",
      columns: [table.organizationId, table.leadId],
      foreignColumns: [leads.organizationId, leads.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "notes_author_org_fk",
      columns: [table.organizationId, table.authorUserId],
      foreignColumns: [
        organizationMembers.organizationId,
        organizationMembers.userId,
      ],
    }),
    index("notes_lead_created_idx").on(table.leadId, table.createdAt),
  ],
);

export const followUps = pgTable(
  "follow_ups",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    leadId: uuid("lead_id").notNull(),
    assignedTo: uuid("assigned_to").notNull(),
    title: text("title").notNull(),
    details: text("details"),
    status: followUpStatus("status").default("pending").notNull(),
    dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    foreignKey({
      name: "follow_ups_lead_org_fk",
      columns: [table.organizationId, table.leadId],
      foreignColumns: [leads.organizationId, leads.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "follow_ups_assignee_org_fk",
      columns: [table.organizationId, table.assignedTo],
      foreignColumns: [
        organizationMembers.organizationId,
        organizationMembers.userId,
      ],
    }),
    index("follow_ups_org_due_idx").on(
      table.organizationId,
      table.dueAt,
      table.completedAt,
    ),
  ],
);

export const aiGenerations = pgTable(
  "ai_generations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    leadId: uuid("lead_id").notNull(),
    type: aiGenerationType("type").notNull(),
    inputHash: text("input_hash").notNull(),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    content: text("content").notNull(),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      name: "ai_generations_lead_org_fk",
      columns: [table.organizationId, table.leadId],
      foreignColumns: [leads.organizationId, leads.id],
    }).onDelete("cascade"),
    uniqueIndex("ai_generations_input_uidx").on(
      table.leadId,
      table.type,
      table.inputHash,
    ),
  ],
);

export const leadEvents = pgTable(
  "lead_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    leadId: uuid("lead_id").notNull(),
    actorUserId: uuid("actor_user_id"),
    type: text("type").notNull(),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      name: "lead_events_lead_org_fk",
      columns: [table.organizationId, table.leadId],
      foreignColumns: [leads.organizationId, leads.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "lead_events_actor_org_fk",
      columns: [table.organizationId, table.actorUserId],
      foreignColumns: [
        organizationMembers.organizationId,
        organizationMembers.userId,
      ],
    }),
    index("lead_events_lead_occurred_idx").on(table.leadId, table.occurredAt),
  ],
);

export const organizationsRelations = relations(organizations, ({ many }) => ({
  members: many(organizationMembers),
  businesses: many(businesses),
  leads: many(leads),
  imports: many(leadImports),
}));
export const usersRelations = relations(users, ({ many }) => ({
  memberships: many(organizationMembers),
}));
export const organizationMembersRelations = relations(
  organizationMembers,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [organizationMembers.organizationId],
      references: [organizations.id],
    }),
    user: one(users, {
      fields: [organizationMembers.userId],
      references: [users.id],
    }),
  }),
);
export const businessesRelations = relations(businesses, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [businesses.organizationId],
    references: [organizations.id],
  }),
  leads: many(leads),
  discoveryResults: many(discoveryResults),
}));
export const leadImportsRelations = relations(leadImports, ({ one }) => ({
  organization: one(organizations, {
    fields: [leadImports.organizationId],
    references: [organizations.id],
  }),
  creator: one(users, {
    fields: [leadImports.createdBy],
    references: [users.id],
  }),
}));
export const leadsRelations = relations(leads, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [leads.organizationId],
    references: [organizations.id],
  }),
  business: one(businesses, {
    fields: [leads.businessId],
    references: [businesses.id],
  }),
  audits: many(websiteAudits),
  scores: many(leadScores),
  outreach: many(outreachActivities),
  notes: many(notes),
  followUps: many(followUps),
  generations: many(aiGenerations),
  events: many(leadEvents),
}));

export type Organization = typeof organizations.$inferSelect;
export type User = typeof users.$inferSelect;
export type Business = typeof businesses.$inferSelect;
export type Lead = typeof leads.$inferSelect;
export type LeadImport = typeof leadImports.$inferSelect;
export type WebsiteAudit = typeof websiteAudits.$inferSelect;
export type LeadScore = typeof leadScores.$inferSelect;
