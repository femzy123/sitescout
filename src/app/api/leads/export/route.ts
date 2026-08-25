import { ZodError } from "zod";

import {
  leadExportFilename,
  leadExportRequestSchema,
  serializeLeadExport,
} from "@/lib/lead-export";
import { requireOwnerContext } from "@/server/auth/owner-context";
import { getLeadExportRows } from "@/server/services/leads";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const context = await requireOwnerContext();
  try {
    const input = leadExportRequestSchema.parse(await request.json());
    const selectedIds = input.scope === "selected" ? input.leadIds : undefined;
    const rows = await getLeadExportRows(context.organizationId, selectedIds);

    if (input.scope === "selected" && rows.length !== input.leadIds.length) {
      return Response.json(
        {
          error:
            "One or more selected leads are no longer available. Refresh the page and try again.",
        },
        { status: 409 },
      );
    }
    if (!rows.length) {
      return Response.json(
        { error: "There are no leads available to export." },
        { status: 404 },
      );
    }

    const filename = leadExportFilename(input.scope);
    return new Response(serializeLeadExport(rows), {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Type": "text/csv; charset=utf-8",
      },
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof ZodError
            ? (error.issues[0]?.message ?? "Check the export request")
            : error instanceof Error
              ? error.message
              : "Could not export leads",
      },
      { status: 400 },
    );
  }
}
