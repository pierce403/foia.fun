import { NextResponse } from "next/server";
import { createComment, ideaExists, listComments } from "@/lib/db";
import { asTrimmedString, isValidUuid } from "@/lib/validation";

const COMMENT_MIN_LENGTH = 1;
const COMMENT_MAX_LENGTH = 600;

type RouteContext = {
  params: Promise<{
    ideaId: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { ideaId } = await context.params;

  if (!isValidUuid(ideaId)) {
    return NextResponse.json({ error: "Invalid idea id." }, { status: 400 });
  }

  try {
    const exists = await ideaExists(ideaId);

    if (!exists) {
      return NextResponse.json({ error: "Idea not found." }, { status: 404 });
    }

    const comments = await listComments(ideaId);
    return NextResponse.json({ comments });
  } catch (error) {
    console.error("Failed to list comments", error);
    return NextResponse.json(
      { error: "Failed to load comments." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request, context: RouteContext) {
  const { ideaId } = await context.params;

  if (!isValidUuid(ideaId)) {
    return NextResponse.json({ error: "Invalid idea id." }, { status: 400 });
  }

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

  const body = asTrimmedString(payload.body);

  if (body.length < COMMENT_MIN_LENGTH || body.length > COMMENT_MAX_LENGTH) {
    return NextResponse.json(
      {
        error: `Comment must be ${COMMENT_MIN_LENGTH}-${COMMENT_MAX_LENGTH} characters.`,
      },
      { status: 400 },
    );
  }

  try {
    const exists = await ideaExists(ideaId);

    if (!exists) {
      return NextResponse.json({ error: "Idea not found." }, { status: 404 });
    }

    const comment = await createComment({ ideaId, body });
    return NextResponse.json({ comment }, { status: 201 });
  } catch (error) {
    console.error("Failed to create comment", error);
    return NextResponse.json(
      { error: "Failed to create comment." },
      { status: 500 },
    );
  }
}
