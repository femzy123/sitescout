import { z } from "zod";

import type { AuditProgress } from "@/lib/audit-events";
import { requireOwnerContext } from "@/server/auth/owner-context";
import {
  formatAuditDiagnostic,
  isAuditDebugEnabled,
} from "@/server/services/audit/diagnostics";
import { runLeadAudit } from "@/server/services/audit/run-audit";

export const runtime = "nodejs";
export const maxDuration = 240;

const inputSchema = z.object({ leadId: z.string().uuid() });

export async function POST(request: Request) {
  const context = await requireOwnerContext();
  try {
    const { leadId } = inputSchema.parse(await request.json());
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const emit = async (event: AuditProgress) => {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        };
        try {
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
    console.error("[SiteScout audit:start]", error);
    const details = isAuditDebugEnabled()
      ? formatAuditDiagnostic(error)
      : undefined;
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Could not start analysis",
        ...(details ? { details } : {}),
      },
      { status: 400 },
    );
  }
}
