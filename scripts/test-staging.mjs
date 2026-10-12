import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, open } from "node:fs/promises";
import { dirname } from "node:path";

const [base, evidencePath] = process.argv.slice(2);
if (base !== "https://foia-fun-staging.bcrt43.workers.dev" || !evidencePath) {
  throw new Error("Explicit synthetic-only staging URL and new private evidence path required.");
}
await mkdir(dirname(evidencePath), { recursive: true, mode: 0o700 });
const evidence = await open(evidencePath, "wx", 0o600);
const report = { base, runId: randomUUID(), fixtureIds: {}, checks: [] };
const save = async () => {
  await evidence.truncate(0);
  await evidence.write(JSON.stringify(report, null, 2), 0, "utf8");
  await evidence.sync();
};
const request = (path, body, cookie) => fetch(new URL(path, base), {
  method: body === undefined ? "GET" : "POST", redirect: "manual",
  headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});
try {
  await save();
  const home = await request("/"); assert.equal(home.status, 200);
  const html = await home.text(); assert.match(html, /FOIA Idea Board/);
  assert.doesNotMatch(html, /Posting and voting are temporarily paused/);
  assert.equal((await request("/test-missing-route")).status, 404);
  const list = await request("/api/ideas"); assert.equal(list.status, 200);
  assert.match(list.headers.get("cache-control") ?? "", /no-store/);
  assert.deepEqual((await list.json()).ideas, []);
  assert.equal((await request("/api/ideas", { title: "no", description: "short" })).status, 400);
  assert.equal((await request("/api/ideas/not-uuid/comments")).status, 400);
  const missing = "99999999-9999-4999-8999-999999999999";
  assert.equal((await request(`/api/ideas/${missing}/comments`)).status, 404);
  assert.equal((await request("/api/votes", { targetType: "idea", targetId: missing })).status, 404);
  report.checks.push("HTTPS home, genuine404, uncached empty staging reads, invalid400 and missing404");

  const created = await request("/api/ideas", { title: `Synthetic migration check ${report.runId}`, description: "Disposable staging fixture. No source or production data." });
  assert.equal(created.status, 201);
  const { idea } = await created.json(); report.fixtureIds.idea = idea.id; await save();
  const commented = await request(`/api/ideas/${idea.id}/comments`, { body: "Disposable staging comment for HTTPS acceptance." });
  assert.equal(commented.status, 201);
  const { comment } = await commented.json(); report.fixtureIds.comment = comment.id; await save();
  const voted = await request("/api/votes", { targetType: "idea", targetId: idea.id });
  assert.equal(voted.status, 201);
  const setCookie = voted.headers.get("set-cookie"); assert.ok(setCookie);
  for (const pattern of [/HttpOnly/i, /SameSite=Lax/i, /Max-Age=604800/i, /Path=\//i, /; Secure/i]) assert.match(setCookie, pattern);
  assert.doesNotMatch(setCookie, /Domain=/i);
  const cookie = setCookie.split(";")[0];
  const duplicate = await request("/api/votes", { targetType: "idea", targetId: idea.id }, cookie);
  assert.equal(duplicate.status, 200); assert.deepEqual(await duplicate.json(), { status: "already_voted", votes: 1 });
  assert.equal(duplicate.headers.get("set-cookie"), null);
  report.checks.push("create/comment201, Secure HttpOnly SameSite=Lax seven-day host-only cookie, duplicate200 with unchanged cookie");

  const replies = await Promise.all(Array.from({ length: 16 }, () => request("/api/votes", { targetType: "comment", targetId: comment.id }, `foia_voter=synthetic-${report.runId}`)));
  assert.equal(replies.filter((r) => r.status === 201).length, 1);
  assert.equal(replies.filter((r) => r.status === 200).length, 15);
  const comments = await (await request(`/api/ideas/${idea.id}/comments`)).json();
  assert.equal(comments.comments.length, 1); assert.equal(comments.comments[0].votes, 1);
  const ideas = await (await request("/api/ideas")).json();
  assert.equal(ideas.ideas.length, 1); assert.equal(ideas.ideas[0].votes, 1); assert.equal(ideas.ideas[0].commentCount, 1);
  report.checks.push("sixteen concurrent same-cookie votes yield one201, fifteen200 and exactly one stored vote");
  report.completed = true; await save();
  console.log(JSON.stringify({ completed: true, checks: report.checks, evidencePath }));
} finally {
  await save(); await evidence.close();
}
