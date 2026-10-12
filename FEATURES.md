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

Pending live verification: distinct provisioned databases, complete frozen-source
copy, exact native build/version, domain/TLS/browser checks and post-cutover state.
