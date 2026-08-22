import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "violet" | "success" | "warning" | "danger" | "info";
const tones: Record<Tone, string> = {
  neutral: "border-border bg-surface-strong text-muted-strong",
  violet: "border-violet-400/25 bg-violet-500/10 text-violet-300",
  success: "border-emerald-400/25 bg-emerald-500/10 text-emerald-300",
  warning: "border-amber-400/25 bg-amber-500/10 text-amber-300",
  danger: "border-red-400/25 bg-red-500/10 text-red-300",
  info: "border-cyan-400/25 bg-cyan-500/10 text-cyan-300",
};

export function Badge({
  className,
  tone = "neutral",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wide",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
