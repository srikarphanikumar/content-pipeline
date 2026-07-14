# Under The Hood Content Pipeline Status

Last updated: July 11, 2026

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
RESEND_API_KEY
NEWSLETTER_FROM_EMAIL
DEVTO_API_KEY
OPENAI_API_KEY
OPENAI_IMAGE_MODEL              optional, defaults to gpt-image-2
OPENAI_IMAGE_SIZE               optional, defaults to 1536x1024
BLOB_READ_WRITE_TOKEN           Vercel Blob token for generated cover images
LINKEDIN_CLIENT_ID
LINKEDIN_CLIENT_SECRET
LINKEDIN_REDIRECT_URI
LINKEDIN_API_VERSION            optional, defaults to 202606
BLUESKY_HANDLE
BLUESKY_APP_PASSWORD
INNGEST_EVENT_KEY
INNGEST_SIGNING_KEY
INNGEST_ENV                     production
TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN
TWILIO_WHATSAPP_FROM            whatsapp:+15559806853
TWILIO_MESSAGING_SERVICE_SID
WHATSAPP_TO                     whatsapp:+12038431589
TWILIO_MORNING_TEMPLATE_SID
TWILIO_NIGHTLY_TEMPLATE_SID
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
packages/db/prisma/migrations/20260711152000_add_notification_deliveries
```

Core models currently exist for:

- `User`
- `Topic`
- `Post`
- `PlatformPublication`
- `PlatformConnection`
- `PromotionAsset`
- `Subscriber`
- `NotificationDelivery`

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
/api/inngest
/api/topics/suggest
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
- Can recreate a dev.to draft if the remote dev.to draft was manually deleted.
- Can connect LinkedIn through OAuth and store the platform connection.
- Shows Bluesky env configuration status.
- Can generate and edit LinkedIn/Bluesky promotion copy from post edit pages.
- Can post saved LinkedIn and Bluesky promotion copy from post edit pages.
- Stores LinkedIn and Bluesky posting status, external ids/URLs, publish timestamps, and errors.
- Can publish the canonical blog post from the post workspace.
- Records canonical blog publishing as a `BLOG` platform publication.
- Has top-row post workspace buttons for:
  - `Approve and publish`
  - `Publish blog`
  - `Post to socials`
- `Approve and publish` marks a reviewed post ready, publishes the blog canonical, then posts to dev.to, LinkedIn, and Bluesky.
- `Post to socials` publishes/skips idempotently across dev.to, LinkedIn, and Bluesky.
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

### WhatsApp Notifications

Twilio WhatsApp production setup is operational for test sends.

Implemented:

- Twilio env configuration is wired in the admin app.
- WhatsApp sender is configured as `whatsapp:+15559806853`.
- Recipient is configured as `whatsapp:+12038431589`.
- Morning and nightly Twilio Content template SIDs are configured.
- Morning Inngest summary reports selected topic/post readiness and platform outcomes.
- Nightly Inngest summary reports available platform stats and next-day topic context.
- Settings page has a test WhatsApp send action and notification delivery logging.
- Inngest cron schedules now run on weekdays only in `America/New_York` time:
  - topic planning: 5:30 AM
  - draft buffer: 5:45 AM
  - approval prep: 6:00 AM
  - morning summary: 6:45 AM
  - nightly stats/topic prep: 9:00 PM

Next checks:

- Confirm the weekday morning and nightly Inngest template sends arrive end to end.
- Use the delivery log in Settings to watch Twilio status, error codes, and message SIDs.
- Keep nightly summaries tied to stored analytics snapshots instead of one-off live fetches.

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
- dev.to draft can be recreated if the remote draft is manually deleted.
- dev.to publishing is included in the one-click `Post to socials` action.

Still needed:

- Update existing dev.to drafts.
- Pull dev.to stats/status back into admin.

### Social Promotion Setup

LinkedIn OAuth setup and promotion copy generation are implemented. Bluesky env setup is configured and visible in settings. Posting to LinkedIn and Bluesky is wired from the post workspace. Mastodon is not wired yet.

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
- LinkedIn post API call using saved LinkedIn copy.
- LinkedIn image upload through Images API when `coverImageUrl` exists.
- Bluesky post API call using the saved Bluesky copy.
- Bluesky posts include rich-text facets so URLs and hashtags render as links/tags.
- LinkedIn and Bluesky platform publication status/error tracking.
- One-click `Post to socials` posts to LinkedIn and Bluesky while skipping already-published platforms.

Needed:

- Optional LinkedIn first-comment publishing.
- Rich Bluesky link facets/cards if desired.
- Mastodon connection setup if that channel becomes useful.

### Topic / Draft Pipeline

The admin now separates the imported/published archive from the future post queue.

Implemented:

- `/posts` defaults to the future queue instead of showing imported Substack posts.
- Imported Substack posts live under `/posts?view=archive`.
- `/topics` is the idea backlog and excludes completed topics from the active list.
- `Suggest next topics` CTA checks:
  - already-published/imported post titles
  - current post queue
  - existing topic backlog
- Suggested ideas are created as `Topic` rows with `backlog` status.
- OpenAI is used when `OPENAI_API_KEY` exists; deterministic fallback ideas are available otherwise.
- Topic generation is biased toward uncommon AI + accessibility + frontend ideas.
- Topics can be cleared in bulk from the Ideas page.
- Backlog topics can be bulk-moved to `selected`.
- A topic can now create a linked draft post and redirect into the post workspace.
- Draft generation uses OpenAI when available and a structured fallback draft otherwise.
- Draft generation now samples published post excerpts and prompts for a 1200-1800 word, human, Under The Hood voice.
- Daily Inngest function tops up active backlog topics when the count drops below 20.
- Daily Inngest draft-buffer function creates at most 2 `DRAFTING` posts from selected topics when the draft-ready buffer is below 20.
- Inngest-generated drafts also generate and store cover images immediately.
- Generated draft headings use `##` sections for dev.to visibility.
- Topics page has compact bulk controls:
  - capture idea modal
  - move all backlog to selected
  - prepare next selected
  - draft all selected
  - copy all topic titles
  - clear all topics
- `Prepare next selected` creates one full prepared post from the first selected topic:
  - canonical article draft
  - generated cover image
  - dev.to draft
  - LinkedIn and Bluesky promo copy
- `Draft all selected` creates linked draft records in bulk without attempting every expensive platform step in one request.
- Weekday morning approval prep runs at 6:00 AM ET and ensures at least one pipeline-owned post is `DRAFT_READY` or `READY_TO_PUBLISH` before the morning summary.
- Morning WhatsApp summary reports ready posts, drafts needing review, platform activity, and failures.
- Nightly WhatsApp summary reports dev.to/Bluesky stats where available, LinkedIn status, and next-day selected topics.

Needed:

- Clearer background job progress for bulk draft creation/preparation.
- Optional Inngest event to prepare multiple selected posts one-by-one without browser request timeouts.
- Review/approval workflow between `DRAFT_READY` and `PUBLISHED_BLOG`.
- LinkedIn analytics permissions for impression metrics.

### Image Generation

Imported posts have Substack images, and new/generated posts can now get AI-generated cover images.

Implemented:

- OpenAI image generation for post cover images.
- Editorial article-cover prompt based on title, subtitle, description, tags, and body excerpt.
- Vercel Blob storage for durable public image URLs.
- Admin post workspace preview and generate/regenerate action.
- Generated image URL stored in `Post.coverImageUrl`.
- Blog and dev.to automatically use `coverImageUrl`.
- LinkedIn posting uploads the cover image and creates an image-backed post when available.
- `Prepare next selected` generates the cover image as part of the prepared-post workflow.

Needed:

- Optional Nano Banana/Gemini provider.
- Optional explicit approve/reject history for generated variants.
- Optional per-platform crop/aspect variants.

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

### Completed UX Pass

The first UX pass is underway and the core MVP loop now works:

```txt
Blog archive
Newsletter capture
Subscriber management
dev.to draft creation
LinkedIn OAuth
Bluesky setup
Promotion copy generation
LinkedIn/Bluesky posting actions
```

Implemented in this pass:

- Shared black/orange admin shell.
- Persistent links to Dashboard, Posts, Topics, Subscribers, Settings, and Blog.
- Dashboard replaced stale BRD/dummy queue with live workflow cards.
- Posts list now has status filters, clearer status badges, and row-level navigation.
- Posts list now separates Queue, Imported archive, and All posts.
- Long-running form actions now show loading states/spinners.
- Post workspace now groups Blog, dev.to, Promotion, and Edit sections.
- Copy-to-clipboard controls for generated promotion assets.
- LinkedIn and Bluesky publish controls with status, links, and errors.
- Settings page redesigned as provider status cards.
- Topic backlog page added with topic creation and status updates.
- Topic backlog page added next-topic generation from published titles and queue state.
- Topic backlog page added bulk selection and explicit draft-post creation.

Still useful to improve:

- Better empty/loading/error states.
- Mobile/tablet polish.
- Optional active nav state.
- More detailed topic-to-post conversion flow.

### Immediate Next Step: Draft/Topic Pipeline

The draft/topic pipeline now works end-to-end for one selected topic.

Current operator flow:

1. Use `/topics` to keep 40-50 strong selected ideas available.
2. Click `Prepare next selected`.
3. Review the generated post workspace.
4. Edit the canonical Markdown if needed.
5. Click `Approve and publish`.
6. Open the blog, dev.to, LinkedIn, and Bluesky links from the post workspace to confirm.

Build next:

- Add an Inngest-backed `Prepare selected queue` automation that prepares selected topics one at a time in the background.
- Add visible job/run status in the admin so bulk preparation does not look stuck.
- Add a stricter review state between `DRAFT_READY` and `PUBLISHED_BLOG`.
- Add richer visible success/failure feedback for multi-platform publishing.

### Later Improvements

- Update existing dev.to drafts.
- Publish live to dev.to from admin after review.
- Pull dev.to stats/status back into admin.
- Resend confirmation email action from admin for pending subscribers.
- Subscriber CSV export.
- Weekly digest generation/manual send flow.
- Optional Nano Banana/Gemini image provider.
- UTM parsing and conversion reporting.
- Auto-classify imported posts into richer topics/tags.
- Novelty scoring.
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

The project is now a working owned archive plus a private content operating system.

Done:

- Public blog deployed.
- Admin deployed.
- Neon DB wired.
- Neon Auth wired.
- All 50 existing Substack posts imported.
- Blog theme refreshed.
- Archive and article pages functional.
- Full sitemap importer available.
- Subscriber capture, email confirmation, and unsubscribe.
- dev.to draft creation.
- dev.to draft recreation.
- dev.to publish through one-click social syndication.
- AI cover image generation stored in Vercel Blob.
- Promotion copy generation.
- LinkedIn and Bluesky promotion posting.
- One-click dev.to/LinkedIn/Bluesky posting from the post workspace.
- Imported archive and future queue are separated.
- Backlog topic suggestions can be generated from published titles and current queue state.
- Selected topics can create linked draft posts in the post queue.
- One selected topic can be prepared into a near-ready post with canonical draft, image, dev.to draft, and social copy.
- Canonical blog publishing is now an explicit post-workspace action.
- Reviewed posts can be approved and published everywhere with one button.
- Admin forms show loading states for long-running actions.
- Inngest daily topic planning and draft-buffer functions are registered.
- Inngest schedules are weekday-only in America/New_York time.
- Inngest prepares a weekday morning approval candidate by 6:45 AM ET.
- Twilio WhatsApp summaries are wired but waiting on production WhatsApp/template approval.

Still to build:

- Background bulk preparation for selected topics through Inngest.
- Clear admin-visible job status/progress for bulk/background work.
- Review/approval workflow before canonical publishing.
- Better multi-platform publish result UI.
- LinkedIn impression analytics permissions/reporting.
- WhatsApp delivery confirmation once Twilio approval is green.
- Analytics.
