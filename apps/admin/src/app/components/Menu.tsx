"use client";

import type React from "react";
import { useEffect, useRef } from "react";

// A small dropdown on top of <details>, so the items can stay server-action forms.
export function Menu({
  align = "right",
  children,
  label,
  triggerClassName,
}: {
  align?: "left" | "right";
  children: React.ReactNode;
  label: React.ReactNode;
  triggerClassName: string;
}) {
  const ref = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    function close(event: MouseEvent | KeyboardEvent) {
      const details = ref.current;

      if (!details?.open) {
        return;
      }

      if (event instanceof KeyboardEvent ? event.key === "Escape" : !details.contains(event.target as Node)) {
        details.open = false;
      }
    }

    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);

    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, []);

  return (
    <details className="relative" ref={ref}>
      <summary className={`cursor-pointer list-none ${triggerClassName}`}>{label}</summary>
      <div
        className={`absolute z-30 mt-1.5 grid min-w-52 gap-0.5 rounded-lg border border-line-strong bg-raised p-1 shadow-2xl shadow-black/60 ${
          align === "right" ? "right-0" : "left-0"
        }`}
      >
        {children}
      </div>
    </details>
  );
}

