"use client";

import { useFormStatus } from "react-dom";
import { buttonClass, type ButtonSize, type ButtonVariant } from "./ui";

type SubmitButtonProps = {
  children: React.ReactNode;
  className?: string;
  // Asks before submitting; use for anything that deletes or can't be undone.
  confirm?: string;
  pendingLabel?: string;
  size?: ButtonSize;
  variant?: ButtonVariant;
};

export function SubmitButton({
  children,
  className,
  confirm,
  pendingLabel = "Working...",
  size,
  variant = "primary",
}: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      className={className || buttonClass(variant, size)}
      disabled={pending}
      onClick={(event) => {
        if (confirm && !window.confirm(confirm)) {
          event.preventDefault();
        }
      }}
      type="submit"
    >
      <span className="inline-flex items-center gap-2">
        {pending ? (
          <span className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : null}
        {pending ? pendingLabel : children}
      </span>
    </button>
  );
}
