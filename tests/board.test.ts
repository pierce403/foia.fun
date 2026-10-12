import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { createBoardDatabase } from "../src/lib/d1-board";
import { importSql, snapshotFromRows, validateSnapshot, sameRecords, entryFor, restoreSnapshot } from "../scripts/migration-data.mjs";

const mf = new Miniflare(convertV4MiniflareOptions({ modules: true, script: "export default {fetch(){return new Response('test')}}", compatibilityDate: "2026-10-12", d1Databases: ["DB"] }));
let db: D1Database;
let board: ReturnType<typeof createBoardDatabase>;
const id = "11111111-1111-4111-8111-111111111111";
const newerId = "22222222-2222-4222-8222-222222222222";
const commentId = "33333333-3333-4333-8333-333333333333";
const fixture = snapshotFromRows({
  ideas: [
    { id, title: "An old idea", description: "Keep the original description.", createdAt: "2026-02-26T01:00:00.000Z" },
    { id: newerId, title: "A new idea", description: "Keep all Unicode too: café 🧪", createdAt: "2026-02-27T01:00:00.000Z" },
  ],
  comments: [{ id: commentId, ideaId: id, body: "A comment with 'quotes'\nand a second line", createdAt: "2026-02-28T01:00:00.000Z" }],
  votes: [{ targetType: "idea", targetId: id, voterKey: "opaque-existing-browser-key", createdAt: "2026-02-28T01:00:00.000Z" }],
});
async function runSql(sql: string) {
  // Each generated statement is one line, including safely escaped string values.
  for (const statement of sql.split("\n").filter((s) => s && !s.startsWith("--"))) await db.prepare(statement).run();
}
before(async () => {
  db = await mf.getD1Database("DB");
  board = createBoardDatabase(db);
  const schema = await readFile(new URL("../migrations/0001_board.sql", import.meta.url), "utf8");
  for (const statement of schema.split(";").filter((s) => s.trim())) await db.prepare(statement).run();
  await runSql(importSql(fixture));
});
after(() => mf.dispose());

test("import preserves fields and ordering, repeat imports do not add votes", async () => {
  await runSql(importSql(fixture));
  const ideas = await board.listIdeas();
  assert.equal(ideas[0].id, id);
  assert.equal(ideas[0].votes, 1);
  assert.equal(ideas[0].commentCount, 1);
  assert.equal(ideas[1].description, "Keep all Unicode too: café 🧪");
  assert.equal((await board.listComments(id))[0].body, "A comment with 'quotes'\nand a second line");
});
test("existing browser key still returns already_voted", async () => {
  assert.deepEqual(await board.addVote({ targetType: "idea", targetId: id, voterKey: "opaque-existing-browser-key" }), { status: "already_voted", votes: 1 });
});
test("concurrent repeat votes insert only once", async () => {
  const results = await Promise.all(Array.from({ length: 16 }, () => board.addVote({ targetType: "idea", targetId: newerId, voterKey: "same-browser" })));
  assert.equal(results.filter((r) => r.status === "added").length, 1);
  assert.equal(results.filter((r) => r.status === "already_voted").length, 15);
  assert.ok(results.every((r) => r.votes === 1));
  assert.equal((await board.listIdeas())[0].id, newerId, "equal scores sort newest first");
});
test("distinct browser votes and comments remain independent", async () => {
  const result = await board.addVote({ targetType: "comment", targetId: commentId, voterKey: "same-browser" });
  assert.deepEqual(result, { status: "added", votes: 1 });
  assert.equal((await board.addVote({ targetType: "comment", targetId: commentId, voterKey: "second-browser" })).votes, 2);
  assert.equal((await board.listComments(id))[0].votes, 2);
});
test("missing targets never acquire orphan votes", async () => {
  assert.deepEqual(await board.addVote({ targetType: "idea", targetId: commentId, voterKey: "no-target" }), { status: "missing_target", votes: 0 });
  assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM votes WHERE voter_key = 'no-target'").first<{n: number}>())?.n, 0);
});
test("import conflicts fail without overwriting accepted data", async () => {
  const changed = structuredClone(fixture);
  const rows = validateSnapshot(changed);
  rows.ideas[0].title = "Conflicting title";
  const statement = importSql(snapshotFromRows(rows)).split("\n").find((s) => s.startsWith("INSERT"))!;
  await assert.rejects(db.prepare(statement).run());
  assert.equal((await db.prepare("SELECT title FROM ideas WHERE id = ?").bind(id).first<{title: string}>())?.title, "An old idea");
});
test("new ideas and comments retain source response fields", async () => {
  const idea = await board.createIdea({ title: "A new submission", description: "A valid new submission description." });
  assert.equal(idea.votes, 0); assert.equal(idea.commentCount, 0);
  assert.equal(await board.ideaExists(idea.id), true);
  const comment = await board.createComment({ ideaId: idea.id, body: "New comment" });
  assert.equal(comment.votes, 0); assert.equal(comment.ideaId, idea.id);
});
test("D1 rows convert back to deterministic Blob paths with identical records", async () => {
  const rows = {
    ideas: (await db.prepare("SELECT id,title,description,created_at AS createdAt FROM ideas").all()).results,
    comments: (await db.prepare("SELECT id,idea_id AS ideaId,body,created_at AS createdAt FROM comments").all()).results,
    votes: (await db.prepare("SELECT target_type AS targetType,target_id AS targetId,voter_key AS voterKey,created_at AS createdAt FROM votes").all()).results,
  };
  const exported = snapshotFromRows(rows);
  assert.ok(sameRecords(exported, snapshotFromRows(validateSnapshot(exported))));
  for (const entry of fixture.entries) {
    const roundTrip = exported.entries.find((e) => e.pathname === entry.pathname);
    assert.ok(roundTrip); assert.equal(roundTrip.sha256, entry.sha256);
  }
});
test("strict snapshot validation rejects corruption, duplicates, orphaned and mismatched records", () => {
  const badHash = structuredClone(fixture); badHash.entries[0].sha256 = "bad";
  assert.throws(() => validateSnapshot(badHash));
  const duplicate = structuredClone(fixture); duplicate.entries.push(duplicate.entries[0]);
  assert.throws(() => validateSnapshot(duplicate));
  const mismatch = structuredClone(fixture); mismatch.entries[0].pathname += "other";
  assert.throws(() => validateSnapshot(mismatch));
  const orphan = structuredClone(fixture);
  orphan.entries.push(entryFor("comments", { id: "44444444-4444-4444-8444-444444444444", ideaId: commentId, body: "orphan", createdAt: "2026-02-28T01:00:00.000Z" }));
  assert.throws(() => validateSnapshot(orphan));
});

test("reverse restore preflights conflicts, adds only missing objects and retries safely", async () => {
  const objects = new Map<string, Buffer>();
  let writes = 0;
  const store = {
    async getBytes(path: string) { return objects.get(path) ?? null; },
    async putBytes(path: string, bytes: Buffer) {
      assert.equal(objects.has(path), false); objects.set(path, bytes); writes++;
    },
  };
  const conflicting = fixture.entries.at(-1)!;
  objects.set(conflicting.pathname, Buffer.from('{"different":"data"}'));
  await assert.rejects(restoreSnapshot(fixture, store));
  assert.equal(writes, 0);
  objects.clear();
  assert.equal((await restoreSnapshot(fixture, store)).added, fixture.entries.length);
  assert.equal((await restoreSnapshot(fixture, store)).added, 0);
  assert.equal(writes, fixture.entries.length);
});
