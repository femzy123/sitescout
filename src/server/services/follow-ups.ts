import { and, asc, eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { businesses, followUps, leads } from "@/server/db/schema";

export async function getPendingFollowUps(organizationId: string) {
  return getDb()
    .select({
      id: followUps.id,
      leadId: followUps.leadId,
      title: followUps.title,
      details: followUps.details,
      dueAt: followUps.dueAt,
      status: followUps.status,
      businessName: businesses.name,
      score: leads.opportunityScore,
      stage: leads.pipelineStage,
    })
    .from(followUps)
    .innerJoin(
      leads,
      and(
        eq(leads.id, followUps.leadId),
        eq(leads.organizationId, followUps.organizationId),
      ),
    )
    .innerJoin(businesses, eq(businesses.id, leads.businessId))
    .where(
      and(
        eq(followUps.organizationId, organizationId),
        eq(followUps.status, "pending"),
      ),
    )
    .orderBy(asc(followUps.dueAt));
}
