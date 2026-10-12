import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";

export function isReadOnly(): boolean {
  // Missing or misspelled configuration must not open writes during a cutover.
  return env.FOIA_READ_ONLY !== "false";
}

export function maintenanceResponse() {
  return NextResponse.json(
    { error: "Posting and voting are temporarily paused while we move the board. Please try again shortly." },
    { status: 503, headers: { "Retry-After": "60", "Cache-Control": "no-store" } },
  );
}
