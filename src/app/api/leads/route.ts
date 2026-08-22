import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { requireOwnerContext } from "@/server/auth/owner-context";
import { getDb } from "@/server/db";
import {
  discoveryResults,
  leadEvents,
  leads,
  websiteAudits,
} from "@/server/db/schema";

const inputSchema = z.object({
  businessIds: z.array(z.string().uuid()).min(1).max(100),
});

const deleteInputSchema = z.object({
  leadIds: z.array(z.string().uuid()).min(1).max(200),
});

export async function POST(request: Request) {
  const context = await requireOwnerContext();
  try {
    const { businessIds } = inputSchema.parse(await request.json());
    const db = getDb();
    const created = [];
    for (const businessId of [...new Set(businessIds)]) {
      const [lead] = await db
        .insert(leads)
        .values({
          organizationId: context.organizationId,
          businessId,
          assignedTo: context.userId,
        })
        .onConflictDoNothing()
        .returning({ id: leads.id, businessId: leads.businessId });
      if (lead) {
        created.push(lead);
        await db.insert(leadEvents).values({
          organizationId: context.organizationId,
          leadId: lead.id,
          actorUserId: context.userId,
          type: "lead.created",
          metadata: { source: "discovery" },
        });
      }
    }
    await db
      .update(discoveryResults)
      .set({ state: "added" })
      .where(
        and(
          eq(discoveryResults.organizationId, context.organizationId),
          inArray(discoveryResults.businessId, businessIds),
        ),
      );
    const all = await db
      .select({ id: leads.id, businessId: leads.businessId })
      .from(leads)
      .where(
        and(
          eq(leads.organizationId, context.organizationId),
          inArray(leads.businessId, businessIds),
        ),
      );
    return Response.json({ createdCount: created.length, leads: all });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Could not create leads",
      },
      { status: 400 },
    );
  }
}

export async function DELETE(request: Request) {
  const context = await requireOwnerContext();
  try {
    const { leadIds } = deleteInputSchema.parse(await request.json());
    const uniqueLeadIds = [...new Set(leadIds)];
    const db = getDb();
    const ownedLeads = await db
      .select({ id: leads.id, businessId: leads.businessId })
      .from(leads)
      .where(
        and(
          eq(leads.organizationId, context.organizationId),
          inArray(leads.id, uniqueLeadIds),
        ),
      );

    if (!ownedLeads.length) return Response.json({ deletedCount: 0 });

    const activeAudits = await db
      .select({ leadId: websiteAudits.leadId })
      .from(websiteAudits)
      .where(
        and(
          eq(websiteAudits.organizationId, context.organizationId),
          inArray(
            websiteAudits.leadId,
            ownedLeads.map((lead) => lead.id),
          ),
          eq(websiteAudits.status, "running"),
        ),
      );

    if (activeAudits.length) {
      return Response.json(
        {
          error:
            "One or more selected leads are being analyzed. Wait for the audit to finish before deleting them.",
        },
        { status: 409 },
      );
    }

    const businessIds = ownedLeads.map((lead) => lead.businessId);
    const ownedIds = ownedLeads.map((lead) => lead.id);
    const [, deleted] = await db.batch([
      db
        .update(discoveryResults)
        .set({ state: "new" })
        .where(
          and(
            eq(discoveryResults.organizationId, context.organizationId),
            inArray(discoveryResults.businessId, businessIds),
          ),
        ),
      db
        .delete(leads)
        .where(
          and(
            eq(leads.organizationId, context.organizationId),
            inArray(leads.id, ownedIds),
          ),
        )
        .returning({ id: leads.id }),
    ]);

    return Response.json({ deletedCount: deleted.length });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Could not delete leads",
      },
      { status: 400 },
    );
  }
}
