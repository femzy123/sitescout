import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { requireOwnerContext } from "@/server/auth/owner-context";
import { getDb } from "@/server/db";
import { discoveryResults } from "@/server/db/schema";

const inputSchema = z.object({
  resultIds: z.array(z.string().uuid()).min(1).max(100),
});

export async function DELETE(request: Request) {
  const context = await requireOwnerContext();
  try {
    const { resultIds } = inputSchema.parse(await request.json());
    const deleted = await getDb()
      .delete(discoveryResults)
      .where(
        and(
          eq(discoveryResults.organizationId, context.organizationId),
          inArray(discoveryResults.id, [...new Set(resultIds)]),
        ),
      )
      .returning({ id: discoveryResults.id });

    return Response.json({ deletedCount: deleted.length });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not delete discovery results",
      },
      { status: 400 },
    );
  }
}
