import { neon } from "@neondatabase/serverless";
import type { Comment, Idea, VoteTargetType } from "@/lib/types";

type IdeaRow = {
  id: string;
  title: string;
  description: string;
  created_at: string;
  votes: number | string;
  comment_count: number | string;
};

type CommentRow = {
  id: string;
  idea_id: string;
  body: string;
  created_at: string;
  votes: number | string;
};

type CountRow = {
  votes: number | string;
};

export type AddVoteResult = {
  status: "added" | "already_voted" | "missing_target";
  votes: number;
};

let schemaReady: Promise<void> | null = null;

function getSql() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not configured.");
  }

  return neon(databaseUrl);
}

function toNumber(value: number | string | null | undefined): number {
  return Number(value ?? 0);
}

function toIsoString(value: string): string {
  return new Date(value).toISOString();
}

async function initSchema() {
  const sql = getSql();

  await sql`
    CREATE TABLE IF NOT EXISTS ideas (
      id UUID PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS comments (
      id UUID PRIMARY KEY,
      idea_id UUID NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
      body TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS votes (
      id BIGSERIAL PRIMARY KEY,
      target_type TEXT NOT NULL CHECK (target_type IN ('idea', 'comment')),
      target_id UUID NOT NULL,
      voter_key TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (target_type, target_id, voter_key)
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_comments_idea_id ON comments (idea_id)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_votes_target ON votes (target_type, target_id)
  `;
}

export async function ensureSchema() {
  if (!schemaReady) {
    schemaReady = initSchema();
  }

  return schemaReady;
}

export async function listIdeas(): Promise<Idea[]> {
  await ensureSchema();
  const sql = getSql();

  const rows = (await sql`
    SELECT
      i.id,
      i.title,
      i.description,
      i.created_at,
      COALESCE(iv.vote_count, 0)::int AS votes,
      COALESCE(cc.comment_count, 0)::int AS comment_count
    FROM ideas i
    LEFT JOIN (
      SELECT target_id, COUNT(*)::int AS vote_count
      FROM votes
      WHERE target_type = 'idea'
      GROUP BY target_id
    ) iv ON iv.target_id = i.id
    LEFT JOIN (
      SELECT idea_id, COUNT(*)::int AS comment_count
      FROM comments
      GROUP BY idea_id
    ) cc ON cc.idea_id = i.id
    ORDER BY COALESCE(iv.vote_count, 0) DESC, i.created_at DESC
  `) as IdeaRow[];

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    createdAt: toIsoString(row.created_at),
    votes: toNumber(row.votes),
    commentCount: toNumber(row.comment_count),
  }));
}

export async function ideaExists(ideaId: string): Promise<boolean> {
  await ensureSchema();
  const sql = getSql();

  const rows = (await sql`
    SELECT id
    FROM ideas
    WHERE id = CAST(${ideaId} AS UUID)
    LIMIT 1
  `) as Array<{ id: string }>;

  return rows.length > 0;
}

export async function createIdea(input: {
  title: string;
  description: string;
}): Promise<Idea> {
  await ensureSchema();
  const sql = getSql();
  const id = crypto.randomUUID();

  const rows = (await sql`
    INSERT INTO ideas (id, title, description)
    VALUES (${id}, ${input.title}, ${input.description})
    RETURNING id, title, description, created_at
  `) as Array<Omit<IdeaRow, "votes" | "comment_count">>;

  const row = rows[0];

  return {
    id: row.id,
    title: row.title,
    description: row.description,
    createdAt: toIsoString(row.created_at),
    votes: 0,
    commentCount: 0,
  };
}

export async function listComments(ideaId: string): Promise<Comment[]> {
  await ensureSchema();
  const sql = getSql();

  const rows = (await sql`
    SELECT
      c.id,
      c.idea_id,
      c.body,
      c.created_at,
      COALESCE(cv.vote_count, 0)::int AS votes
    FROM comments c
    LEFT JOIN (
      SELECT target_id, COUNT(*)::int AS vote_count
      FROM votes
      WHERE target_type = 'comment'
      GROUP BY target_id
    ) cv ON cv.target_id = c.id
    WHERE c.idea_id = CAST(${ideaId} AS UUID)
    ORDER BY COALESCE(cv.vote_count, 0) DESC, c.created_at DESC
  `) as CommentRow[];

  return rows.map((row) => ({
    id: row.id,
    ideaId: row.idea_id,
    body: row.body,
    createdAt: toIsoString(row.created_at),
    votes: toNumber(row.votes),
  }));
}

export async function createComment(input: {
  ideaId: string;
  body: string;
}): Promise<Comment> {
  await ensureSchema();
  const sql = getSql();
  const id = crypto.randomUUID();

  const rows = (await sql`
    INSERT INTO comments (id, idea_id, body)
    VALUES (${id}, CAST(${input.ideaId} AS UUID), ${input.body})
    RETURNING id, idea_id, body, created_at
  `) as Array<Omit<CommentRow, "votes">>;

  const row = rows[0];

  return {
    id: row.id,
    ideaId: row.idea_id,
    body: row.body,
    createdAt: toIsoString(row.created_at),
    votes: 0,
  };
}

export async function addVote(input: {
  targetType: VoteTargetType;
  targetId: string;
  voterKey: string;
}): Promise<AddVoteResult> {
  await ensureSchema();
  const sql = getSql();

  const targetRows =
    input.targetType === "idea"
      ? ((await sql`
          SELECT id
          FROM ideas
          WHERE id = CAST(${input.targetId} AS UUID)
          LIMIT 1
        `) as Array<{ id: string }>)
      : ((await sql`
          SELECT id
          FROM comments
          WHERE id = CAST(${input.targetId} AS UUID)
          LIMIT 1
        `) as Array<{ id: string }>);

  if (targetRows.length === 0) {
    return { status: "missing_target", votes: 0 };
  }

  const insertedRows = (await sql`
    INSERT INTO votes (target_type, target_id, voter_key)
    VALUES (${input.targetType}, CAST(${input.targetId} AS UUID), ${input.voterKey})
    ON CONFLICT (target_type, target_id, voter_key) DO NOTHING
    RETURNING id
  `) as Array<{ id: number }>;

  const countRows = (await sql`
    SELECT COUNT(*)::int AS votes
    FROM votes
    WHERE target_type = ${input.targetType}
      AND target_id = CAST(${input.targetId} AS UUID)
  `) as CountRow[];

  return {
    status: insertedRows.length > 0 ? "added" : "already_voted",
    votes: toNumber(countRows[0]?.votes),
  };
}
