export type VoteTargetType = "idea" | "comment";

export type Idea = {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  votes: number;
  commentCount: number;
};

export type Comment = {
  id: string;
  ideaId: string;
  body: string;
  createdAt: string;
  votes: number;
};
