"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "Inbox" },
  { href: "/topics", label: "Ideas" },
  { href: "/posts", label: "Posts" },
  { href: "/subscribers", label: "Readers" },
];

export function NavLinks() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1 overflow-x-auto text-sm">
      {navItems.map((item) => {
        const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

        return (
          <Link
            className={`rounded-md px-3 py-1.5 font-medium transition ${
              active ? "bg-white/[0.08] text-white" : "text-zinc-400 hover:text-white"
            }`}
            href={item.href}
            key={item.href}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
