# Feature verification

## Anonymous board on Cloudflare

- Existing idea/comment/vote APIs and seven-day opaque voter cookie remain compatible.
- D1 preserves IDs, timestamps, text, relationships and individual voter keys.
- Composite vote uniqueness and transactional inserts prevent duplicate concurrent votes.
- Read-only migration mode leaves reads available and rejects all mutations.
- Production native Git uses tracked migrations; staging has a separate binding.
- Exact www hostname redirects to HTTPS apex, preserving path and query.
- Uncached `/deployment.json` exposes the exact revision embedded during build.

Verified locally: lint, types, ten real-D1 tests, development and built-Worker HTTP
suites, cookie flags, import/rollback conversion, genuine 404 and package dry run.
Built Worker checks also verify www 308, encoded query preservation, untouched
apex routing and all three maintenance 503 gates.

Verified isolated staging over HTTPS: status contract, secure voter cookie,
sixteen-request duplicate race, rendered comment and browser duplicate notice.
All exact synthetic fixtures were removed; staging returned to zero records.

Distinct production, staging and rehearsal databases are provisioned. The first
source-freeze window was safely aborted before final copying; original Vercel
serving is restored, with Cloudflare production still empty/read-only.

Pending live acceptance: authenticated old-source freeze, complete stable final
copy and reconciliation, exact native release identity, apex hosting cutover and
post-cutover write state. The independent www redirect is live and verified.
