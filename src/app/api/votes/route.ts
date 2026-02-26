import { NextResponse } from "next/server";
import { addVote } from "@/lib/db";
import { attachVoterCookie, getOrCreateVoterKey } from "@/lib/voter";
import { asTrimmedString, isValidUuid, isVoteTargetType } from "@/lib/validation";

export async function POST(request: Request) {
  let payload: Record<string, unknown>;

  try {
    const json = (await request.json()) as unknown;
    payload = (json ?? {}) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  const rawTargetType = asTrimmedString(payload.targetType);
  const targetId = asTrimmedString(payload.targetId);

  if (!isVoteTargetType(rawTargetType)) {
    return NextResponse.json(
      { error: "Invalid vote target type." },
      { status: 400 },
    );
  }

  if (!isValidUuid(targetId)) {
    return NextResponse.json({ error: "Invalid target id." }, { status: 400 });
  }

  try {
    const { voterKey, created } = await getOrCreateVoterKey();
    const result = await addVote({
      targetType: rawTargetType,
      targetId,
      voterKey,
    });

    if (result.status === "missing_target") {
      return NextResponse.json({ error: "Target not found." }, { status: 404 });
    }

    const statusCode = result.status === "added" ? 201 : 200;
    const response = NextResponse.json(
      {
        status: result.status,
        votes: result.votes,
      },
      { status: statusCode },
    );

    if (created) {
      attachVoterCookie(response, voterKey);
    }

    return response;
  } catch (error) {
    console.error("Failed to submit vote", error);
    return NextResponse.json(
      { error: "Failed to submit vote." },
      { status: 500 },
    );
  }
}
