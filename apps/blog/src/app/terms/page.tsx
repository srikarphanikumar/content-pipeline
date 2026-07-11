import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms | Under The Hood",
  description: "Terms and conditions for Under The Hood.",
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#f8f3eb] px-6 py-12 text-stone-950">
      <article className="mx-auto max-w-3xl">
        <Link
          className="text-sm font-semibold text-orange-700 transition hover:text-orange-900"
          href="/"
        >
          Back to Under The Hood
        </Link>

        <p className="mt-10 text-sm font-semibold uppercase tracking-[0.18em] text-orange-700">
          Terms
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">
          Under The Hood Terms and Conditions
        </h1>
        <p className="mt-3 text-sm text-stone-600">Last updated: July 11, 2026</p>

        <div className="prose prose-stone mt-8 max-w-none prose-a:text-orange-700">
          <p>
            These terms apply to Under The Hood, including the website, newsletter, and
            optional WhatsApp notifications.
          </p>

          <h2>Content</h2>
          <p>
            Under The Hood publishes technical writing for educational and informational
            purposes. The content is not legal, financial, medical, or security advice.
            You are responsible for how you use or adapt any technical material.
          </p>

          <h2>Subscriptions and notifications</h2>
          <p>
            By subscribing or opting in, you agree to receive publication-related
            messages from Under The Hood. Email updates may include new posts and
            publication updates. WhatsApp updates may include publishing pipeline status,
            post statistics, topic planning, and operational summaries.
          </p>
          <p>
            WhatsApp message frequency may vary, but the expected cadence is up to two
            operational messages per day. Message and data rates may apply. Reply STOP to
            opt out of WhatsApp messages.
          </p>

          <h2>Acceptable use</h2>
          <p>
            Do not misuse the website, attempt to disrupt the service, or use the
            publication in a way that violates applicable law.
          </p>

          <h2>Third-party services</h2>
          <p>
            The publication may use third-party platforms for hosting, email, messaging,
            analytics, and content syndication. Those services may have their own terms
            and policies.
          </p>

          <h2>Changes</h2>
          <p>
            These terms may be updated as the publication and notification workflows
            evolve. The updated date on this page will reflect the latest version.
          </p>

          <h2>Contact</h2>
          <p>
            For questions about these terms, contact the publication owner through the
            website or reply to a message you received from Under The Hood.
          </p>
        </div>
      </article>
    </main>
  );
}
