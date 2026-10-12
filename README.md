# foia.fun

Anonymous FOIA brainstorming board: submit ideas and comments, and upvote either
without an account. The Cloudflare port uses the existing React App Router UI,
vinext, and D1. Git pushes to the configured production branch are published by
Cloudflare Workers Builds. Deployment credentials stay in Cloudflare.

## Development

Use Node 22 (`.nvmrc` pins 22.23.3) and the checked-in npm lockfile.

```bash
npm ci
npm run types
npx wrangler d1 migrations apply DB --local --env staging
CLOUDFLARE_ENV=staging npm run dev
```

Staging uses a separate D1 binding and permits local synthetic writes. The default
configuration starts read-only. Both checked-in D1 IDs are placeholders until the
migration coordinator provisions and verifies the two separate databases. No
command in the development instructions accesses remote D1.

```bash
npm run lint
npm run typecheck
npm test
npm run check:deploy
```

`npm test` exercises real local D1 semantics, import validation, duplicate vote
races and rollback conversion. `check:deploy` builds and packages without publishing.
See [the migration runbook](docs/cloudflare-migration.md) for HTTP smoke checks,
private data transfer and production cutover.

## API and identity

- `GET /api/ideas` lists ideas; `POST /api/ideas` creates an idea.
- `GET /api/ideas/:ideaId/comments` lists comments; POST creates a comment.
- `POST /api/votes` returns `added` (201), `already_voted` (200), or a missing-target
  error (404). Uniqueness is `(target type, target ID, browser key)` in D1.
- `foia_voter` is an opaque, unsigned, host-only browser cookie. It is HttpOnly,
  SameSite=Lax, Secure in production, and lasts seven days. Existing values remain
  valid after migration. It is not proof of a unique person.
- Ideas sort by vote count descending, then newest; comments use the same order.
- During migration, `FOIA_READ_ONLY=true` preserves reads and rejects every
  mutation with 503 and `Retry-After: 60`. Only the exact value `false` enables writes.

`legacy/original-static-index.html` preserves the earlier static prototype. It is
not a runtime entrypoint; leaving it at the root shadows App Router in Vite dev.
The previous Vercel deployment and Blob store remain the recovery source until
live reconciliation and rollback readiness are verified.
