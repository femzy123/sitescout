import { discoveryInputSchema, runDiscovery } from "@/server/services/places";
import { requireOwnerContext } from "@/server/auth/owner-context";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const context = await requireOwnerContext();
  try {
    const input = discoveryInputSchema.parse(await request.json());
    return Response.json(await runDiscovery(input, context));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Discovery failed";
    return Response.json({ error: message }, { status: 400 });
  }
}
