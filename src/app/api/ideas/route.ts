import { NextResponse } from "next/server";
import { createIdea, listIdeas } from "@/lib/db";
import { asTrimmedString } from "@/lib/validation";

const IDEA_TITLE_MIN_LENGTH = 3;
const IDEA_TITLE_MAX_LENGTH = 120;
const IDEA_DESCRIPTION_MIN_LENGTH = 10;
const IDEA_DESCRIPTION_MAX_LENGTH = 2000;

export async function GET() {
  try {
    const ideas = await listIdeas();
    return NextResponse.json({ ideas });
  } catch (error) {
    console.error("Failed to list ideas", error);
    return NextResponse.json(
      { error: "Failed to load ideas." },
      { status: 500 },
    );
  }
}

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

  const title = asTrimmedString(payload.title);
  const description = asTrimmedString(payload.description);

  if (
    title.length < IDEA_TITLE_MIN_LENGTH ||
    title.length > IDEA_TITLE_MAX_LENGTH
  ) {
    return NextResponse.json(
      {
        error: `Title must be ${IDEA_TITLE_MIN_LENGTH}-${IDEA_TITLE_MAX_LENGTH} characters.`,
      },
      { status: 400 },
    );
  }

  if (
    description.length < IDEA_DESCRIPTION_MIN_LENGTH ||
    description.length > IDEA_DESCRIPTION_MAX_LENGTH
  ) {
    return NextResponse.json(
      {
        error: `Description must be ${IDEA_DESCRIPTION_MIN_LENGTH}-${IDEA_DESCRIPTION_MAX_LENGTH} characters.`,
      },
      { status: 400 },
    );
  }

  try {
    const idea = await createIdea({ title, description });
    return NextResponse.json({ idea }, { status: 201 });
  } catch (error) {
    console.error("Failed to create idea", error);
    return NextResponse.json(
      { error: "Failed to create idea." },
      { status: 500 },
    );
  }
}
