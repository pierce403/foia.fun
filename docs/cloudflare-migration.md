# Cloudflare migration runbook

## Publication and isolation

Native Workers Builds must watch `main`, with Node 22.23.3, build command
`npm run build`, deploy command `npm run deploy`, and nonproduction builds disabled.
Vercel Git builds are disabled in `vercel.json`. Retain the old deployment for
recovery; this file does not freeze its running APIs.

Before connecting production, provision `foia-fun-production` and
`foia-fun-staging`, put their verified distinct IDs in their respective Wrangler
bindings, regenerate types, and rebuild. Production deploy refuses sentinel IDs
or a staging artifact. The deployment command applies tracked D1 schema migrations
then deploys the already built artifact. Do not run it manually while native Git
publishing owns production. There are no application runtime secrets: Blob access
is confined to the migration tooling's process environment.

Keep production `FOIA_READ_ONLY=true` through final import and serving checks.
Enable writes by changing it to `false` in source, using native Git publication,
and verifying the resulting exact build/version. Do not attach production D1 to
previews. Staging artifacts are selected with `CLOUDFLARE_ENV=staging` at build time;
a deploy-time flag cannot retarget an already built artifact.

## Local HTTP verification

Run staging dev as in README, then:

```bash
node scripts/test-http.mjs http://127.0.0.1:5173 writable
```

The HTTP script refuses non-localhost targets because it creates synthetic data.
For the production-built artifact, local state lives relative to the generated
config, separately from the source-config local database:

```bash
npm run build
npx wrangler d1 migrations apply DB --local --config dist/server/wrangler.json
npx wrangler dev --local --config dist/server/wrangler.json --port 4174 --var FOIA_READ_ONLY:false
# In another terminal:
EXPECT_SECURE_COOKIE=true node scripts/test-http.mjs http://127.0.0.1:4174 writable
```

Restart the local Worker without the var override and run the HTTP script with
`read-only` instead. Confirm reads, notice, all three mutation gates and real 404.
Production verification uses read-only requests and browser checks; never point
this synthetic-write script at a live domain.

## Private data tooling

`npm run migration -- ...` never prints credentials, voter keys or object contents.
Outputs require a directory with mode 700, use files with mode 600, and refuse to
overwrite existing files. `.migration-private/` is ignored. Keep raw recovery data
outside Git and public reports. Supply the scoped Blob token only in the process
environment; do not pass it on a command line or use a broad environment export
for inventory.

Commands (the examples below are operator actions, not automatic deployment steps):

```bash
npm run migration -- export-blob .migration-private/source-1.json
npm run migration -- validate .migration-private/source-1.json
npm run migration -- to-sql .migration-private/source-1.json .migration-private/import.sql
# Apply only to the intended verified destination, after schema migrations:
npx wrangler d1 execute DB --remote --config wrangler.jsonc --file .migration-private/import.sql
npm run migration -- export-d1 wrangler.jsonc DB --remote .migration-private/d1-check.json
npm run migration -- compare .migration-private/source-1.json .migration-private/d1-check.json
```

`export-d1` also accepts `--local` for a fully local rehearsal. It captures Wrangler
output privately rather than forwarding SQL results to logs. Exports contain exact
Blob paths, raw bytes and SHA-256 digests. Import validates the full snapshot before
writing SQL: expected fields, IDs, ISO timestamps, path/content agreement, duplicate
paths and all target relationships. Corrupt or unknown records stop migration.
Source JSON bytes remain in the backup even though D1 stores their semantic fields.

SQL imports are resumable and refuse to overwrite changed existing rows. A failed
remote file import may have applied earlier statements: keep writes frozen, inspect
private state, rerun only after resolving the cause, and reconcile a complete export.
Never infer success from a successful subset or silently drop a malformed record.
The import preserves string values, identifiers, timestamps, opaque voter keys and
all vote records. Do not reset cookies or migrate only displayed vote totals.

## Freeze, final copy and cutover

1. Complete the DNS authority move with Vercel still serving; rehearse this port
   against synthetic staging data. Inventory every project linked to the Blob
   store and every production/preview/old deployment that can write to it.
2. Enter the approved brief read-only window. Apply a project-level Vercel WAF deny
   for POST `/api/*`, without hostname/environment restrictions, ahead of bypass
   rules. Check current feature availability and prove it covers old deployment
   URLs and previews as well as the custom domain. Preserve current reads and show
   a read-only notice where feasible. Stop every other linked writer. Do not assume
   a new build's maintenance flag protects old immutable deployments.
3. If a complete write freeze cannot be established while preserving reads, stop
   before final copy and coordinate the remaining control. Do not rotate the Blob
   token as an improvised freeze: that can also break reads.
4. Wait for in-flight writes to settle, perform paginated uncached exports, and
   compare successive full snapshots. Import the final validated snapshot into
   production D1 and compare its export byte-for-field at record level. Retain
   all snapshots and the frozen source; counts alone are insufficient.
5. Switch hosting while Cloudflare remains read-only. Verify active route, exact
   native build/version, normal public DNS/TLS, API data, headers and browser UI.
   Then enable Cloudflare writes through native Git and verify the new version.
   Keep Vercel writes frozen to prevent split-brain during DNS caches and rollback.

## Rollback

Before Cloudflare accepts writes, restore Vercel serving and remove the Vercel
write freeze. After any Cloudflare writes, first freeze Cloudflare and export D1:

```bash
npm run migration -- export-d1 wrangler.jsonc DB --remote .migration-private/rollback.json
npm run migration -- restore-blob .migration-private/rollback.json --writers-frozen
npm run migration -- export-blob .migration-private/restored-source.json
npm run migration -- compare .migration-private/rollback.json .migration-private/restored-source.json
```

Restore checks every existing object before adding any missing objects, uses exact
deterministic paths, never overwrites or deletes, and is safe to retry after a
partial transfer. A collision with changed data aborts. Resume Vercel writes only
after full reconciliation and serving verification. A DNS-only rollback after
Cloudflare has accepted writes is unsafe. Retain recovery copies until the owner
approves retirement; no storage deletion or account cancellation is automated.
