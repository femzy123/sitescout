import { and, desc, eq, ilike, or } from "drizzle-orm";

import { getDb } from "@/server/db";
import {
  aiGenerations,
  businesses,
  followUps,
  leadEvents,
  leadScores,
  leads,
  notes,
  outreachActivities,
  websiteAudits,
} from "@/server/db/schema";

export type LeadListRow = Awaited<ReturnType<typeof getLeads>>[number];

export async function getLeads(organizationId: string, search?: string) {
  const db = getDb();
  const query = search?.trim();
  return db
    .select({
      id: leads.id,
      businessId: leads.businessId,
      name: businesses.name,
      category: businesses.primaryCategory,
      address: businesses.formattedAddress,
      phone: businesses.phone,
      websiteUrl: businesses.websiteUrl,
      rating: businesses.rating,
      reviewCount: businesses.userRatingCount,
      stage: leads.pipelineStage,
      qualification: leads.qualification,
      scoreStatus: leads.scoreStatus,
      opportunityScore: leads.opportunityScore,
      websiteStatus: leads.websiteStatus,
      nextFollowUpAt: leads.nextFollowUpAt,
      updatedAt: leads.updatedAt,
    })
    .from(leads)
    .innerJoin(businesses, eq(businesses.id, leads.businessId))
    .where(
      and(
        eq(leads.organizationId, organizationId),
        query
          ? or(
              ilike(businesses.name, `%${query}%`),
              ilike(businesses.formattedAddress, `%${query}%`),
              ilike(businesses.primaryCategory, `%${query}%`),
            )
          : undefined,
      ),
    )
    .orderBy(desc(leads.opportunityScore), desc(leads.updatedAt))
    .limit(200);
}

export async function getLeadDetail(organizationId: string, leadId: string) {
  const db = getDb();
  const [lead] = await db
    .select({
      id: leads.id,
      organizationId: leads.organizationId,
      businessId: leads.businessId,
      stage: leads.pipelineStage,
      qualification: leads.qualification,
      qualificationOverridden: leads.qualificationOverridden,
      scoreStatus: leads.scoreStatus,
      opportunityScore: leads.opportunityScore,
      websiteStatus: leads.websiteStatus,
      contactName: leads.contactName,
      contactEmail: leads.contactEmail,
      contactPhone: leads.contactPhone,
      lastContactedAt: leads.lastContactedAt,
      nextFollowUpAt: leads.nextFollowUpAt,
      createdAt: leads.createdAt,
      business: {
        name: businesses.name,
        address: businesses.formattedAddress,
        phone: businesses.phone,
        websiteUrl: businesses.websiteUrl,
        mapsUrl: businesses.googleMapsUrl,
        rating: businesses.rating,
        reviewCount: businesses.userRatingCount,
        category: businesses.primaryCategory,
      },
    })
    .from(leads)
    .innerJoin(businesses, eq(businesses.id, leads.businessId))
    .where(and(eq(leads.organizationId, organizationId), eq(leads.id, leadId)))
    .limit(1);

  if (!lead) return null;
  const [audits, scores, leadNotes, followups, outreach, events, generations] =
    await Promise.all([
      db
        .select()
        .from(websiteAudits)
        .where(
          and(
            eq(websiteAudits.organizationId, organizationId),
            eq(websiteAudits.leadId, leadId),
          ),
        )
        .orderBy(desc(websiteAudits.createdAt)),
      db
        .select()
        .from(leadScores)
        .where(
          and(
            eq(leadScores.organizationId, organizationId),
            eq(leadScores.leadId, leadId),
          ),
        )
        .orderBy(desc(leadScores.createdAt)),
      db
        .select()
        .from(notes)
        .where(
          and(
            eq(notes.organizationId, organizationId),
            eq(notes.leadId, leadId),
          ),
        )
        .orderBy(desc(notes.createdAt)),
      db
        .select()
        .from(followUps)
        .where(
          and(
            eq(followUps.organizationId, organizationId),
            eq(followUps.leadId, leadId),
          ),
        )
        .orderBy(desc(followUps.dueAt)),
      db
        .select()
        .from(outreachActivities)
        .where(
          and(
            eq(outreachActivities.organizationId, organizationId),
            eq(outreachActivities.leadId, leadId),
          ),
        )
        .orderBy(desc(outreachActivities.occurredAt)),
      db
        .select()
        .from(leadEvents)
        .where(
          and(
            eq(leadEvents.organizationId, organizationId),
            eq(leadEvents.leadId, leadId),
          ),
        )
        .orderBy(desc(leadEvents.occurredAt))
        .limit(50),
      db
        .select()
        .from(aiGenerations)
        .where(
          and(
            eq(aiGenerations.organizationId, organizationId),
            eq(aiGenerations.leadId, leadId),
          ),
        )
        .orderBy(desc(aiGenerations.createdAt)),
    ]);
  return {
    lead,
    audits,
    scores,
    notes: leadNotes,
    followups,
    outreach,
    events,
    generations,
  };
}
