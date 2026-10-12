import { createHash } from "node:crypto";

export const PREFIX = "foia-board/v1/";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const fields = {
  ideas: ["id", "title", "description", "createdAt"],
  comments: ["id", "ideaId", "body", "createdAt"],
  votes: ["targetType", "targetId", "voterKey", "createdAt"],
};
export const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const fail = () => { throw new Error("Snapshot validation failed; inspect the private snapshot without publishing its contents."); };
const validText = (x, min, max) => typeof x === "string" && !x.includes("\0") && x.length >= min && x.length <= max;
export function pathnameFor(kind, record) {
  return kind === "votes"
    ? `${PREFIX}votes/${record.targetType}/${record.targetId}/${record.voterKey}.json`
    : `${PREFIX}${kind}/${record.id}.json`;
}
export function entryFor(kind, record) {
  const bytes = Buffer.from(JSON.stringify(record));
  return { pathname: pathnameFor(kind, record), base64: bytes.toString("base64"), sha256: digest(bytes) };
}
export function validateSnapshot(snapshot) {
  if (snapshot?.format !== "foia-blob-v1" || !Array.isArray(snapshot.entries)) fail();
  /** @type {{ideas: Record<string, string>[], comments: Record<string, string>[], votes: Record<string, string>[]}} */
  const rows = { ideas: [], comments: [], votes: [] };
  const paths = new Set();
  for (const entry of snapshot.entries) {
    if (!entry || typeof entry.pathname !== "string" || typeof entry.base64 !== "string" || paths.has(entry.pathname)) fail();
    paths.add(entry.pathname);
    const bytes = Buffer.from(entry.base64, "base64");
    if (bytes.toString("base64") !== entry.base64 || digest(bytes) !== entry.sha256) fail();
    let record;
    try { record = JSON.parse(bytes.toString("utf8")); } catch { fail(); }
    const kind = entry.pathname.slice(PREFIX.length).split("/")[0];
    if (!entry.pathname.startsWith(PREFIX) || !Object.hasOwn(fields, kind) || !record || typeof record !== "object" || Array.isArray(record)) fail();
    if (Object.keys(record).sort().join() !== [...fields[kind]].sort().join()) fail();
    if (typeof record.createdAt !== "string" || !Number.isFinite(Date.parse(record.createdAt)) || new Date(record.createdAt).toISOString() !== record.createdAt) fail();
    if (pathnameFor(kind, record) !== entry.pathname) fail();
    if (kind === "ideas" && (!uuid.test(record.id) || !validText(record.title, 3, 120) || !validText(record.description, 10, 2000))) fail();
    if (kind === "comments" && (!uuid.test(record.id) || !uuid.test(record.ideaId) || !validText(record.body, 1, 600))) fail();
    if (kind === "votes" && (!["idea", "comment"].includes(record.targetType) || !uuid.test(record.targetId) || !validText(record.voterKey, 1, 4096))) fail();
    rows[kind].push(Object.fromEntries(fields[kind].map((field) => [field, record[field]])));
  }
  const ideas = new Set(rows.ideas.map((r) => r.id));
  const comments = new Set(rows.comments.map((r) => r.id));
  if (rows.comments.some((r) => !ideas.has(r.ideaId))) fail();
  if (rows.votes.some((r) => !(r.targetType === "idea" ? ideas : comments).has(r.targetId))) fail();
  for (const kind of Object.keys(rows)) rows[kind].sort((a, b) => pathnameFor(kind, a).localeCompare(pathnameFor(kind, b)));
  return rows;
}
export function snapshotFromRows(rows) {
  /** @type {{format: string, entries: {pathname: string, base64: string, sha256: string}[]}} */
  const snapshot = { format: "foia-blob-v1", entries: [] };
  for (const kind of Object.keys(fields)) {
    if (!Array.isArray(rows[kind])) fail();
    for (const row of rows[kind]) snapshot.entries.push(entryFor(kind, row));
  }
  snapshot.entries.sort((a, b) => a.pathname.localeCompare(b.pathname));
  validateSnapshot(snapshot);
  return snapshot;
}
export function sameRecords(a, b) {
  return JSON.stringify(validateSnapshot(a)) === JSON.stringify(validateSnapshot(b));
}
const quote = (value) => `CAST(X'${Buffer.from(value, "utf8").toString("hex")}' AS TEXT)`;
export function importSql(snapshot) {
  const rows = validateSnapshot(snapshot);
  const columns = {
    ideas: ["id", "title", "description", "created_at"],
    comments: ["id", "idea_id", "body", "created_at"],
    votes: ["target_type", "target_id", "voter_key", "created_at"],
  };
  const conflicts = { ideas: "id", comments: "id", votes: "target_type,target_id,voter_key" };
  const sql = ["-- Private migration data: never commit or publish this file."];
  for (const kind of Object.keys(fields)) {
    for (const row of rows[kind]) {
      const cols = columns[kind];
      const equality = cols.map((c) => `${kind}.${c} = excluded.${c}`).join(" AND ");
      // Identical imports are safe to repeat. A changed existing row violates NOT NULL,
      // stopping the import without overwriting the destination's accepted data.
      sql.push(`INSERT INTO ${kind} (${cols.join(",")}) VALUES (${fields[kind].map((f) => quote(row[f])).join(",")}) ON CONFLICT (${conflicts[kind]}) DO UPDATE SET created_at = CASE WHEN ${equality} THEN ${kind}.created_at ELSE NULL END;`);
    }
  }
  return sql.join("\n") + "\n";
}
export function summary(snapshot) {
  const rows = validateSnapshot(snapshot);
  return { ideas: rows.ideas.length, comments: rows.comments.length, votes: rows.votes.length, objects: snapshot.entries.length };
}

export async function restoreSnapshot(snapshot, store) {
  validateSnapshot(snapshot);
  const missing = [];
  const canonical = (data) => {
    const parsed = JSON.parse(data.toString("utf8"));
    return JSON.stringify(parsed, Object.keys(parsed).sort());
  };
  // Preflight all collisions before the first write; partial restores are retryable.
  for (const entry of snapshot.entries) {
    const existing = await store.getBytes(entry.pathname);
    if (existing === null) { missing.push(entry); continue; }
    if (canonical(existing) !== canonical(Buffer.from(entry.base64, "base64"))) {
      throw new Error("Restore conflict: existing Blob differs; nothing was overwritten.");
    }
  }
  for (const entry of missing) await store.putBytes(entry.pathname, Buffer.from(entry.base64, "base64"));
  return { ...summary(snapshot), added: missing.length };
}
