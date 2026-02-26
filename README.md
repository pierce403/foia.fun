# foia.fun

Anonymous FOIA brainstorming webapp for a live event night.

## Stack

- Next.js (React + TypeScript)
- Tailwind CSS
- Neon Postgres via Vercel (`DATABASE_URL`)

## Features

- Anonymous idea submission (no accounts)
- Anonymous comments on ideas
- Upvotes on ideas and comments
- One-vote-per-target per browser via signed server cookie
- Auto-created database schema on first API request

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env.local` from `.env.example` and set `DATABASE_URL`.

3. Start dev server:

```bash
npm run dev
```

App runs at `http://localhost:3000`.

## Vercel Deploy

1. Import this repo into Vercel.
2. Add a Postgres/Neon storage integration (or any Postgres provider).
3. Set `DATABASE_URL` in Vercel project environment variables.
4. Deploy.

The app creates required tables automatically when the first request hits the API.

## API Routes

- `GET /api/ideas`
- `POST /api/ideas`
- `GET /api/ideas/:ideaId/comments`
- `POST /api/ideas/:ideaId/comments`
- `POST /api/votes`
