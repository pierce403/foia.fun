import type { Comment, Idea, VoteTargetType } from "./types";

export type AddVoteResult = {
  status: "added" | "already_voted" | "missing_target";
  votes: number;
};

export function createBoardDatabase(db: D1Database) {
  return {
    async listIdeas(): Promise<Idea[]> {
      const { results } = await db.prepare(`
        SELECT i.id, i.title, i.description, i.created_at AS createdAt,
          (SELECT COUNT(*) FROM votes v WHERE v.target_type = 'idea' AND v.target_id = i.id) AS votes,
          (SELECT COUNT(*) FROM comments c WHERE c.idea_id = i.id) AS commentCount
        FROM ideas i ORDER BY votes DESC, julianday(i.created_at) DESC, i.id ASC
      `).all<Idea>();
      return results;
    },
    async ideaExists(ideaId: string): Promise<boolean> {
      return Boolean(await db.prepare("SELECT id FROM ideas WHERE id = ?").bind(ideaId).first());
    },
    async createIdea(input: { title: string; description: string }): Promise<Idea> {
      const idea = { id: crypto.randomUUID(), ...input, createdAt: new Date().toISOString(), votes: 0, commentCount: 0 };
      await db.prepare("INSERT INTO ideas (id, title, description, created_at) VALUES (?, ?, ?, ?)")
        .bind(idea.id, idea.title, idea.description, idea.createdAt).run();
      return idea;
    },
    async listComments(ideaId: string): Promise<Comment[]> {
      const { results } = await db.prepare(`
        SELECT c.id, c.idea_id AS ideaId, c.body, c.created_at AS createdAt,
          (SELECT COUNT(*) FROM votes v WHERE v.target_type = 'comment' AND v.target_id = c.id) AS votes
        FROM comments c WHERE c.idea_id = ?
        ORDER BY votes DESC, julianday(c.created_at) DESC, c.id ASC
      `).bind(ideaId).all<Comment>();
      return results;
    },
    async createComment(input: { ideaId: string; body: string }): Promise<Comment> {
      const comment = { id: crypto.randomUUID(), ...input, createdAt: new Date().toISOString(), votes: 0 };
      await db.prepare("INSERT INTO comments (id, idea_id, body, created_at) VALUES (?, ?, ?, ?)")
        .bind(comment.id, comment.ideaId, comment.body, comment.createdAt).run();
      return comment;
    },
    async addVote(input: { targetType: VoteTargetType; targetId: string; voterKey: string }): Promise<AddVoteResult> {
      // Table names are selected from a closed union; all caller data is bound.
      const table = input.targetType === "idea" ? "ideas" : "comments";
      const [target, inserted, count] = await db.batch<{ id?: string; votes?: number }>([
        db.prepare(`SELECT id FROM ${table} WHERE id = ?`).bind(input.targetId),
        db.prepare(`INSERT INTO votes (target_type, target_id, voter_key, created_at)
          SELECT ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM ${table} WHERE id = ?)
          ON CONFLICT(target_type, target_id, voter_key) DO NOTHING`)
          .bind(input.targetType, input.targetId, input.voterKey, new Date().toISOString(), input.targetId),
        db.prepare("SELECT COUNT(*) AS votes FROM votes WHERE target_type = ? AND target_id = ?")
          .bind(input.targetType, input.targetId),
      ]);
      if (target.results.length === 0) return { status: "missing_target", votes: 0 };
      return {
        status: inserted.meta.changes === 1 ? "added" : "already_voted",
        votes: Number(count.results[0].votes),
      };
    },
  };
}
