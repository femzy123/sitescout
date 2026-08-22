import { and, count, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";

import { getDb } from "@/server/db";
import { businesses, followUps, leadEvents, leads } from "@/server/db/schema";

export async function getDashboardData(organizationId: string) {
  const db = getDb();
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [totals, due, wonThisWeek, stageRows, priority, activity] =
    await Promise.all([
      db
        .select({
          total: count(),
          qualified: sql<number>`count(*) filter (where ${leads.qualification} in ('high', 'hot'))`,
        })
        .from(leads)
        .where(eq(leads.organizationId, organizationId)),
      db
        .select({ count: count() })
        .from(followUps)
        .where(
          and(
            eq(followUps.organizationId, organizationId),
            eq(followUps.status, "pending"),
            lte(followUps.dueAt, now),
          ),
        ),
      db
        .select({ count: count() })
        .from(leads)
        .where(
          and(
            eq(leads.organizationId, organizationId),
            eq(leads.pipelineStage, "won"),
            gte(leads.stageChangedAt, weekAgo),
          ),
        ),
      db
        .select({ stage: leads.pipelineStage, count: count() })
        .from(leads)
        .where(eq(leads.organizationId, organizationId))
        .groupBy(leads.pipelineStage),
      db
        .select({
          id: leads.id,
          name: businesses.name,
          category: businesses.primaryCategory,
          score: leads.opportunityScore,
          qualification: leads.qualification,
          stage: leads.pipelineStage,
          followUp: leads.nextFollowUpAt,
        })
        .from(leads)
        .innerJoin(businesses, eq(businesses.id, leads.businessId))
        .where(
          and(
            eq(leads.organizationId, organizationId),
            inArray(leads.pipelineStage, [
              "new",
              "researching",
              "ready_to_contact",
              "contacted",
            ]),
          ),
        )
        .orderBy(desc(leads.opportunityScore), leads.nextFollowUpAt)
        .limit(5),
      db
        .select({
          id: leadEvents.id,
          leadId: leadEvents.leadId,
          type: leadEvents.type,
          occurredAt: leadEvents.occurredAt,
          name: businesses.name,
        })
        .from(leadEvents)
        .innerJoin(
          leads,
          and(
            eq(leads.id, leadEvents.leadId),
            eq(leads.organizationId, leadEvents.organizationId),
          ),
        )
        .innerJoin(businesses, eq(businesses.id, leads.businessId))
        .where(eq(leadEvents.organizationId, organizationId))
        .orderBy(desc(leadEvents.occurredAt))
        .limit(6),
    ]);

  const stages = Object.fromEntries(
    stageRows.map((row) => [row.stage, Number(row.count)]),
  );
  return {
    totalLeads: Number(totals[0]?.total ?? 0),
    qualifiedLeads: Number(totals[0]?.qualified ?? 0),
    dueFollowUps: Number(due[0]?.count ?? 0),
    wonThisWeek: Number(wonThisWeek[0]?.count ?? 0),
    stages,
    priority,
    activity,
  };
}
