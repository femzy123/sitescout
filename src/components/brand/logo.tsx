import { cn } from "@/lib/utils";

export function ScoutMark({ className }: { className?: string }) {
  return (
    <svg
      className={cn("size-9", className)}
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M11 4.75H7.75a3 3 0 0 0-3 3V11M29 4.75h3.25a3 3 0 0 1 3 3V11M11 35.25H7.75a3 3 0 0 1-3-3V29M29 35.25h3.25a3 3 0 0 0 3-3V29"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path
        d="M28.8 12.1c-2.2-2.25-5.3-3.42-8.62-3.42-5.07 0-8.82 2.42-8.82 6.05 0 3.98 3.37 5.02 8.64 5.98 4.2.76 6.05 1.56 6.05 3.72 0 2.08-2.25 3.42-5.8 3.42-3.65 0-6.95-1.33-9.25-3.8"
        stroke="currentColor"
        strokeWidth="3.1"
        strokeLinecap="round"
      />
      <path
        d="M20 4v3M20 33v3M4 20h3M33 20h3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity=".7"
      />
      <circle cx="20" cy="20" r="2.2" fill="currentColor" />
    </svg>
  );
}

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3 text-foreground">
      <span className="grid size-10 place-items-center rounded-xl border border-violet-400/25 bg-violet-500/10 text-violet-400">
        <ScoutMark className="size-8" />
      </span>
      {!compact && (
        <span className="font-display text-xl font-bold tracking-tighter">
          SiteScout
        </span>
      )}
    </div>
  );
}
