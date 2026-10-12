import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const url = new URL(request.url);
  if (url.hostname === "www.foia.fun") {
    url.protocol = "https:";
    url.hostname = "foia.fun";
    url.port = "";
    return NextResponse.redirect(url, 308);
  }
  return NextResponse.next();
}
