import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { requireOwnerContext } from "@/server/auth/owner-context";
import { getDb } from "@/server/db";
import { leadEvents, leads } from "@/server/db/schema";

const schema = z.object({
  stage: z.enum([
    "new",
    "researching",
    "ready_to_contact",
    "contacted",
    "replied",
    "meeting",
    "proposal",
    "won",
    "lost",
  ]),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await requireOwnerContext();
  try {
    const { id } = await params;
    z.string().uuid().parse(id);
    const { stage } = schema.parse(await request.json());
    const db = getDb();
    await db
      .update(leads)
      .set({
        pipelineStage: stage,
        stageChangedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(eq(leads.organizationId, context.organizationId), eq(leads.id, id)),
      );
    await db.insert(leadEvents).values({
      organizationId: context.organizationId,
      leadId: id,
      actorUserId: context.userId,
      type: "pipeline.changed",
      metadata: { stage },
    });
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Could not update stage",
      },
      { status: 400 },
    );
  }
}
