import { Resend } from "resend";

type ConfirmationEmail = {
  email: string;
  confirmationUrl: string;
  unsubscribeUrl: string;
};

function baseUrl() {
  if (process.env.BLOG_BASE_URL) {
    return process.env.BLOG_BASE_URL.replace(/\/$/, "");
  }

  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  return "https://blog.mspk.me";
}

export function blogUrl(path: string) {
  return `${baseUrl()}${path}`;
}

export async function sendConfirmationEmail({
  email,
  confirmationUrl,
  unsubscribeUrl,
}: ConfirmationEmail) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.NEWSLETTER_FROM_EMAIL;

  if (!apiKey || !from || apiKey === "placeholder") {
    return false;
  }

  const resend = new Resend(apiKey);

  try {
    await resend.emails.send({
      from,
      to: email,
      subject: "Confirm your Under The Hood subscription",
      text: [
        "Thanks for subscribing to Under The Hood.",
        "",
        `Confirm your subscription: ${confirmationUrl}`,
        "",
        `If this was not you, you can unsubscribe here: ${unsubscribeUrl}`,
      ].join("\n"),
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #18181b;">
          <h1 style="font-size: 22px;">Confirm your Under The Hood subscription</h1>
          <p>Thanks for subscribing. Confirm your email to receive future deep dives.</p>
          <p>
            <a href="${confirmationUrl}" style="display: inline-block; background: #f97316; color: #111; padding: 10px 14px; border-radius: 6px; font-weight: 700; text-decoration: none;">
              Confirm subscription
            </a>
          </p>
          <p style="font-size: 13px; color: #71717a;">
            If this was not you, you can <a href="${unsubscribeUrl}">unsubscribe here</a>.
          </p>
        </div>
      `,
    });

    return true;
  } catch (error) {
    console.error("Could not send newsletter confirmation email.", error);
    return false;
  }
}
