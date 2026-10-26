import Link from "next/link";
import type React from "react";

// Orange is reserved for the one primary action on a screen. Status has its own colors.
const buttonVariants = {
  primary: "bg-orange-500 text-black hover:bg-orange-400",
  secondary: "border border-line-strong text-zinc-100 hover:border-zinc-400 hover:bg-white/[0.04]",
  ghost: "text-zinc-300 hover:bg-white/[0.06] hover:text-white",
  danger: "border border-red-400/40 text-red-300 hover:bg-red-500 hover:text-black",
  success: "bg-emerald-400 text-black hover:bg-emerald-300",
} as const;

const buttonSizes = {
  sm: "h-8 px-3 text-xs",
  md: "h-9 px-3.5 text-sm",
} as const;

export type ButtonVariant = keyof typeof buttonVariants;
export type ButtonSize = keyof typeof buttonSizes;

export function buttonClass(variant: ButtonVariant = "secondary", size: ButtonSize = "md") {
  return [
    "inline-flex shrink-0 items-center justify-center gap-2 rounded-md font-semibold whitespace-nowrap transition disabled:cursor-wait disabled:opacity-60",
    buttonVariants[variant],
    buttonSizes[size],
  ].join(" ");
}

// Menu rows: links and submit buttons share this look.
export const menuItemClass =
  "flex w-full items-center rounded-md px-3 py-2 text-left text-sm text-zinc-200 transition hover:bg-white/[0.06] disabled:cursor-wait disabled:opacity-60";
export const menuDangerItemClass =
  "flex w-full items-center rounded-md px-3 py-2 text-left text-sm text-red-300 transition hover:bg-red-500/15 disabled:cursor-wait disabled:opacity-60";

export function ButtonLink({
  children,
  external,
  href,
  size,
  variant,
}: {
  children: React.ReactNode;
  external?: boolean;
  href: string;
  size?: ButtonSize;
  variant?: ButtonVariant;
}) {
  if (external) {
    return (
      <a className={buttonClass(variant, size)} href={href} rel="noreferrer" target="_blank">
        {children}
      </a>
    );
  }

  return (
    <Link className={buttonClass(variant, size)} href={href}>
      {children}
    </Link>
  );
}

export function Card({
  actions,
  children,
  className = "",
  description,
  title,
}: {
  actions?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  description?: React.ReactNode;
  title?: React.ReactNode;
}) {
  return (
    <section className={`rounded-xl border border-line bg-surface ${className}`}>
      {title || actions ? (
        <header className="flex flex-wrap items-start justify-between gap-3 px-5 pt-4">
          <div className="min-w-0">
            {title ? <h2 className="text-base font-semibold text-white">{title}</h2> : null}
            {description ? <p className="mt-1 text-sm text-zinc-400">{description}</p> : null}
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </header>
      ) : null}
      {children ? <div className="px-5 pt-4 pb-5">{children}</div> : <div className="pb-4" />}
    </section>
  );
}

const pillTones = {
  live: "bg-emerald-500/12 text-emerald-300 ring-emerald-400/25",
  pending: "bg-amber-500/12 text-amber-300 ring-amber-400/25",
  failed: "bg-red-500/12 text-red-300 ring-red-400/30",
  idle: "bg-white/[0.06] text-zinc-400 ring-white/10",
  info: "bg-sky-500/12 text-sky-300 ring-sky-400/25",
} as const;

export type PillTone = keyof typeof pillTones;

export function StatusPill({ children, tone = "idle" }: { children: React.ReactNode; tone?: PillTone }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset ${pillTones[tone]}`}
    >
      {children}
    </span>
  );
}

export function StatusDot({ tone = "idle" }: { tone?: PillTone }) {
  const color = {
    live: "bg-emerald-400",
    pending: "bg-amber-400",
    failed: "bg-red-400",
    idle: "bg-zinc-600",
    info: "bg-sky-400",
  }[tone];

  return <span className={`inline-block size-2 shrink-0 rounded-full ${color}`} />;
}

export type TabItem = {
  active: boolean;
  count?: number;
  href: string;
  label: string;
};

export function Tabs({ items }: { items: TabItem[] }) {
  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-line">
      {items.map((item) => (
        <Link
          className={`-mb-px inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition ${
            item.active
              ? "border-orange-500 text-white"
              : "border-transparent text-zinc-400 hover:text-zinc-100"
          }`}
          href={item.href}
          key={item.href}
        >
          {item.label}
          {item.count !== undefined ? (
            <span className="rounded-full bg-white/[0.08] px-1.5 text-xs text-zinc-300">{item.count}</span>
          ) : null}
        </Link>
      ))}
    </nav>
  );
}

export function EmptyState({ children, title }: { children?: React.ReactNode; title: string }) {
  return (
    <div className="rounded-xl border border-dashed border-line-strong px-6 py-10 text-center">
      <p className="font-semibold text-zinc-200">{title}</p>
      {children ? <div className="mt-2 text-sm text-zinc-400">{children}</div> : null}
    </div>
  );
}

const relativeUnits: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ["year", 365 * 24 * 60 * 60],
  ["month", 30 * 24 * 60 * 60],
  ["week", 7 * 24 * 60 * 60],
  ["day", 24 * 60 * 60],
  ["hour", 60 * 60],
  ["minute", 60],
];

export function relativeTime(date: Date | null | undefined) {
  if (!date) {
    return "—";
  }

  const seconds = Math.round((date.getTime() - Date.now()) / 1000);
  const format = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  for (const [unit, size] of relativeUnits) {
    if (Math.abs(seconds) >= size) {
      return format.format(Math.round(seconds / size), unit);
    }
  }

  return "just now";
}
