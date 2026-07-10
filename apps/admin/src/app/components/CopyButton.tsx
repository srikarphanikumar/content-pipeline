"use client";

import { useState } from "react";

type CopyButtonProps = {
  value: string;
};

export function CopyButton({ value }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      className="h-9 rounded-md border border-orange-400 px-3 text-xs font-semibold text-orange-300 transition hover:bg-orange-500 hover:text-black"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1400);
      }}
      type="button"
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}
