# foia.fun

Anonymous FOIA brainstorming webapp for a live event night.

## Stack

- Next.js (React + TypeScript)
- Tailwind CSS
- Vercel Blob (`@vercel/blob`)

## Features

- Anonymous idea submission (no accounts)
- Anonymous comments on ideas
- Upvotes on ideas and comments
- One-vote-per-target per browser via signed server cookie
- Blob-backed persistence for ideas, comments, and votes

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Pull environment variables from Vercel:

```bash
vercel env pull .env.local
```

3. Start dev server:

```bash
npm run dev
# or
./run.sh dev
```

App runs at `http://localhost:3000`.

## Vercel Deploy

1. Import this repo into Vercel.
2. Connect Vercel Blob storage to the project.
3. Confirm `BLOB_READ_WRITE_TOKEN` exists for `development`, `preview`, and `production`.
4. Deploy.

## API Routes

- `GET /api/ideas`
- `POST /api/ideas`
- `GET /api/ideas/:ideaId/comments`
- `POST /api/ideas/:ideaId/comments`
- `POST /api/votes`
