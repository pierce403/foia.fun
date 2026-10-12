# Implementation notes

## 2026-10-12: FOIA Cloudflare port preparation

Base: `27cfd6f565f86676880605385565bea4e289928f`. Work is isolated on
`codex/cloudflare-migration`; production source and Vercel data were not modified.

- Read upstream vinext skill and compatibility/config references. `vinext@1.1.0
  check` reported 94% compatibility: 8 supported, 1 partial (irrelevant
  `turbopack.root`), no issues. Removed that setting.
- Pinned Node 22.23.3, vinext 1.1.0, Vite 8.3.4, Cloudflare Vite 1.63.1 and
  Wrangler 4.149.0. Updated React/RSC to 19.3.0 and Next type/lint compatibility
  packages to 16.4.0 to avoid retaining known earlier-package advisories.
- The source README's signed-cookie claim was inaccurate. Actual `foia_voter`
  values are opaque and unsigned. The runtime cookie code remains unchanged.
- D1 stores every original record and uses a composite vote primary key plus
  transactional insertion/counting. Ten local tests cover races, missing targets,
  import integrity/conflicts, string preservation and reverse restore.
- Local staging HTTP and production-built HTTP suites pass: API status/validation,
  uncached reads, real 404, Secure/HttpOnly/SameSite cookie behavior, cookie reuse,
  concurrent votes and read-only gates with visible notice. Synthetic data only.
- `npm run typecheck`, lint, tests, build and Wrangler dry run pass on Node 22.
  The deployment guard correctly rejects the sentinel production database ID.
- Private CLI rehearsal exported four synthetic objects (one idea, one comment,
  two votes), imported into a second local store, and confirmed exact semantic
  equality with `migration compare`; file and directory permissions were private.
- Root `index.html` was an obsolete static prototype and shadowed the App Router
  homepage in Vite dev. Preserved it under `legacy/`. Built SSR serves the board.
- Miniflare 5 uses a new constructor shape. Tests use its exported
  `convertV4MiniflareOptions` adapter. D1 local state for generated configs is
  under `dist/server/.wrangler`, distinct from source-config `.wrangler` state.
- Current npm audit reports 11 transitive advisories (3 moderate, 8 high), stemming
  from `braces` in build-time globs and `fflate` in the unused OG-image dependency.
  Upstream suggests disruptive framework downgrades; no forced downgrade was
  applied. This is a recorded dependency limitation, not a claim of a clean audit.

Pending coordinator work: provision distinct production/staging D1; source Blob
inventory and freeze; final private export/import/reconciliation; native Git
connection; routes and DNS; managed TLS and public/browser verification. No source
records, secret values, or live writes were inspected during this preparation.

## 2026-10-12: isolated remote rehearsal

- Created `foia-fun-staging` (`60a5b8f4-1a56-4c22-90e2-ded13911c786`)
  and `foia-fun-rehearsal` (`b6d3ccef-0b16-4fd8-bb81-30e539fbb3df`) after
  confirming their names were absent. Both have the tracked D1 schema. Production
  remains unprovisioned. Only the staging ID is bound in source.
- Eight simultaneous remote synthetic vote requests produced exactly one vote;
  a missing target produced none. Only the known synthetic rows were removed;
  zero synthetic records remain. No Worker was published.
- Exported the scoped source Blob store using its selected credential solely in
  process memory. The private preliminary copy has one idea, two comments and two
  votes. Imported all five objects to the unpublished rehearsal D1, exported them,
  and verified every record plus byte-exact reverse conversion of all five objects.
- Raw snapshots and reversed bytes remain only in the coordination project's
  ignored `work/vercel-migration/foia-recovery/`, directory mode700/file mode600.
  No credential was printed or written. The Vercel source was not mutated or
  frozen, so a fresh final export is mandatory during the approved read-only window.
- The rehearsal database must never be bound to a published preview Worker.
  Production cutover, DNS, native Git connection and data freeze remain coordinator
  work. No push, deployment, source-data write or production database change occurred.

## 2026-10-12: empty production database and freeze preparation

- Listed FOIA databases first, then created `foia-fun-production`
  (`2440fefc-b001-4af0-9388-73a0199b3d67`, WNAM). Applied `0001_board.sql`;
  remote count queries confirmed zero ideas, comments and votes. Source binding
  now uses this isolated ID, with `FOIA_READ_ONLY=true`. No source copy was
  imported into production and no Worker was deployed.
- Node22 type generation, typecheck and production build pass with the new ID.
- Vercel firewall read returned no active/draft/version configuration. Prepared
  local-only project-wide freeze and removal bodies in the private recovery
  folder. Current project/production function timeout is 300 seconds; require
  request drain and stable uncached exports. See `docs/vercel-freeze.md`. No firewall write was submitted.

## 2026-10-12: domain route preparation and final freeze scope

- Added ordinary Worker routes for `foia.fun/*` and `www.foia.fun/*`, leaving
  staging with an explicit empty route list. DNS and publication remain with
  the migration coordinator; production is still read-only.
- Exact-host middleware redirects www to HTTPS apex with 308 and preserves the
  path and query. Built Worker tests passed for root, nested/missing paths,
  encoded queries and POST. Apex still returns 200, a genuine 404 and all three
  read-only 503 responses. Lint, types and build pass.
- Tested `next.config` host redirects first, but vinext dropped query strings;
  retained request middleware instead. Wrangler local testing needs explicit
  `--local-upstream www.foia.fun`: its default route origin overrides Host.
- Prepared source WAF rule now denies POST/PUT/PATCH/DELETE project-wide without
  a path condition, covering encoded/rewritten paths. No WAF activation occurred.
  Fresh inventory found three READY deployments and six aliases; all three
  deployment configs have a 300-second function timeout.

## 2026-10-12: isolated staging HTTPS acceptance

- Built the staging environment from 4fc95b0 and verified generated name, empty
  routes, sole staging D1 binding and disabled previews before explicit staging
  deployment. Active version: `6f0e0359-a030-4baf-b49a-21876b76dd9a` at
  `https://foia-fun-staging.bcrt43.workers.dev`. Production native builds and
  production data were untouched.
- Added an exact-host staging-only driver; the localhost-only script is unchanged.
  HTTPS checks passed: home, real404, uncached reads, invalid 400/missing 404,
  idea/comment 201, Secure/HttpOnly/SameSite=Lax/seven-day host-only cookie,
  duplicate 200 without a new cookie, and sixteen concurrent same-cookie requests
  yielding exactly one 201 and fifteen already-voted 200 responses.
- Browser checks rendered the controlled fixture/comment, increased a vote once,
  then retained its count with the duplicate-vote notice on the second click.
  Private screenshot, API metadata and test reports are in coordination recovery
  evidence. Only the exact created one idea, one comment and three votes were
  removed afterward; remote staging counts returned to zero in all tables.
- The first request immediately after new-host deployment returned 404 before
  propagation; it created no records. Browser readiness and a fresh run passed.
  Python urllib's default user agent was blocked 1010 during diagnosis; Node and
  the actual browser succeeded. No network or protection setting was weakened.

## 2026-10-12: public build identity

- `/deployment.json` returns `{project:"foia.fun", revision:<exact Git SHA>}`
  with `Cache-Control: no-store`. Vite substitutes `CF_COMMIT_SHA` at build time,
  falling back to the local Git HEAD, and rejects invalid revision strings.
- The marker is a Worker route rather than a static asset so www host middleware
  also redirects this path. Its response contains no data or runtime secrets.
- Independent normal-DNS acceptance can compare this marker to the exact native
  build/version evidence without printing idea or comment content.
