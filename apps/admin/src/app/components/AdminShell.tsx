import Link from "next/link";
import type React from "react";
import { signOut } from "../auth/sign-out/actions";
import { SubmitButton } from "./SubmitButton";

const navItems = [
  { href: "/", label: "Pipeline" },
  { href: "/topics", label: "Ideas" },
  { href: "/posts", label: "Posts" },
  { href: "/import/substack", label: "Import" },
  { href: "/subscribers", label: "Readers" },
  { href: "/settings", label: "Integrations" },
];

const workflowItems = [
  { href: "/topics", label: "1. Ideas" },
  { href: "/posts?status=DRAFT_READY", label: "2. Drafts" },
  { href: "/posts?status=READY_TO_PUBLISH", label: "3. Ready" },
  { href: "/posts?view=archive", label: "4. Syndicate" },
  { href: "/posts?view=archive", label: "5. Promote" },
  { href: "/subscribers", label: "6. Readers" },
];

type AdminShellProps = {
  actions?: React.ReactNode;
  children: React.ReactNode;
  description?: string;
  eyebrow?: string;
  title: string;
};

export function AdminShell({
  actions,
  children,
  description,
  eyebrow = "Under The Hood",
  title,
}: AdminShellProps) {
  return (
    <main className="min-h-screen bg-[#080808] text-[#f7f2ea]">
      <header className="border-b border-white/10 bg-[#0d0d0d]">
        <div className="mx-auto flex max-w-[96rem] flex-col gap-3 px-6 py-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Link className="text-sm font-semibold text-orange-400" href="/">
              Under The Hood
            </Link>
            <p className="text-lg font-semibold tracking-tight text-white">
              Content Pipeline
            </p>
          </div>
          <nav className="flex flex-wrap items-center gap-2 text-sm">
            {navItems.map((item) => (
              <Link
                className="rounded-md border border-white/10 px-3 py-1.5 font-semibold text-zinc-300 transition hover:border-orange-400 hover:text-orange-300"
                href={item.href}
                key={item.href}
              >
                {item.label}
              </Link>
            ))}
            <a
              className="rounded-md border border-white/10 px-3 py-1.5 font-semibold text-zinc-300 transition hover:border-orange-400 hover:text-orange-300"
              href="https://blog.mspk.me"
              rel="noreferrer"
              target="_blank"
            >
              Blog
            </a>
            <form action={signOut}>
              <SubmitButton
                className="rounded-md bg-orange-500 px-3 py-1.5 font-semibold text-black transition hover:bg-orange-400"
                pendingLabel="Signing out..."
              >
                Sign out
              </SubmitButton>
            </form>
          </nav>
        </div>
        <div className="mx-auto flex max-w-[96rem] gap-2 overflow-x-auto px-6 pb-3 text-xs font-semibold">
          {workflowItems.map((item) => (
            <Link
              className="shrink-0 rounded-md border border-white/10 bg-black/25 px-2.5 py-1.5 text-zinc-300 transition hover:border-orange-400 hover:text-orange-300"
              href={item.href}
              key={item.label}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </header>

      <section className="border-b border-white/10 bg-[#111111]">
        <div className="mx-auto flex max-w-[96rem] flex-col gap-3 px-6 py-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-orange-400">
              {eyebrow}
            </p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-white md:text-4xl">
              {title}
            </h1>
            {description ? (
              <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-300">
                {description}
              </p>
            ) : null}
          </div>
          {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
        </div>
      </section>

      <section className="mx-auto max-w-[96rem] px-6 py-4">{children}</section>
    </main>
  );
}

export function PrimaryLink({
  children,
  href,
}: {
  children: React.ReactNode;
  href: string;
}) {
  return (
    <Link
      className="inline-flex h-10 items-center rounded-md bg-orange-500 px-4 text-sm font-semibold text-black transition hover:bg-orange-400"
      href={href}
    >
      {children}
    </Link>
  );
}

export function SecondaryLink({
  children,
  href,
}: {
  children: React.ReactNode;
  href: string;
}) {
  return (
    <Link
      className="inline-flex h-10 items-center rounded-md border border-white/15 px-4 text-sm font-semibold text-white transition hover:border-orange-400 hover:text-orange-300"
      href={href}
    >
      {children}
    </Link>
  );
}
