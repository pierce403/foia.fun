"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import type { Comment, Idea, VoteTargetType } from "@/lib/types";

type VoteApiResponse = {
  status: "added" | "already_voted";
  votes: number;
};

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

function sortIdeas(items: Idea[]): Idea[] {
  return [...items].sort(
    (a, b) => b.votes - a.votes || Date.parse(b.createdAt) - Date.parse(a.createdAt),
  );
}

function sortComments(items: Comment[]): Comment[] {
  return [...items].sort(
    (a, b) => b.votes - a.votes || Date.parse(b.createdAt) - Date.parse(a.createdAt),
  );
}

function formatTimestamp(timestamp: string): string {
  return dateFormatter.format(new Date(timestamp));
}

export default function FoiaBoard({ readOnly = true }: { readOnly?: boolean }) {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [commentsByIdea, setCommentsByIdea] = useState<Record<string, Comment[]>>({});
  const [openIdeas, setOpenIdeas] = useState<Record<string, boolean>>({});
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [ideaTitle, setIdeaTitle] = useState("");
  const [ideaDescription, setIdeaDescription] = useState("");
  const [busyByAction, setBusyByAction] = useState<Record<string, boolean>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [loadingIdeas, setLoadingIdeas] = useState(true);

  const totalIdeas = ideas.length;
  const totalComments = useMemo(
    () => ideas.reduce((sum, idea) => sum + idea.commentCount, 0),
    [ideas],
  );

  function setBusy(actionKey: string, value: boolean) {
    setBusyByAction((previous) => ({
      ...previous,
      [actionKey]: value,
    }));
  }


  async function loadComments(ideaId: string) {
    const actionKey = `comments:load:${ideaId}`;

    if (busyByAction[actionKey]) {
      return;
    }

    setBusy(actionKey, true);

    try {
      const response = await fetch(`/api/ideas/${ideaId}/comments`, {
        cache: "no-store",
      });

      const payload = (await response.json()) as
        | { comments: Comment[] }
        | { error: string };

      if (!response.ok || !("comments" in payload)) {
        throw new Error(
          "error" in payload ? payload.error : "Failed to load comments.",
        );
      }

      setCommentsByIdea((previous) => ({
        ...previous,
        [ideaId]: sortComments(payload.comments),
      }));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load comments.";
      setNotice(message);
    } finally {
      setBusy(actionKey, false);
    }
  }

  async function submitIdea(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const title = ideaTitle.trim();
    const description = ideaDescription.trim();

    if (!title || !description) {
      setNotice("Add both a title and details before posting.");
      return;
    }

    const actionKey = "idea:create";
    setBusy(actionKey, true);

    try {
      const response = await fetch("/api/ideas", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title, description }),
      });

      const payload = (await response.json()) as
        | { idea: Idea }
        | { error: string };

      if (!response.ok || !("idea" in payload)) {
        throw new Error(
          "error" in payload ? payload.error : "Failed to submit idea.",
        );
      }

      setIdeas((previous) => sortIdeas([payload.idea, ...previous]));
      setIdeaTitle("");
      setIdeaDescription("");
      setNotice("Idea submitted.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to submit idea.";
      setNotice(message);
    } finally {
      setBusy(actionKey, false);
    }
  }

  async function submitComment(ideaId: string, event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const body = (commentDrafts[ideaId] ?? "").trim();

    if (!body) {
      setNotice("Write a comment before posting.");
      return;
    }

    const actionKey = `comment:create:${ideaId}`;
    setBusy(actionKey, true);

    try {
      const response = await fetch(`/api/ideas/${ideaId}/comments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ body }),
      });

      const payload = (await response.json()) as
        | { comment: Comment }
        | { error: string };

      if (!response.ok || !("comment" in payload)) {
        throw new Error(
          "error" in payload ? payload.error : "Failed to post comment.",
        );
      }

      setCommentDrafts((previous) => ({
        ...previous,
        [ideaId]: "",
      }));

      setCommentsByIdea((previous) => {
        const current = previous[ideaId] ?? [];
        return {
          ...previous,
          [ideaId]: sortComments([payload.comment, ...current]),
        };
      });

      setIdeas((previous) =>
        previous.map((idea) =>
          idea.id === ideaId
            ? {
                ...idea,
                commentCount: idea.commentCount + 1,
              }
            : idea,
        ),
      );

      setNotice("Comment posted.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to post comment.";
      setNotice(message);
    } finally {
      setBusy(actionKey, false);
    }
  }

  async function vote(targetType: VoteTargetType, targetId: string, ideaId?: string) {
    const actionKey = `vote:${targetType}:${targetId}`;

    if (busyByAction[actionKey]) {
      return;
    }

    setBusy(actionKey, true);

    try {
      const response = await fetch("/api/votes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          targetType,
          targetId,
        }),
      });

      const payload = (await response.json()) as
        | VoteApiResponse
        | { error: string };

      if (!response.ok || !("status" in payload)) {
        throw new Error(
          "error" in payload ? payload.error : "Failed to submit vote.",
        );
      }

      if (targetType === "idea") {
        setIdeas((previous) =>
          sortIdeas(
            previous.map((idea) =>
              idea.id === targetId ? { ...idea, votes: payload.votes } : idea,
            ),
          ),
        );
      }

      if (targetType === "comment" && ideaId) {
        setCommentsByIdea((previous) => {
          const current = previous[ideaId] ?? [];
          return {
            ...previous,
            [ideaId]: sortComments(
              current.map((comment) =>
                comment.id === targetId
                  ? { ...comment, votes: payload.votes }
                  : comment,
              ),
            ),
          };
        });
      }

      if (payload.status === "already_voted") {
        setNotice("Vote already counted for this browser.");
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to submit vote.";
      setNotice(message);
    } finally {
      setBusy(actionKey, false);
    }
  }

  function toggleIdeaComments(ideaId: string) {
    const isOpen = !!openIdeas[ideaId];

    setOpenIdeas((previous) => ({
      ...previous,
      [ideaId]: !isOpen,
    }));

    if (!isOpen && !commentsByIdea[ideaId]) {
      void loadComments(ideaId);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/ideas", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const payload = (await response.json()) as { ideas: Idea[] } | { error: string };
        if (!response.ok || !("ideas" in payload)) {
          throw new Error("error" in payload ? payload.error : "Failed to load ideas.");
        }
        if (!controller.signal.aborted) setIdeas(sortIdeas(payload.ideas));
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setNotice(error instanceof Error ? error.message : "Failed to load ideas.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingIdeas(false);
      });
    return () => controller.abort();
  }, []);

  return (
    <div className="space-y-6">
      {readOnly && (
        <section role="status" className="rounded-xl border border-amber-300/30 bg-amber-200/10 px-4 py-3 text-sm text-amber-100">
          Posting and voting are temporarily paused while we move the board. You can still read all ideas and comments.
        </section>
      )}
      <section className="rounded-2xl border border-cyan-300/20 bg-slate-900/70 p-4 shadow-[0_20px_65px_-40px_rgba(34,211,238,0.95)] backdrop-blur sm:p-6">
        <form className="space-y-3" onSubmit={submitIdea}>
          <h2 className="text-lg font-semibold text-slate-100 sm:text-xl">
            Submit a FOIA request idea
          </h2>
          <input
            className="w-full rounded-xl border border-white/15 bg-slate-950/60 px-3 py-2 text-sm text-slate-50 outline-none ring-0 placeholder:text-slate-400 focus:border-cyan-300/70"
            name="title"
            placeholder="Short headline"
            maxLength={120}
            value={ideaTitle}
            onChange={(event) => setIdeaTitle(event.target.value)}
          />
          <textarea
            className="min-h-32 w-full rounded-xl border border-white/15 bg-slate-950/60 px-3 py-2 text-sm text-slate-50 outline-none ring-0 placeholder:text-slate-400 focus:border-cyan-300/70"
            name="description"
            placeholder="What should be requested, from who, and why it matters"
            maxLength={2000}
            value={ideaDescription}
            onChange={(event) => setIdeaDescription(event.target.value)}
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-mono text-xs text-slate-300/80">
              Anonymous post. No account required.
            </p>
            <button
              type="submit"
              disabled={readOnly || !!busyByAction["idea:create"]}
              className="rounded-full border border-cyan-300/70 bg-cyan-300/15 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:bg-cyan-300/25 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busyByAction["idea:create"] ? "Posting..." : "Post idea"}
            </button>
          </div>
        </form>
      </section>

      <section className="grid grid-cols-1 gap-3 rounded-2xl border border-white/10 bg-slate-950/40 p-4 sm:grid-cols-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-cyan-200/80">
            Ideas
          </p>
          <p className="mt-1 text-2xl font-semibold text-slate-100">{totalIdeas}</p>
        </div>
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-cyan-200/80">
            Comments
          </p>
          <p className="mt-1 text-2xl font-semibold text-slate-100">
            {totalComments}
          </p>
        </div>
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-cyan-200/80">
            Ranking
          </p>
          <p className="mt-1 text-sm text-slate-300/85">
            Sorted by upvotes, then newest.
          </p>
        </div>
      </section>

      {notice && (
        <section className="rounded-xl border border-amber-300/30 bg-amber-200/10 px-4 py-2 text-sm text-amber-100">
          {notice}
        </section>
      )}

      <section className="space-y-4">
        {loadingIdeas && (
          <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-5 text-sm text-slate-300">
            Loading ideas...
          </div>
        )}

        {!loadingIdeas && ideas.length === 0 && (
          <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-5 text-sm text-slate-300">
            No ideas yet. Be the first to post one.
          </div>
        )}

        {ideas.map((idea) => {
          const comments = commentsByIdea[idea.id] ?? [];
          const commentsOpen = !!openIdeas[idea.id];
          const loadingComments = !!busyByAction[`comments:load:${idea.id}`];

          return (
            <article
              key={idea.id}
              className="rounded-2xl border border-white/12 bg-slate-900/70 p-4 shadow-[0_25px_65px_-45px_rgba(148,163,184,0.9)] sm:p-5"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-slate-100">{idea.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-200/90">
                    {idea.description}
                  </p>
                  <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.14em] text-slate-400/90">
                    Posted {formatTimestamp(idea.createdAt)}
                  </p>
                </div>
                <div className="flex gap-2 sm:flex-col sm:items-end">
                  <button
                    type="button"
                    disabled={readOnly || !!busyByAction[`vote:idea:${idea.id}`]}
                    onClick={() => void vote("idea", idea.id)}
                    className="rounded-full border border-cyan-300/70 bg-cyan-300/15 px-3 py-1.5 text-sm font-medium text-cyan-100 transition hover:bg-cyan-300/25 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    ▲ {idea.votes}
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleIdeaComments(idea.id)}
                    className="rounded-full border border-white/20 bg-slate-800/65 px-3 py-1.5 text-sm text-slate-200 transition hover:bg-slate-700/70"
                  >
                    {commentsOpen ? "Hide" : "Comments"} ({idea.commentCount})
                  </button>
                </div>
              </div>

              {commentsOpen && (
                <div className="mt-4 space-y-3 border-t border-white/10 pt-4">
                  <form
                    className="flex flex-col gap-2 sm:flex-row"
                    onSubmit={(event) => void submitComment(idea.id, event)}
                  >
                    <input
                      className="w-full rounded-lg border border-white/15 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-400 focus:border-cyan-300/70"
                      placeholder="Add an anonymous comment"
                      value={commentDrafts[idea.id] ?? ""}
                      maxLength={600}
                      onChange={(event) =>
                        setCommentDrafts((previous) => ({
                          ...previous,
                          [idea.id]: event.target.value,
                        }))
                      }
                    />
                    <button
                      type="submit"
                      disabled={readOnly || !!busyByAction[`comment:create:${idea.id}`]}
                      className="rounded-lg border border-cyan-300/70 bg-cyan-300/15 px-3 py-2 text-sm font-medium text-cyan-100 transition hover:bg-cyan-300/25 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {busyByAction[`comment:create:${idea.id}`]
                        ? "Posting..."
                        : "Comment"}
                    </button>
                  </form>

                  {loadingComments && (
                    <p className="text-sm text-slate-300">Loading comments...</p>
                  )}

                  {!loadingComments && comments.length === 0 && (
                    <p className="text-sm text-slate-300">No comments yet.</p>
                  )}

                  {!loadingComments && comments.length > 0 && (
                    <div className="space-y-2">
                      {comments.map((comment) => (
                        <div
                          key={comment.id}
                          className="rounded-xl border border-white/12 bg-slate-950/45 p-3"
                        >
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <p className="text-sm text-slate-100">{comment.body}</p>
                              <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.14em] text-slate-400/90">
                                {formatTimestamp(comment.createdAt)}
                              </p>
                            </div>
                            <button
                              type="button"
                              disabled={readOnly || !!busyByAction[`vote:comment:${comment.id}`]}
                              onClick={() => void vote("comment", comment.id, idea.id)}
                              className="self-start rounded-full border border-cyan-300/70 bg-cyan-300/10 px-3 py-1 text-xs text-cyan-100 transition hover:bg-cyan-300/20 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              ▲ {comment.votes}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </section>
    </div>
  );
}
