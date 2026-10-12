export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(
    { project: "foia.fun", revision: process.env.FOIA_BUILD_REVISION },
    { headers: { "Cache-Control": "no-store" } },
  );
}
