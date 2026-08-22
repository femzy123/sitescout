import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { requireOwnerContext } from "@/server/auth/owner-context";
import { getDb } from "@/server/db";
import { aiGenerations, leadEvents } from "@/server/db/schema";
import { getAIService } from "@/server/services/ai/service";
import { getLeadDetail } from "@/server/services/leads";
import { getServerEnv } from "@/lib/env";

const inputSchema = z.object({
  leadId: z.string().uuid(),
  type: z.enum([
    "lead_summary",
    "sales_angle",
    "call_brief",
    "cold_email",
    "dm",
    "follow_up",
  ]),
});

export async function POST(request: Request) {
  const context = await requireOwnerContext();
  try {
    const input = inputSchema.parse(await request.json());
    const detail = await getLeadDetail(context.organizationId, input.leadId);
    if (!detail)
      return Response.json({ error: "Lead not found" }, { status: 404 });
    const evidence = {
      business: detail.lead.business,
      score: detail.scores[0],
      audit: detail.audits[0],
      outreachHistory: detail.outreach.slice(0, 5),
    };
    const inputHash = createHash("sha256")
      .update(JSON.stringify({ type: input.type, evidence }))
      .digest("hex");
    const db = getDb();
    const [cached] = await db
      .select({ content: aiGenerations.content })
      .from(aiGenerations)
      .where(
        and(
          eq(aiGenerations.leadId, input.leadId),
          eq(aiGenerations.type, input.type),
          eq(aiGenerations.inputHash, inputHash),
        ),
      )
      .limit(1);
    if (cached) return Response.json({ content: cached.content, cached: true });
    const content = await getAIService().generateOutreach(input.type, evidence);
    const env = getServerEnv();
    await db.insert(aiGenerations).values({
      organizationId: context.organizationId,
      leadId: input.leadId,
      type: input.type,
      inputHash,
      provider: "gemini",
      model: env.AI_MODEL,
      content,
    });
    await db.insert(leadEvents).values({
      organizationId: context.organizationId,
      leadId: input.leadId,
      actorUserId: context.userId,
      type: "ai.generated",
      metadata: { generationType: input.type },
    });
    return Response.json({ content, cached: false });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Generation failed" },
      { status: 400 },
    );
  }
}
