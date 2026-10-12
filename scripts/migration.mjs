import { readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { digest, PREFIX, validateSnapshot, snapshotFromRows, sameRecords, importSql, summary, restoreSnapshot } from "./migration-data.mjs";

process.umask(0o077);
async function writePrivate(path, content) {
  await mkdir(dirname(resolve(path)), { recursive: true, mode: 0o700 });
  if (((await stat(dirname(resolve(path)))).mode & 0o077) !== 0) throw new Error("Output directory must be private (chmod 700).");
  await writeFile(path, content, { flag: "wx", mode: 0o600 });
}
async function load(path) {
  const parsed = JSON.parse(await readFile(path, "utf8"));
  validateSnapshot(parsed);
  return parsed;
}
async function exportBlob(out) {
  const { list, get } = await import("@vercel/blob");
  if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error("Provide the Blob token only through the process environment.");
  const entries = [];
  let cursor;
  do {
    const page = await list({ prefix: PREFIX, limit: 1000, cursor });
    for (const blob of page.blobs) {
      const result = await get(blob.pathname, { access: "private", useCache: false });
      if (result?.statusCode !== 200 || !result.stream) throw new Error("Incomplete Blob read; no snapshot was saved.");
      const bytes = Buffer.from(await new Response(result.stream).arrayBuffer());
      if (bytes.length !== blob.size) throw new Error("Blob size changed during export; freeze writers before the final copy.");
      entries.push({ pathname: blob.pathname, base64: bytes.toString("base64"), sha256: digest(bytes) });
    }
    if (page.hasMore && !page.cursor) throw new Error("Incomplete Blob pagination.");
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  entries.sort((a, b) => a.pathname.localeCompare(b.pathname));
  const snapshot = { format: "foia-blob-v1", entries };
  validateSnapshot(snapshot);
  await writePrivate(out, JSON.stringify(snapshot) + "\n");
  return summary(snapshot);
}
async function exportD1(config, database, location, out) {
  if (!["--local", "--remote"].includes(location)) throw new Error("Choose --local or --remote explicitly.");
  const columns = {
    ideas: "id,title,description,created_at AS createdAt",
    comments: "id,idea_id AS ideaId,body,created_at AS createdAt",
    votes: "target_type AS targetType,target_id AS targetId,voter_key AS voterKey,created_at AS createdAt",
  };
  const rows = {};
  const wrangler = fileURLToPath(new URL("../node_modules/wrangler/bin/wrangler.js", import.meta.url));
  for (const kind of Object.keys(columns)) {
    const result = spawnSync(process.execPath, [wrangler, "d1", "execute", database, location, "--config", config, "--json", "--command", `SELECT COUNT(*) AS expected_count FROM ${kind}; SELECT ${columns[kind]} FROM ${kind}`], { encoding: "utf8", maxBuffer: 128 * 1024 * 1024 });
    // Wrangler output contains private voter keys; never forward stdout or stderr.
    if (result.status !== 0) throw new Error("D1 export failed; no snapshot was saved.");
    let parsed;
    try { parsed = JSON.parse(result.stdout); } catch { throw new Error("D1 export did not produce valid JSON."); }
    if (!Array.isArray(parsed) || parsed.length !== 2 || parsed.some((result) => result.success !== true || !Array.isArray(result.results)) || parsed[0].results[0]?.expected_count !== parsed[1].results.length) throw new Error("D1 export result was incomplete.");
    rows[kind] = parsed[1].results;
  }
  const snapshot = snapshotFromRows(rows);
  await writePrivate(out, JSON.stringify(snapshot) + "\n");
  return summary(snapshot);
}
async function restoreBlob(path, confirmation) {
  if (confirmation !== "--writers-frozen") throw new Error("Freeze all writers before restore and pass --writers-frozen.");
  const snapshot = await load(path);
  const { get, put } = await import("@vercel/blob");
  if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error("Provide the Blob token only through the process environment.");
  return restoreSnapshot(snapshot, {
    async getBytes(pathname) {
      const existing = await get(pathname, { access: "private", useCache: false });
      if (existing === null) return null;
      if (existing.statusCode !== 200 || !existing.stream) throw new Error("Unable to compare an existing Blob.");
      return Buffer.from(await new Response(existing.stream).arrayBuffer());
    },
    async putBytes(pathname, bytes) {
      await put(pathname, bytes, { access: "private", addRandomSuffix: false, allowOverwrite: false, contentType: "application/json" });
    },
  });
}
async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (command === "export-blob" && args.length === 1) return exportBlob(args[0]);
  if (command === "export-d1" && args.length === 4) return exportD1(...args);
  if (command === "validate" && args.length === 1) return summary(await load(args[0]));
  if (command === "compare" && args.length === 2) {
    const same = sameRecords(await load(args[0]), await load(args[1]));
    if (!same) throw new Error("Snapshots differ; keep writes frozen and reconcile private records.");
    return { sameRecords: true };
  }
  if (command === "to-sql" && args.length === 2) {
    const snapshot = await load(args[0]);
    await writePrivate(args[1], importSql(snapshot));
    return summary(snapshot);
  }
  if (command === "restore-blob" && args.length === 2) return restoreBlob(...args);
  throw new Error("Usage: migration export-blob OUT | export-d1 CONFIG DB --local|--remote OUT | validate IN | compare A B | to-sql IN OUT | restore-blob IN --writers-frozen");
}
main().then((result) => console.log(JSON.stringify(result))).catch(() => {
  // SDK/parser errors can contain private paths, cookie identities, or content.
  console.error("Migration command failed. No credentials or private records are printed. Check arguments, private file permissions, schema, and storage access; keep writers frozen until reconciliation succeeds.");
  process.exitCode = 1;
});
