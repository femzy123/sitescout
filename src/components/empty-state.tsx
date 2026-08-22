import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-dashed border-border-strong bg-surface/50 px-6 py-14 text-center">
      <div className="absolute left-1/2 top-0 h-32 w-64 -translate-x-1/2 rounded-full bg-violet-500/8 blur-3xl" />
      <div className="relative mx-auto grid size-12 place-items-center rounded-2xl border border-violet-400/20 bg-violet-500/10 text-violet-500">
        <Icon className="size-5" />
      </div>
      <h2 className="relative mt-4 font-display text-xl font-bold">{title}</h2>
      <p className="relative mx-auto mt-2 max-w-md text-sm leading-6 text-muted">
        {description}
      </p>
      {action && <div className="relative mt-5">{action}</div>}
    </div>
  );
}
