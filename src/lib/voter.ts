import { cookies } from "next/headers";
import type { NextResponse } from "next/server";

const VOTER_COOKIE_NAME = "foia_voter";
const VOTER_COOKIE_LIFETIME_SECONDS = 60 * 60 * 24 * 7;

export async function getOrCreateVoterKey() {
  const cookieStore = await cookies();
  const existing = cookieStore.get(VOTER_COOKIE_NAME)?.value;

  if (existing) {
    return { voterKey: existing, created: false };
  }

  return {
    voterKey: crypto.randomUUID(),
    created: true,
  };
}

export function attachVoterCookie(response: NextResponse, voterKey: string) {
  response.cookies.set({
    name: VOTER_COOKIE_NAME,
    value: voterKey,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: VOTER_COOKIE_LIFETIME_SECONDS,
    path: "/",
  });
}
