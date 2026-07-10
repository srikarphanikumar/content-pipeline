# Under The Hood Content Pipeline Status

Last updated: July 10, 2026

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
RESEND_API_KEY
NEWSLETTER_FROM_EMAIL
```

Admin/pipeline:

```txt
DATABASE_URL
NEON_AUTH_BASE_URL
NEON_AUTH_COOKIE_SECRET
ADMIN_EMAIL
ALLOW_ADMIN_SIGNUP              should be false after admin account exists
DEVTO_API_KEY
OPENAI_API_KEY
LINKEDIN_CLIENT_ID
LINKEDIN_CLIENT_SECRET
LINKEDIN_REDIRECT_URI
BLUESKY_HANDLE
BLUESKY_APP_PASSWORD
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
- `PlatformConnection`
- `PromotionAsset`
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
/subscribe/confirm
/unsubscribe
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
- Captures newsletter subscribers.
- Sends Resend confirmation emails.
- Confirms subscriptions through `/subscribe/confirm?token=...`.
- Supports unsubscribe through `/unsubscribe?token=...`.

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
/topics
/import/substack
/subscribers
/settings
/api/oauth/linkedin/start
/api/oauth/linkedin/callback
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
- Has a topic backlog page for new post ideas.
- Can import Substack content.
- Can view subscribers by status.
- Can manually activate or unsubscribe subscribers.
- Can create dev.to draft articles from post edit pages.
- Can connect LinkedIn through OAuth and store the platform connection.
- Shows Bluesky env configuration status.
- Can generate and edit LinkedIn/Bluesky promotion copy from post edit pages.
- Uses a shared black/orange admin shell with persistent navigation.

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
/topics/*
/import/*
/subscribers/*
/settings/*
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

### Subscriber Capture

Subscriber capture is implemented on the public blog.

Implemented:

- Homepage subscribe form server action.
- Subscriber create/update in Neon.
- Confirmation tokens.
- Unsubscribe tokens.
- Confirmation route at `/subscribe/confirm?token=...`.
- Unsubscribe route at `/unsubscribe?token=...`.
- Source/referrer tracking.
- Resend client wiring.
- Production Resend sender configured and tested.

Still needed:

- Add resend confirmation action from admin for pending subscribers.

### Email Sending

Resend is wired for subscription confirmation.

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

### Social Promotion Setup

LinkedIn OAuth setup and promotion copy generation are implemented. Bluesky env setup is configured and visible in settings. Posting to LinkedIn/Bluesky and Mastodon are not wired yet.

Implemented:

- LinkedIn connect route at `/api/oauth/linkedin/start`.
- LinkedIn callback route at `/api/oauth/linkedin/callback`.
- OAuth state validation cookie.
- Token exchange and `/v2/userinfo` lookup.
- LinkedIn connection storage in `PlatformConnection`.
- Settings page at `/settings` with connect/reconnect status.
- Bluesky settings card based on `BLUESKY_HANDLE` and `BLUESKY_APP_PASSWORD`.
- OpenAI promotion copy generator.
- Promotion assets stored in `PromotionAsset`.
- Editable LinkedIn post, LinkedIn first comment, and Bluesky post drafts.

Needed:

- LinkedIn post API call after promotion copy is generated.
- Bluesky post API call after promotion copy is generated.
- Mastodon connection setup if that channel becomes useful.

### No AI Draft Generation Yet

The admin has a topic backlog, but does not yet generate topics or drafts automatically.

Needed:

- Prompt templates.
- AI topic generation.
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

### Immediate Next Step: UX Pass

The first UX pass is underway and the core MVP loop now works:

```txt
Blog archive
Newsletter capture
Subscriber management
dev.to draft creation
LinkedIn OAuth
Bluesky setup
Promotion copy generation
```

Implemented in this pass:

- Shared black/orange admin shell.
- Persistent links to Dashboard, Posts, Topics, Subscribers, Settings, and Blog.
- Dashboard replaced stale BRD/dummy queue with live workflow cards.
- Posts list now has status filters, clearer status badges, and row-level navigation.
- Post workspace now groups Blog, dev.to, Promotion, and Edit sections.
- Copy-to-clipboard controls for generated promotion assets.
- Settings page redesigned as provider status cards.
- Topic backlog page added with topic creation and status updates.

Still useful to improve:

- Better empty/loading/error states.
- Mobile/tablet polish.
- Optional active nav state.
- More detailed topic-to-post conversion flow.

### After UX: Posting Actions

Build:

- Post generated Bluesky copy through the Bluesky API.
- Post generated LinkedIn copy through the LinkedIn API.
- Store posted URLs/statuses in `PlatformPublication`.
- Add retry/error states for failed platform posts.

### After Posting: Draft/Topic Pipeline

Build:

- Topic backlog UI.
- OpenAI topic generation.
- Draft generation flow.
- Ready-buffer workflow for maintaining 20 draft-ready posts.

### Later Improvements

- Update existing dev.to drafts.
- Publish live to dev.to from admin after review.
- Pull dev.to stats/status back into admin.
- Resend confirmation email action from admin for pending subscribers.
- Subscriber CSV export.
- Weekly digest generation/manual send flow.
- Image generation for new posts.
- UTM parsing and conversion reporting.
- Auto-classify imported posts into richer topics/tags.
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
