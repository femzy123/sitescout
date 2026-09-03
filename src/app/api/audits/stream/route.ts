import { z } from "zod";
import { unstable_rethrow } from "next/navigation";

import type { AuditProgress } from "@/lib/audit-events";
import { requireOwnerContext } from "@/server/auth/owner-context";
import {
  formatAuditDiagnostic,
  isAuditDebugEnabled,
} from "@/server/services/audit/diagnostics";

export const runtime = "nodejs";
export const maxDuration = 240;

const inputSchema = z.object({ leadId: z.string().uuid() });

export async function POST(request: Request) {
  try {
    const context = await requireOwnerContext();
    const { leadId } = inputSchema.parse(await request.json());
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const emit = async (event: AuditProgress) => {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        };
        try {
          const { runLeadAudit } =
            await import("@/server/services/audit/run-audit");
          await runLeadAudit(leadId, context, emit);
        } catch (error) {
          console.error("[SiteScout audit:audit_fatal]", error);
          const details = isAuditDebugEnabled()
            ? formatAuditDiagnostic(error)
            : undefined;
          await emit({
            type: "error",
            progress: 100,
            stage: "audit_fatal",
            message: "Website analysis failed",
            leadId,
            ...(details ? { details } : {}),
          });
        } finally {
          controller.close();
        }
      },
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    unstable_rethrow(error);
    console.error("[SiteScout audit:start]", error);
    const details = isAuditDebugEnabled()
      ? formatAuditDiagnostic(error)
      : undefined;
    const isBadRequest =
      error instanceof z.ZodError || error instanceof SyntaxError;
    return Response.json(
      {
        error: isBadRequest
          ? "Invalid audit request"
          : "Could not start analysis",
        ...(details ? { details } : {}),
      },
      { status: isBadRequest ? 400 : 500 },
    );
  }
}
