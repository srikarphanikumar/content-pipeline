import { Resend } from "resend";
import type { Post, Subscriber } from "@content-pipeline/db";

type NewsletterRecipient = Pick<Subscriber, "email" | "unsubscribeToken">;

type NewsletterEmail = {
  html: string;
  subject: string;
  text: string;
};

function blogBaseUrl() {
  return (process.env.BLOG_BASE_URL || "https://blog.mspk.me").replace(/\/$/, "");
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function postUrl(post: Pick<Post, "slug">) {
  return `${blogBaseUrl()}/posts/${post.slug}`;
}

function unsubscribeUrl(recipient: NewsletterRecipient) {
  return recipient.unsubscribeToken
    ? `${blogBaseUrl()}/unsubscribe?token=${encodeURIComponent(recipient.unsubscribeToken)}`
    : `${blogBaseUrl()}/#subscribe`;
}

function inlineMarkdown(value: string) {
  let html = escapeHtml(value);

  html = html.replace(
    /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
    '<a href="$2" style="color:#fb923c;text-decoration:underline;">$1</a>',
  );
  html = html.replace(/`([^`]+)`/g, '<code style="border-radius:4px;background:#1f1f1f;color:#fed7aa;padding:2px 5px;font-family:Menlo,Consolas,monospace;font-size:0.92em;">$1</code>');
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

  return html;
}

function renderMarkdown(markdown: string) {
  const lines = markdown.trim().split(/\r?\n/);
  const blocks: string[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];
  let code: string[] | null = null;

  function flushParagraph() {
    if (paragraph.length === 0) {
      return;
    }

    blocks.push(
      `<p style="margin:0 0 18px;color:#e7e5e4;font-size:16px;line-height:1.75;">${inlineMarkdown(paragraph.join(" "))}</p>`,
    );
    paragraph = [];
  }

  function flushList() {
    if (list.length === 0) {
      return;
    }

    blocks.push(
      `<ul style="margin:0 0 20px;padding-left:22px;color:#e7e5e4;font-size:16px;line-height:1.7;">${list
        .map((item) => `<li style="margin:0 0 8px;">${inlineMarkdown(item)}</li>`)
        .join("")}</ul>`,
    );
    list = [];
  }

  function flushCode() {
    if (!code) {
      return;
    }

    blocks.push(
      `<pre style="box-sizing:border-box;max-width:100%;overflow-x:auto;margin:0 0 22px;padding:16px;border-radius:8px;background:#050505;border:1px solid #2a2a2a;color:#f5f5f4;font-family:Menlo,Consolas,monospace;font-size:13px;line-height:1.6;white-space:pre;"><code>${escapeHtml(code.join("\n"))}</code></pre>`,
    );
    code = null;
  }

  for (const line of lines) {
    if (line.trim().startsWith("```")) {
      if (code) {
        flushCode();
      } else {
        flushParagraph();
        flushList();
        code = [];
      }
      continue;
    }

    if (code) {
      code.push(line);
      continue;
    }

    if (!line.trim()) {
      flushParagraph();
      flushList();
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);

    if (heading) {
      flushParagraph();
      flushList();
      const level = heading[1].length;
      const size = level === 1 ? 26 : level === 2 ? 22 : 18;
      blocks.push(
        `<h${Math.min(level + 1, 4)} style="margin:28px 0 12px;color:#fff7ed;font-size:${size}px;line-height:1.25;">${inlineMarkdown(heading[2])}</h${Math.min(level + 1, 4)}>`,
      );
      continue;
    }

    const listItem = line.match(/^[-*]\s+(.+)$/);

    if (listItem) {
      flushParagraph();
      list.push(listItem[1]);
      continue;
    }

    paragraph.push(line.trim());
  }

  flushParagraph();
  flushList();
  flushCode();

  return blocks.join("\n");
}

export function buildNewsletterEmail(
  post: Post,
  recipient: NewsletterRecipient,
): NewsletterEmail {
  const canonicalUrl = postUrl(post);
  const subject = `New Under The Hood post: ${post.title}`;
  const bodyHtml = renderMarkdown(post.bodyMarkdown);
  const preview = post.description || post.subtitle || "A new Under The Hood deep dive is live.";
  const unsubscribe = unsubscribeUrl(recipient);
  const html = `<!doctype html>
<html>
  <body style="margin:0;background:#080808;color:#f7f2ea;font-family:Arial,Helvetica,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;color:#080808;">${escapeHtml(preview)}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#080808;">
      <tr>
        <td align="center" style="padding:28px 14px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;background:#111111;border:1px solid #262626;border-radius:12px;overflow:hidden;">
            <tr>
              <td style="padding:28px 28px 18px;border-bottom:1px solid #262626;">
                <div style="color:#fb923c;font-size:12px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;">Under The Hood</div>
                <h1 style="margin:12px 0 12px;color:#fff7ed;font-size:30px;line-height:1.18;">${escapeHtml(post.title)}</h1>
                ${post.subtitle ? `<p style="margin:0;color:#d6d3d1;font-size:17px;line-height:1.6;">${escapeHtml(post.subtitle)}</p>` : ""}
                <p style="margin:18px 0 0;">
                  <a href="${canonicalUrl}" style="display:inline-block;border-radius:7px;background:#f97316;color:#111111;padding:11px 15px;font-size:14px;font-weight:700;text-decoration:none;">Read on the site</a>
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:28px;">
                ${bodyHtml}
                <div style="margin-top:28px;padding:18px;border-radius:9px;background:#1a120b;border:1px solid rgba(251,146,60,0.35);">
                  <p style="margin:0 0 12px;color:#fed7aa;font-size:15px;line-height:1.7;">Have a comment, correction, or suggestion for the next post?</p>
                  <p style="margin:0;color:#e7e5e4;font-size:15px;line-height:1.7;">Reply to this email or leave a comment wherever you found the post. I read the notes and use them to shape the backlog.</p>
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 28px;background:#0b0b0b;border-top:1px solid #262626;color:#a8a29e;font-size:12px;line-height:1.6;">
                You are receiving this because you subscribed to Under The Hood.
                <br />
                <a href="${unsubscribe}" style="color:#fb923c;text-decoration:underline;">Unsubscribe</a>
                · <a href="${canonicalUrl}" style="color:#fb923c;text-decoration:underline;">View canonical post</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
  const text = [
    post.title,
    "",
    post.subtitle || post.description || "",
    "",
    post.bodyMarkdown,
    "",
    `Read on the site: ${canonicalUrl}`,
    "",
    "Have a comment, correction, or suggestion for the next post? Reply to this email.",
    "",
    `Unsubscribe: ${unsubscribe}`,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    html,
    subject,
    text,
  };
}

export async function sendNewsletterEmail({
  html,
  recipient,
  subject,
  text,
}: NewsletterEmail & {
  recipient: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.NEWSLETTER_FROM_EMAIL;

  if (!apiKey || !from || apiKey === "placeholder") {
    throw new Error("RESEND_API_KEY and NEWSLETTER_FROM_EMAIL are required for newsletter sending.");
  }

  const resend = new Resend(apiKey);
  const result = await resend.emails.send({
    from,
    html,
    subject,
    text,
    to: recipient,
  });

  if (result.error) {
    throw new Error(result.error.message);
  }

  return result.data?.id || null;
}
