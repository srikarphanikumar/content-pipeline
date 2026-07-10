# Under The Hood Content Pipeline Status

Last updated: July 9, 2026

## Current Deployment

The project is deployed as two separate Vercel apps from the same GitHub repository.

- Public blog: `https://blog.mspk.me`
- Private admin/pipeline: `https://pipeline.mspk.me`
- GitHub repo: `https://github.com/srikarphanikumar/content-pipeline.git`
- Main branch: `main`

## Architecture

This is an npm workspace monorepo.

```txt
apps/blog        Public blog/newsletter site
apps/admin       Private content pipeline/admin app
packages/db      Shared Prisma schema, Prisma client, content helpers, import scripts
```

The blog and admin are deployed as separate Vercel projects with different root directories:

```txt
apps/blog
apps/admin
```

Both apps use the same Neon Postgres database through `DATABASE_URL`.

## Environment Variables

Shared:

```txt
DATABASE_URL
```

Blog:

```txt
DATABASE_URL
BLOG_BASE_URL                    optional, defaults to https://blog.mspk.me
RESEND_API_KEY                  currently placeholder/not wired yet
NEWSLETTER_FROM_EMAIL           currently placeholder/not wired yet
```

Admin/pipeline:

```txt
DATABASE_URL
NEON_AUTH_BASE_URL
NEON_AUTH_COOKIE_SECRET
ADMIN_EMAIL
ALLOW_ADMIN_SIGNUP              should be false after admin account exists
DEVTO_API_KEY                   currently placeholder/not wired yet
```

Important security note:

- The Neon database URL and auth secret were visible in screenshots during setup.
- After the MVP stabilizes, rotate:
  - Neon database password / connection string
  - `NEON_AUTH_COOKIE_SECRET`
  - any password used during exposed test sign-up attempts

## Database

Database provider:

```txt
Neon Postgres
```

Prisma is configured in:

```txt
packages/db/prisma/schema.prisma
packages/db/prisma.config.ts
```

Initial migration has been applied to Neon:

```txt
packages/db/prisma/migrations/20260709050350_init_content_pipeline
```

Core models currently exist for:

- `User`
- `Topic`
- `Post`
- `PlatformPublication`
- `Subscriber`

Important post fields:

```txt
title
slug
subtitle
description
bodyMarkdown
coverImageUrl
tags
status
canonicalUrl
sourcePlatform
sourceUrl
publishedAt
```

Current imported content state:

```txt
Total posts: 50
Substack posts: 50
Posts with cover images: 44
```

## What Has Been Built

### 1. Planning / BRD

Created:

```txt
MVP_BRD.md
```

It defines the combined product:

- App 1: public blog/newsletter at `blog.mspk.me`
- App 2: private content pipeline at `pipeline.mspk.me`

Core MVP goals documented there:

- Own the archive on `blog.mspk.me`
- Import all existing Substack posts
- Capture subscribers
- Maintain a 20-post buffer
- Publish/syndicate to dev.to later
- Generate LinkedIn/social copy later
- Track platform status

### 2. Monorepo Scaffold

Created a Next.js monorepo with:

```txt
apps/blog
apps/admin
packages/db
```

Root scripts include:

```bash
npm run dev:blog
npm run dev:admin
npm run build
npm run lint
npm run db:generate
npm run db:migrate
npm run db:studio
```

### 3. Public Blog

Public routes currently include:

```txt
/
/posts
/posts/[slug]
/topics/[slug]
/rss.xml
```

The blog currently:

- Reads posts from Neon.
- Renders Markdown post bodies.
- Renders Substack cover images.
- Has a black/orange visual theme.
- Uses a wider card layout for `/posts`.
- Supports pagination on `/posts`.
- Uses a sticky sidebar on individual post pages for subscribe/context.
- Exposes an RSS feed at `/rss.xml`.

Recent design changes:

- Top nav simplified to only show `Posts`.
- Removed separate top nav `Subscribe` and `About`.
- Removed the old about section.
- Landing hero now uses animated rotating cards:
  - technical breakdowns card
  - publication/about card
- Landing latest section uses simple cards with:
  - image
  - tag
  - heading
- `/posts` uses a wider multi-column card grid.

### 4. Admin / Pipeline App

Admin routes currently include:

```txt
/
/auth/sign-in
/auth/sign-up
/api/auth/[...path]
/posts
/posts/new
/posts/[id]
/import/substack
/subscribers
```

Admin currently:

- Is protected by Neon Auth.
- Has sign-in and sign-up pages.
- Uses `ADMIN_EMAIL` to restrict allowed sign-up email.
- Has sign-up disabled unless `ALLOW_ADMIN_SIGNUP=true`.
- Shows dashboard counts from Neon.
- Shows ready-post buffer count.
- Can create posts manually.
- Can edit posts manually.
- Can list posts.
- Can import Substack content.
- Can view subscribers by status.
- Can manually activate or unsubscribe subscribers.
- Can create dev.to draft articles from post edit pages.

### 5. Neon Auth

Neon Auth is wired for the admin app.

Important files:

```txt
apps/admin/src/lib/auth/server.ts
apps/admin/src/lib/auth/client.ts
apps/admin/src/app/api/auth/[...path]/route.ts
apps/admin/proxy.ts
apps/admin/src/app/auth/sign-in/page.tsx
apps/admin/src/app/auth/sign-up/page.tsx
```

Protected routes:

```txt
/
/posts/*
/import/*
/subscribers/*
```

Things fixed during setup:

- Added Neon Auth domain/origin in Neon Console for `pipeline.mspk.me`.
- Surfaced Neon Auth errors in the UI instead of hiding them behind generic messages.
- Disabled public sign-up by default once admin account creation is complete.

### 6. Substack Import

Initial RSS import:

```txt
https://mspk.substack.com/feed
```

Findings:

- RSS feed is valid.
- RSS exposes full content.
- RSS only exposes latest 20 posts.

Then built full sitemap importer:

```txt
https://mspk.substack.com/sitemap.xml
```

Findings:

- Sitemap contains all 50 post URLs.
- Individual Substack post pages expose embedded metadata and body HTML.
- We parse those post pages to import all 50 posts.

Importer commands:

```bash
npm run import:substack -- https://mspk.substack.com/feed
npm run import:substack-sitemap -- https://mspk.substack.com/sitemap.xml
npm run import:substack-sitemap -- https://mspk.substack.com/sitemap.xml --replace
```

The final import used:

```bash
npm run import:substack-sitemap -- https://mspk.substack.com/sitemap.xml --replace
```

This deleted existing Substack-sourced posts and rebuilt all 50 consistently from sitemap/page data.

Import cleanup handled:

- Extracted title.
- Extracted subtitle.
- Extracted description/excerpt.
- Extracted post date.
- Extracted canonical Substack URL.
- Extracted cover image.
- Converted body HTML to Markdown.
- Removed Substack linked-image Markdown artifacts.
- Stored cover images separately in `coverImageUrl`.
- Removed duplicate leading cover images from post bodies.

Repair scripts created:

```bash
npm run repair:substack-excerpts
npm run repair:substack-images
```

These were used to fix earlier RSS-imported data before the final sitemap replace import.

## Key Commits So Far

```txt
83bb7ca Initial content pipeline scaffold
7779101 Wire Neon database
c8d202b Generate Prisma client before app builds
59100d9 Add blog and admin post routes
4c04fdc Protect admin with Neon Auth
71f4cdc Show Neon Auth errors in admin forms
1474186 Add Substack RSS importer
fb7d1ab Add Substack import CLI
67c6d5a Fix Substack imported excerpts
4138e39 Render Substack cover images cleanly
dd1f849 Update blog archive card layouts
ebde00b Add full Substack sitemap importer
9f7eae2 Refresh blog theme
```

## Known Issues / Gaps

### Subscriber Flow Not Implemented Yet

Basic subscriber capture is now implemented on the public blog.

Implemented:

- Homepage subscribe form server action.
- Subscriber create/update in Neon.
- Confirmation tokens.
- Unsubscribe tokens.
- Confirmation route at `/subscribe/confirm?token=...`.
- Unsubscribe route at `/unsubscribe?token=...`.
- Source/referrer tracking.
- Resend client wiring with graceful fallback when email env vars are missing.

Still needed:

- Configure real `RESEND_API_KEY`.
- Verify sender/domain for `NEWSLETTER_FROM_EMAIL`.
- Send a production confirmation email test.
- Add resend confirmation action from admin for pending subscribers.

### No Email Sending Yet

Resend is wired for subscription confirmation, but production env vars still need to be configured.

Needed:

- Weekly digest email generation.
- Manual send flow from admin.

### dev.to Draft Publishing

The BRD calls for dev.to as the main discovery platform. Draft creation is now wired.

Implemented:

- `DEVTO_API_KEY` server action integration.
- Draft-first `POST /api/articles` call.
- Canonical URL set to `https://blog.mspk.me/posts/[slug]`.
- Newsletter CTA appended to dev.to Markdown.
- Cover image sent to dev.to when `coverImageUrl` exists.
- dev.to article id/url stored in `PlatformPublication`.
- dev.to status badge on the admin posts list.

Still needed:

- Update existing dev.to drafts.
- Publish live from admin after review.
- Pull dev.to stats/status back into admin.

### No Social Promotion Yet

LinkedIn, Bluesky, Mastodon copy generation/posting is not implemented yet.

Needed:

- Promotion asset model or fields.
- LinkedIn post generator.
- First comment CTA generator.
- Bluesky/Mastodon short post generator.
- Manual copy initially.
- API/browser automation later.

### No AI Draft Generation Yet

The admin does not yet generate topics or drafts.

Needed:

- AI provider decision.
- Prompt templates.
- Topic backlog UI.
- Draft generation flow.
- 20-post buffer automation.

### No Image Generation Yet

Imported posts have Substack images, but new image generation is not implemented.

Needed:

- Image prompt generation.
- OpenAI/Google image API.
- Store generated image URL.
- Regenerate/approve flow.

### No Production Subscriber Analytics Yet

No event tracking exists yet.

Needed:

- Subscriber source tracking.
- UTM parsing.
- Post view tracking.
- Conversion reporting.

### Tags Are Basic

All sitemap-imported posts currently use a basic `Substack` tag unless richer tags are available.

Possible improvement:

- Auto-classify imported posts by topic:
  - Frontend
  - JavaScript
  - CSS
  - Browser Internals
  - AI
  - React
  - Performance

### Imported Markdown May Need Spot QA

The 50 sitemap imports are working, but Substack HTML is complex. We should spot-check several posts for:

- code blocks
- lists
- images
- headings
- special characters
- embedded links

## Recommended Next Steps

### Immediate Next Step: Finish Subscriber Email Setup

Subscriber capture is implemented. The immediate remaining setup is making confirmation email delivery work in production.

Configure:

```txt
RESEND_API_KEY
NEWSLETTER_FROM_EMAIL
BLOG_BASE_URL
```

Then test:

```txt
Submit homepage subscribe form
Receive confirmation email
Open /subscribe/confirm?token=...
Open unsubscribe link
```

### Admin Subscriber Management

Implemented:

```txt
Subscriber list
Status filters
Source/referrer columns
Manual unsubscribe/reactivate
```

Still needed:

```txt
Resend confirmation email from admin
CSV export
```

### After Subscriber Capture: dev.to Publishing

Build dev.to adapter:

```txt
Admin selects post
Generate dev.to Markdown with CTA
Publish to dev.to API
Store dev.to URL
Mark platform status
```

CTA should point back to:

```txt
https://blog.mspk.me
```

or post-specific:

```txt
https://blog.mspk.me/posts/[slug]
```

### After dev.to: Promotion Copy

Build:

- LinkedIn hook generator.
- LinkedIn post generator.
- First comment generator.
- Bluesky/Mastodon short copy.

First comment direction:

```txt
I write deeper frontend + AI internals breakdowns in Under The Hood.
Subscribe here: https://blog.mspk.me
```

### After Promotion: Topic/Draft Pipeline

Build:

- Topic backlog.
- Novelty scoring.
- Draft editor.
- AI-generated Markdown drafts.
- 20-post ready buffer dashboard.

## Useful Commands

Run local apps:

```bash
npm run dev:blog
npm run dev:admin
```

Run checks:

```bash
npm run lint
npm run build
```

Database:

```bash
npm run db:generate
npm run db:migrate -- --name migration_name
npm run db:studio
```

Import Substack RSS:

```bash
npm run import:substack -- https://mspk.substack.com/feed
```

Import full Substack archive from sitemap:

```bash
npm run import:substack-sitemap -- https://mspk.substack.com/sitemap.xml --replace
```

Repair scripts:

```bash
npm run repair:substack-excerpts
npm run repair:substack-images
```

## Current Product State

The project is now a working owned archive and private admin foundation.

Done:

- Public blog deployed.
- Admin deployed.
- Neon DB wired.
- Neon Auth wired.
- All 50 existing Substack posts imported.
- Blog theme refreshed.
- Archive and article pages functional.
- Full sitemap importer available.

Still to build:

- Real subscriber capture.
- Email confirmation and unsubscribe.
- dev.to publishing.
- Promotion copy generation.
- Topic/draft generation.
- 20-post buffer workflows.
- Analytics.
- New post generation and syndication pipeline.
