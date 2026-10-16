"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({
  children,
  tone = "primary",
  className = "",
}: {
  children: string;
  tone?: "primary" | "danger" | "quiet";
  className?: string;
}) {
  const { pending } = useFormStatus();
  const tones = {
    primary: "bg-teal text-white hover:bg-teal-2",
    danger: "border border-danger/40 bg-danger/10 text-danger hover:bg-danger/20",
    quiet: "border border-line bg-card text-ink hover:border-teal/50",
  };
  return (
    <button
      type="submit"
      disabled={pending}
      className={`inline-flex h-10 items-center justify-center rounded-lg px-4 text-sm font-semibold disabled:opacity-60 ${tones[tone]} ${className}`}
    >
      {pending ? "Salvando..." : children}
    </button>
  );
}
