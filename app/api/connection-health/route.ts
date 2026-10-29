/** No session, database or provider dependency: only test reachability of this origin. */
export function GET() {
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store, max-age=0" } });
}
