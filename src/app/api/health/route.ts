export function GET() {
  return Response.json({ ok: true, service: "sitescout", worker: false });
}
