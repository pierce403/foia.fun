import { env } from "cloudflare:workers";
import { createBoardDatabase } from "./d1-board";

// Construct per request; never keep request-owned binding operations at module scope.
export const listIdeas = () => createBoardDatabase(env.DB).listIdeas();
export const ideaExists = (id: string) => createBoardDatabase(env.DB).ideaExists(id);
export const createIdea = (input: { title: string; description: string }) => createBoardDatabase(env.DB).createIdea(input);
export const listComments = (id: string) => createBoardDatabase(env.DB).listComments(id);
export const createComment = (input: { ideaId: string; body: string }) => createBoardDatabase(env.DB).createComment(input);
export const addVote: ReturnType<typeof createBoardDatabase>["addVote"] = (input) => createBoardDatabase(env.DB).addVote(input);
export type { AddVoteResult } from "./d1-board";
