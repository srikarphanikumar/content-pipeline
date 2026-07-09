# Content Pipeline

Monorepo for the Under The Hood publishing system.

## Apps

- `apps/blog`: public blog/newsletter app for `blog.mspk.me`.
- `apps/admin`: private content pipeline app for imports, drafting, publishing, syndication, and tracking.
- `packages/db`: shared Prisma schema and client package.

## Quick Start

```bash
npm install
npm run dev:blog
npm run dev:admin
```

Default local URLs:

- Blog: `http://localhost:3000`
- Admin: `http://localhost:3001`

## Database

Copy `.env.example` to `.env` and set `DATABASE_URL`.

```bash
npm run db:generate
npm run db:migrate
npm run db:studio
```

## Current MVP Slice

- BRD captured in `MVP_BRD.md`.
- Public blog shell with newsletter positioning and starter post archive section.
- Admin dashboard shell with 20-post buffer, import progress, cadence, and build queue.
- Shared Prisma data model for posts, topics, subscribers, users, and platform publishing status.

