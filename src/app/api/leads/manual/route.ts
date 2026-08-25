import { ZodError } from "zod";

import { manualLeadRequestSchema } from "@/lib/lead-intake";
import { requireOwnerContext } from "@/server/auth/owner-context";
import {
  AmbiguousLeadMatchError,
  intakeLead,
} from "@/server/services/lead-intake";

export async function POST(request: Request) {
  const context = await requireOwnerContext();
  try {
    const input = manualLeadRequestSchema.parse(await request.json());
    return Response.json(await intakeLead(input, context, "manual"));
  } catch (error) {
    const status = error instanceof AmbiguousLeadMatchError ? 409 : 400;
    return Response.json(
      {
        error:
          error instanceof ZodError
            ? (error.issues[0]?.message ?? "Check the lead details")
            : error instanceof Error
              ? error.message
              : "Could not create the lead",
      },
      { status },
    );
  }
}
