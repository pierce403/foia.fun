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
