import {
  BlobError,
  BlobNotFoundError,
  get,
  list,
  put,
  type ListBlobResultBlob,
} from "@vercel/blob";
import type { Comment, Idea, VoteTargetType } from "@/lib/types";

type IdeaRecord = {
  id: string;
  title: string;
  description: string;
  createdAt: string;
};

type CommentRecord = {
  id: string;
  ideaId: string;
  body: string;
  createdAt: string;
};

type VoteRecord = {
  targetType: VoteTargetType;
  targetId: string;
  voterKey: string;
  createdAt: string;
};

export type AddVoteResult = {
  status: "added" | "already_voted" | "missing_target";
  votes: number;
};

const ROOT_PREFIX = "foia-board/v1";
const IDEAS_PREFIX = `${ROOT_PREFIX}/ideas/`;
const COMMENTS_PREFIX = `${ROOT_PREFIX}/comments/`;
const VOTES_PREFIX = `${ROOT_PREFIX}/votes/`;

function ideaPath(ideaId: string): string {
  return `${IDEAS_PREFIX}${ideaId}.json`;
}

function commentPath(commentId: string): string {
  return `${COMMENTS_PREFIX}${commentId}.json`;
}

function votePath(
  targetType: VoteTargetType,
  targetId: string,
  voterKey: string,
): string {
  return `${VOTES_PREFIX}${targetType}/${targetId}/${voterKey}.json`;
}

function voteTargetPrefix(targetType: VoteTargetType, targetId: string): string {
  return `${VOTES_PREFIX}${targetType}/${targetId}/`;
}

function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

function isAlreadyExistsError(error: unknown): boolean {
  if (!(error instanceof BlobError)) {
    return false;
  }

  const message = error.message.toLowerCase();

  return (
    message.includes("already exists") ||
    message.includes("already taken") ||
    message.includes("conflict")
  );
}

function voteCountMapFromBlobs(
  blobs: ListBlobResultBlob[],
  targetType: VoteTargetType,
): Map<string, number> {
  const prefix = `${VOTES_PREFIX}${targetType}/`;
  const counts = new Map<string, number>();

  for (const blob of blobs) {
    if (!blob.pathname.startsWith(prefix)) {
      continue;
    }

    const relativePath = blob.pathname.slice(prefix.length);
    const targetId = relativePath.split("/")[0];

    if (!targetId) {
      continue;
    }

    counts.set(targetId, (counts.get(targetId) ?? 0) + 1);
  }

  return counts;
}

function sortIdeas(ideas: Idea[]): Idea[] {
  return [...ideas].sort(
    (a, b) => b.votes - a.votes || Date.parse(b.createdAt) - Date.parse(a.createdAt),
  );
}

function sortComments(comments: Comment[]): Comment[] {
  return [...comments].sort(
    (a, b) =>
      b.votes - a.votes || Date.parse(b.createdAt) - Date.parse(a.createdAt),
  );
}

async function listAllBlobs(prefix: string): Promise<ListBlobResultBlob[]> {
  const blobs: ListBlobResultBlob[] = [];
  let cursor: string | undefined;

  do {
    const page = await list({ prefix, cursor, limit: 1000 });
    blobs.push(...page.blobs);

    if (page.hasMore && page.cursor) {
      cursor = page.cursor;
    } else {
      cursor = undefined;
    }
  } while (cursor);

  return blobs;
}

async function readBlobJson<T>(pathname: string): Promise<T | null> {
  try {
    const result = await get(pathname, { access: "private" });

    if (!result || result.statusCode !== 200 || !result.stream) {
      return null;
    }

    const raw = await new Response(result.stream).text();

    if (!raw) {
      return null;
    }

    return JSON.parse(raw) as T;
  } catch (error) {
    if (error instanceof BlobNotFoundError) {
      return null;
    }

    throw error;
  }
}

async function writeBlobJson(pathname: string, value: unknown): Promise<void> {
  await put(pathname, JSON.stringify(value), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: false,
    contentType: "application/json",
  });
}

async function listIdeaRecords(): Promise<IdeaRecord[]> {
  const blobs = await listAllBlobs(IDEAS_PREFIX);
  const records = await Promise.all(
    blobs.map((blob) => readBlobJson<IdeaRecord>(blob.pathname)),
  );

  return records.filter(isDefined);
}

async function listCommentRecords(): Promise<CommentRecord[]> {
  const blobs = await listAllBlobs(COMMENTS_PREFIX);
  const records = await Promise.all(
    blobs.map((blob) => readBlobJson<CommentRecord>(blob.pathname)),
  );

  return records.filter(isDefined);
}

async function commentExists(commentId: string): Promise<boolean> {
  const comment = await readBlobJson<CommentRecord>(commentPath(commentId));
  return Boolean(comment);
}

async function countVotesForTarget(
  targetType: VoteTargetType,
  targetId: string,
): Promise<number> {
  const voteBlobs = await listAllBlobs(voteTargetPrefix(targetType, targetId));
  return voteBlobs.length;
}

export async function listIdeas(): Promise<Idea[]> {
  const [ideaRecords, commentRecords, ideaVoteBlobs] = await Promise.all([
    listIdeaRecords(),
    listCommentRecords(),
    listAllBlobs(`${VOTES_PREFIX}idea/`),
  ]);

  const commentCounts = new Map<string, number>();

  for (const comment of commentRecords) {
    commentCounts.set(comment.ideaId, (commentCounts.get(comment.ideaId) ?? 0) + 1);
  }

  const voteCounts = voteCountMapFromBlobs(ideaVoteBlobs, "idea");

  return sortIdeas(
    ideaRecords.map((record) => ({
      id: record.id,
      title: record.title,
      description: record.description,
      createdAt: record.createdAt,
      votes: voteCounts.get(record.id) ?? 0,
      commentCount: commentCounts.get(record.id) ?? 0,
    })),
  );
}

export async function ideaExists(ideaId: string): Promise<boolean> {
  const idea = await readBlobJson<IdeaRecord>(ideaPath(ideaId));
  return Boolean(idea);
}

export async function createIdea(input: {
  title: string;
  description: string;
}): Promise<Idea> {
  const record: IdeaRecord = {
    id: crypto.randomUUID(),
    title: input.title,
    description: input.description,
    createdAt: new Date().toISOString(),
  };

  await writeBlobJson(ideaPath(record.id), record);

  return {
    id: record.id,
    title: record.title,
    description: record.description,
    createdAt: record.createdAt,
    votes: 0,
    commentCount: 0,
  };
}

export async function listComments(ideaId: string): Promise<Comment[]> {
  const [commentRecords, commentVoteBlobs] = await Promise.all([
    listCommentRecords(),
    listAllBlobs(`${VOTES_PREFIX}comment/`),
  ]);

  const voteCounts = voteCountMapFromBlobs(commentVoteBlobs, "comment");

  return sortComments(
    commentRecords
      .filter((record) => record.ideaId === ideaId)
      .map((record) => ({
        id: record.id,
        ideaId: record.ideaId,
        body: record.body,
        createdAt: record.createdAt,
        votes: voteCounts.get(record.id) ?? 0,
      })),
  );
}

export async function createComment(input: {
  ideaId: string;
  body: string;
}): Promise<Comment> {
  const record: CommentRecord = {
    id: crypto.randomUUID(),
    ideaId: input.ideaId,
    body: input.body,
    createdAt: new Date().toISOString(),
  };

  await writeBlobJson(commentPath(record.id), record);

  return {
    id: record.id,
    ideaId: record.ideaId,
    body: record.body,
    createdAt: record.createdAt,
    votes: 0,
  };
}

export async function addVote(input: {
  targetType: VoteTargetType;
  targetId: string;
  voterKey: string;
}): Promise<AddVoteResult> {
  const targetExists =
    input.targetType === "idea"
      ? await ideaExists(input.targetId)
      : await commentExists(input.targetId);

  if (!targetExists) {
    return { status: "missing_target", votes: 0 };
  }

  const newVotePath = votePath(input.targetType, input.targetId, input.voterKey);

  const existingVote = await readBlobJson<VoteRecord>(newVotePath);

  if (existingVote) {
    return {
      status: "already_voted",
      votes: await countVotesForTarget(input.targetType, input.targetId),
    };
  }

  const vote: VoteRecord = {
    targetType: input.targetType,
    targetId: input.targetId,
    voterKey: input.voterKey,
    createdAt: new Date().toISOString(),
  };

  try {
    await writeBlobJson(newVotePath, vote);
  } catch (error) {
    if (isAlreadyExistsError(error)) {
      return {
        status: "already_voted",
        votes: await countVotesForTarget(input.targetType, input.targetId),
      };
    }

    throw error;
  }

  return {
    status: "added",
    votes: await countVotesForTarget(input.targetType, input.targetId),
  };
}
