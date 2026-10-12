import { readFileSync } from "node:fs";

const source = JSON.parse(readFileSync("wrangler.jsonc", "utf8"));
const config = JSON.parse(readFileSync("dist/server/wrangler.json", "utf8"));
const sourceId = source.d1_databases?.find((db) => db.binding === "DB")?.database_id;
const stagingId = source.env?.staging?.d1_databases?.find((db) => db.binding === "DB")?.database_id;
if (sourceId === stagingId || config.name !== "foia-fun" || !config.d1_databases?.some((db) =>
  db.binding === "DB" && db.database_id === sourceId && db.database_name === "foia-fun-production" &&
  /^[a-f0-9-]{36}$/.test(db.database_id) && !db.database_id.startsWith("00000000-"))) {
  throw new Error("Production deployment requires the verified production D1 binding and production build.");
}
