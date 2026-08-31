import { ZodError } from "zod";

import { requireOwnerContext } from "@/server/auth/owner-context";
import { discoveryInputSchema, runDiscovery } from "@/server/services/places";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const context = await requireOwnerContext();
  try {
    const input = discoveryInputSchema.parse(await request.json());
    return Response.json(await runDiscovery(input, context));
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      return Response.json(
        { error: "Invalid discovery search request." },
        { status: 400 },
      );
    }
    console.error("Discovery search failed", error);
    return Response.json(
      { error: "Discovery search failed. Please try again." },
      { status: 500 },
    );
  }
}
