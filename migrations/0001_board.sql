CREATE TABLE ideas (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE comments (
  id TEXT PRIMARY KEY NOT NULL,
  idea_id TEXT NOT NULL REFERENCES ideas(id),
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX comments_idea_id ON comments(idea_id);
CREATE TABLE votes (
  target_type TEXT NOT NULL CHECK(target_type IN ('idea', 'comment')),
  target_id TEXT NOT NULL,
  voter_key TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY(target_type, target_id, voter_key)
);
