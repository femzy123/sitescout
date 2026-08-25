import { ZodError } from "zod";

import { csvImportRequestSchema } from "@/lib/lead-intake";
import { requireOwnerContext } from "@/server/auth/owner-context";
import { importLeadRows } from "@/server/services/lead-intake";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  const context = await requireOwnerContext();
  try {
    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > 6 * 1024 * 1024) {
      return Response.json(
        { error: "The parsed CSV request is too large" },
        { status: 413 },
      );
    }
    const input = csvImportRequestSchema.parse(await request.json());
    return Response.json(await importLeadRows(input, context));
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof ZodError
            ? (error.issues[0]?.message ?? "Check the import data")
            : error instanceof Error
              ? error.message
              : "Could not import leads",
      },
      { status: 400 },
    );
  }
}
