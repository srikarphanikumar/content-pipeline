# Under The Hood Content Pipeline MVP BRD

## Product Name

Under The Hood Content Pipeline

## Goal

Build a two-part system that lets the author own technical content on `blog.mspk.me`, grow an email subscriber base, and reduce manual work across ideation, drafting, publishing, syndication, and promotion.

The system combines:

- A public blog/newsletter app for readers.
- A private admin/content pipeline app for creating, importing, publishing, and tracking posts.

## Apps

### App 1: Public Blog / Newsletter

- Domain: `blog.mspk.me`
- Purpose: canonical home for Under The Hood posts, archive, SEO, RSS, and subscriber capture.

### App 2: Private Admin / Content Pipeline

- Suggested domain: `admin.blog.mspk.me` or `pipeline.mspk.me`
- Purpose: private publishing dashboard for topic planning, post creation, imports, syndication, and promotion tracking.

## Primary MVP Objectives

1. Launch `blog.mspk.me` as the canonical home for Under The Hood.
2. Import all existing 50 Substack posts into the new blog.
3. Capture new email subscribers.
4. Publish new posts to the blog from the admin app.
5. Maintain a 20-post ready buffer.
6. Publish or syndicate posts to dev.to.
7. Generate LinkedIn and social promotion copy.
8. Track publish status across platforms.

## Target Users

### Primary User

- The author of Under The Hood.

### Reader Audience

- Frontend engineers.
- AI engineers.
- Full-stack developers.
- Technical founders and builders.
- dev.to readers.
- LinkedIn readers.

## Core Positioning

Under The Hood is a technical publication covering frontend and AI topics that are usually skipped, simplified, or poorly explained elsewhere.

## App 1: Public Blog MVP

### Core Pages

- Home page.
- All posts page.
- Post detail page.
- Tags/topics page.
- Subscribe page.
- About page.
- RSS feed.

### Core Features

- Render imported and new posts.
- SEO metadata per post.
- Clean code block rendering.
- Tags/categories.
- Related posts.
- Newsletter subscribe form.
- Email confirmation flow.
- Unsubscribe link.
- Basic subscriber storage.
- Source tracking for subscribers.

### Post Fields

```txt
title
slug
subtitle
description
body
cover_image
tags
published_at
updated_at
canonical_url
source_platform
source_url
status
```

### Subscriber Fields

```txt
email
name optional
source
referrer_url
subscribed_at
confirmed_at
status
```

## App 2: Admin Pipeline MVP

### Core Pages

- Dashboard.
- Topic backlog.
- Post editor.
- Publishing queue.
- Imported posts.
- Platform settings.
- Subscribers.
- Light analytics.

### Core Features

- Login/auth.
- Create and edit posts.
- Import Substack posts.
- Generate and store topic ideas.
- Track 20-post buffer.
- Publish to `blog.mspk.me`.
- Publish to dev.to via API.
- Generate LinkedIn post copy.
- Generate first comment CTA.
- Generate Bluesky/Mastodon copy.
- Mark platform statuses manually.
- Store platform URLs.
- Basic scheduling fields.

### Post Statuses

```txt
idea
selected
drafting
draft_ready
ready_to_publish
published_blog
published_devto
promoted_linkedin
promoted_social
complete
```

### Platform Status Fields

```txt
platform
status
scheduled_at
published_at
external_url
error_message
```

## Content Pipeline MVP Flow

```txt
Generate/select topic
↓
Create draft
↓
Edit/review article
↓
Publish to blog.mspk.me
↓
Publish to dev.to
↓
Generate LinkedIn post
↓
Generate first comment with blog subscription CTA
↓
Generate Bluesky/Mastodon post
↓
Track URLs and status
```

## Substack Migration Flow

```txt
Enter Substack feed/export URL
↓
Import 50 posts
↓
Normalize Markdown/content
↓
Import cover images where available
↓
Generate slugs/tags
↓
Review imported posts
↓
Publish to blog.mspk.me
```

## Email MVP

Email should stay simple for MVP.

### Must Have

- Subscribe form.
- Double opt-in or confirmation email.
- Unsubscribe.
- Subscriber list.
- Manual or weekly digest support.

### Not MVP

- Paid subscriptions.
- Audience segmentation.
- Complex automations.
- Drip campaigns.

### Recommended Provider

```txt
Resend for email sending
Postgres for subscriber database
```

EmailJS is not recommended as the newsletter backbone. It is better suited to contact forms than newsletter delivery and subscriber lifecycle management.

## Distribution MVP

### Must Have

- dev.to API publishing.
- LinkedIn copy generation.
- Bluesky copy generation.
- Mastodon copy generation.

### Manual In MVP

- LinkedIn actual posting.
- Medium publishing.
- Hashnode publishing.
- Mastodon/Bluesky posting.

The first MVP should prove the owned blog, dev.to publishing, and CTA loop before expanding automated syndication.

## CTA Strategy

Every external post should point back to `blog.mspk.me`.

### End Of dev.to Article

```txt
I write deeper frontend + AI internals breakdowns in Under The Hood.

Subscribe here: https://blog.mspk.me
```

### LinkedIn First Comment

```txt
I’m building Under The Hood, a technical blog/newsletter for frontend and AI topics that usually get skipped.

Subscribe here: https://blog.mspk.me
```

## 20-Post Buffer Rule

The admin dashboard should show the health of the content inventory.

```txt
Ready posts: 20 target
Drafts ready: X
Scheduled/published this week: Y
Needs generation: Z
```

If ready posts drop below 20, the dashboard should flag it.

## Analytics MVP

Track only essentials first:

- Blog post views.
- Subscriber count.
- Subscriber source.
- dev.to URL/status.
- LinkedIn URL/manual status.
- CTA source via UTM links where possible.

### UTM Examples

```txt
https://blog.mspk.me?utm_source=devto&utm_medium=article&utm_campaign=post-slug
https://blog.mspk.me?utm_source=linkedin&utm_medium=social&utm_campaign=post-slug
```

## Out Of Scope For MVP

- Paid subscriptions.
- Full LinkedIn API posting.
- Full Medium/Hashnode automation.
- Substack browser automation.
- WhatsApp bot.
- AI image generation.
- Advanced analytics.
- Team/multi-author support.
- Comment system.

## Recommended Tech Stack

```txt
Next.js monorepo
Postgres
Prisma or Drizzle
Auth.js or simple credential auth
Resend
Markdown/MDX rendering
dev.to API adapter
Tailwind/shadcn-style UI if desired
```

## MVP Success Metrics

The MVP is successful if:

1. All 50 Substack posts are live on `blog.mspk.me`.
2. New post can be created once and published to the blog.
3. New post can be published to dev.to through API.
4. Subscriber form works end-to-end.
5. Every published post has a generated CTA.
6. Admin dashboard shows current content buffer.
7. The weekly publishing workflow requires much less copy-paste.

## Build Order

1. Monorepo and database schema.
2. Public blog shell.
3. Post model and post rendering.
4. Subscriber form and email confirmation.
5. Substack importer.
6. Admin auth and dashboard.
7. Admin post editor.
8. Publish to blog.
9. dev.to publishing.
10. Social copy generation.
11. Buffer tracking.

