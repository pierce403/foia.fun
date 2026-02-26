# AGENTS.md - Working Notes for Coding Agents

## Self-Improvement Directive

Update this file whenever you learn something important about this repo.
Capture what worked, what failed, and collaborator preferences that help future agents move faster.

## Project Snapshot (Verified February 26, 2026)

- App: FOIA idea board for a one-night event.
- Stack: Next.js App Router, React, TypeScript, Tailwind CSS v4.
- Runtime model: anonymous posting/upvoting, no accounts.
- Current backend code uses Postgres-compatible SQL via `@neondatabase/serverless` and `DATABASE_URL`.
- Vercel Blob store exists and is connected:
  - Store name: `foia.fun-blob`
  - Env var available in `development`, `preview`, `production`: `BLOB_READ_WRITE_TOKEN`
  - Note: app code has not yet been migrated from SQL to Blob.

## Repo Structure

- `src/app`: Next.js pages/layout and API route handlers.
- `src/app/api/ideas`: list/create ideas.
- `src/app/api/ideas/[ideaId]/comments`: list/create comments.
- `src/app/api/votes`: anonymous vote endpoint.
- `src/components/foia-board.tsx`: main UI board.
- `src/lib/db.ts`: SQL data layer and schema bootstrap.
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
  - Vercel storage API (with CLI auth token) can show exact store/project links.

## Known Pitfalls

- `@vercel/postgres` is deprecated for new setups; current code uses Neon driver instead.
- Missing `DATABASE_URL` will break existing API routes until migrated to Blob.
- This project currently has no account/auth layer by design; do not introduce login requirements unless requested.

## Collaboration Cues

- User prefers direct, practical execution.
- User explicitly requested React + Tailwind + TypeScript.
- User asked for AGENTS documentation quality informed by recurse.bot.
- User requested that work be committed and pushed after completion.

## Git Workflow Requirement

When you complete requested work in this repo:

1. Run validation commands relevant to the change.
2. Commit with a clear message.
3. Push to the current remote branch.

If push fails due to auth/remote restrictions, report the exact failure and next needed action.
