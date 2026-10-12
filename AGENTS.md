# AGENTS.md - Working Notes for Coding Agents

## Self-Improvement Directive

Update this file whenever you learn something important about this repo.
Capture what worked, what failed, and collaborator preferences that help future agents move faster.

## Project Snapshot (Verified February 26, 2026)

- App: FOIA idea board for a one-night event.
- Stack: Next.js App Router, React, TypeScript, Tailwind CSS v4.
- Runtime model: anonymous posting/upvoting, no accounts.
- Backend storage now uses Vercel Blob via `@vercel/blob` and `BLOB_READ_WRITE_TOKEN`.
- Vercel Blob store connected:
  - Store name: `foia.fun-blob`
  - Env var expected in `development`, `preview`, `production`: `BLOB_READ_WRITE_TOKEN`

## Repo Structure

- `src/app`: Next.js pages/layout and API route handlers.
- `src/app/api/ideas`: list/create ideas.
- `src/app/api/ideas/[ideaId]/comments`: list/create comments.
- `src/app/api/votes`: anonymous vote endpoint.
- `src/components/foia-board.tsx`: main UI board.
- `src/lib/db.ts`: Blob-backed data access layer.
- `src/lib/voter.ts`: anonymous cookie key logic.
- `run.sh`: local run wrapper (`dev`, `build`, `start`, `lint`).

## Verified Commands

```bash
# install deps
npm install

# lint
npm run lint
# or
./run.sh lint

# dev server
npm run dev
# or
./run.sh dev

# production build
npm run build
# or
./run.sh build

# start built app
npm run start
# or
./run.sh start
```

## Vercel Notes

- Project link metadata: `.vercel/project.json`.
- Team scope used here: `pierce403-projects`.
- `vercel integration list` may report `No resources found` even when a store exists.
- Reliable checks:
  - `vercel env pull <file> --environment=<env> --scope pierce403-projects` then inspect keys for `BLOB_READ_WRITE_TOKEN`.
  - Vercel storage API can show exact store/project links.

## Known Pitfalls

- If `BLOB_READ_WRITE_TOKEN` is missing, API routes that write/read data will fail.
- Blob list operations are eventually consistent and can be slower than a relational DB for large datasets.
- Voting uniqueness is enforced per target+browser key via deterministic vote blob paths.
- This project currently has no account/auth layer by design; do not introduce login requirements unless requested.

## Collaboration Cues

- User prefers direct, practical execution.
- User explicitly requested React + Tailwind + TypeScript.
- User requested AGENTS documentation quality informed by recurse.bot.
- User requested that work be committed and pushed after completion.

## Git Workflow Requirement

When you complete requested work in this repo:

1. Run validation commands relevant to the change.
2. Commit with a clear message.
3. Push to the current remote branch.

If push fails due to auth/remote restrictions, report the exact failure and next needed action.

## Cloudflare migration update (2026-10-12)

The Cloudflare port uses vinext plus native D1. Follow README and
`docs/cloudflare-migration.md`; earlier Vercel notes above describe the recovery
source. Do not pull secret values for inventory. The Blob token belongs only in
private migration processes and never in Cloudflare runtime or GitHub.

- Use Node 22.23.3 and pinned package-lock dependencies.
- Run lint, typecheck, `npm test`, and `npm run check:deploy` before publication.
- Production publishing belongs to native Workers Builds; do not overlap manual
  deployment. Vercel Git builds are disabled, but old deployments still exist.
- Preserve the exact `foia_voter` cookie and every existing voter key. The cookie
  is unsigned, despite the earlier README wording; do not reset identities.
- D1 IDs are placeholders until verified provisioning. Production starts read-only;
  do not enable writes before the frozen final copy and full reconciliation.
- Never attach production D1 to previews or run localhost-only synthetic mutation
  checks against production. Keep private snapshots in ignored mode-700 directories.
- The obsolete static prototype lives in `legacy/`; moving it back to root
  `index.html` shadows the real App Router homepage in Vite dev.
- During delegated migration preparation, the coordinator owns pushing, resource
  provisioning, DNS, source-data transfer, freeze and final cutover. Local focused
  commits are handed back before those actions.
