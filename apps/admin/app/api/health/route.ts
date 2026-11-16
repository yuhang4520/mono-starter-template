/** Liveness only: an unavailable dependency must not cause a restart loop. */
export function GET() {
  return Response.json({ status: "ok" });
}
