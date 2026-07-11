"use client";

import type React from "react";
import { useState } from "react";

type CopyButtonProps = {
  children?: React.ReactNode;
  className?: string;
  value: string;
};

export function CopyButton({
  children,
  className = "h-9 rounded-md border border-orange-400 px-3 text-xs font-semibold text-orange-300 transition hover:bg-orange-500 hover:text-black",
  value,
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      className={className}
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1400);
      }}
      type="button"
    >
      {copied ? "Copied" : children || "Copy"}
    </button>
  );
}
