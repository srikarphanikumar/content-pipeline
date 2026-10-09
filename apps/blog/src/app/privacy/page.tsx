import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | Under The Hood",
  description: "Privacy policy for Under The Hood.",
};

export default function PrivacyPage() {
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
          Privacy Policy
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">
          Under The Hood Privacy Policy
        </h1>
        <p className="mt-3 text-sm text-stone-600">Last updated: October 9, 2026</p>

        <div className="prose prose-stone mt-8 max-w-none prose-a:text-orange-700">
          <p>
            Under The Hood is a technical publication about frontend, AI, accessibility,
            and web internals. This policy explains what information we collect and how
            we use it.
          </p>

          <h2>Information we collect</h2>
          <p>
            If you subscribe to the newsletter, we collect your email address so we can
            send publication updates.
          </p>
          <p>
            We may also receive basic delivery, engagement, and error information from
            the services used to send email.
          </p>

          <h2>How we use your information</h2>
          <p>
            We use subscriber information to send the updates you requested, operate the
            publication, troubleshoot delivery issues, and understand whether messages
            are reaching subscribers.
          </p>
          <h2>Service providers</h2>
          <p>
            We use service providers such as hosting, database, email, analytics, AI, and
            messaging platforms to run the publication and deliver messages. These
            providers process information on our behalf.
          </p>

          <h2>Your choices</h2>
          <p>
            You can unsubscribe from email updates using the unsubscribe link in an
            email.
          </p>

          <h2>Contact</h2>
          <p>
            For privacy questions, contact the publication owner through the website or
            reply to a message you received from Under The Hood.
          </p>
        </div>
      </article>
    </main>
  );
}
