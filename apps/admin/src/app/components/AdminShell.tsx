import Link from "next/link";
import type React from "react";
import { signOut } from "../auth/sign-out/actions";
import { Menu } from "./Menu";
import { NavLinks } from "./NavLinks";
import { SubmitButton } from "./SubmitButton";
import { ButtonLink, menuItemClass } from "./ui";

type AdminShellProps = {
  actions?: React.ReactNode;
  // Small line above the title, e.g. a back link on detail pages.
  breadcrumb?: React.ReactNode;
  children: React.ReactNode;
  description?: React.ReactNode;
  title: React.ReactNode;
};

export function AdminShell({ actions, breadcrumb, children, description, title }: AdminShellProps) {
  return (
    <main className="min-h-screen bg-canvas text-foreground">
      <header className="sticky top-0 z-20 border-b border-line bg-canvas/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4 sm:px-6">
          <Link className="shrink-0 text-sm font-semibold text-white" href="/">
            <span className="text-orange-400">UTH</span> Pipeline
          </Link>
          <NavLinks />
          <div className="ml-auto">
            <Menu
              label="More"
              triggerClassName="rounded-md px-3 py-1.5 text-sm font-medium text-zinc-400 transition hover:text-white"
            >
              <Link className={menuItemClass} href="/analytics">
                Analytics
              </Link>
              <Link className={menuItemClass} href="/settings">
                Integrations
              </Link>
              <Link className={menuItemClass} href="/import/substack">
                Import from Substack
              </Link>
              <a className={menuItemClass} href="https://blog.mspk.me" rel="noreferrer" target="_blank">
                Open blog ↗
              </a>
              <div className="my-1 border-t border-line" />
              <form action={signOut}>
                <SubmitButton className={menuItemClass} pendingLabel="Signing out...">
                  Sign out
                </SubmitButton>
              </form>
            </Menu>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 pt-8 pb-16 sm:px-6">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            {breadcrumb ? <div className="mb-2 text-sm text-zinc-400">{breadcrumb}</div> : null}
            <h1 className="text-2xl font-semibold tracking-tight text-white md:text-3xl">{title}</h1>
            {description ? (
              <p className="mt-1.5 max-w-2xl text-sm leading-6 text-zinc-400">{description}</p>
            ) : null}
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
        {children}
      </div>
    </main>
  );
}

export function PrimaryLink({ children, href }: { children: React.ReactNode; href: string }) {
  return (
    <ButtonLink href={href} variant="primary">
      {children}
    </ButtonLink>
  );
}

export function SecondaryLink({ children, href }: { children: React.ReactNode; href: string }) {
  return <ButtonLink href={href}>{children}</ButtonLink>;
}
