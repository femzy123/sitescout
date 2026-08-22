"use client";

import { UserButton } from "@clerk/nextjs";
import {
  Bell,
  Compass,
  LayoutDashboard,
  ListTodo,
  Radar,
  Rows3,
  Search,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navigation = [
  { href: "/dashboard", label: "Command", icon: LayoutDashboard },
  { href: "/discover", label: "Discover", icon: Radar },
  { href: "/leads", label: "Leads", icon: Rows3 },
  { href: "/pipeline", label: "Pipeline", icon: Compass },
  { href: "/follow-ups", label: "Follow-ups", icon: ListTodo },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({
  children,
  organizationName,
}: {
  children: ReactNode;
  organizationName: string;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <a
        href="#main-content"
        className="sr-only z-100 rounded-lg bg-violet-500 px-4 py-2 text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to content
      </a>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-62 border-r border-border bg-sidebar/95 px-4 py-5 backdrop-blur-xl lg:flex lg:flex-col">
        <div className="px-2">
          <Logo />
        </div>
        <div className="mt-8 px-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted">
            Agency workspace
          </p>
          <p className="mt-1 truncate text-sm font-semibold">
            {organizationName}
          </p>
        </div>
        <nav aria-label="Primary" className="mt-8 space-y-1">
          {navigation.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium text-muted transition-colors hover:bg-surface hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400",
                  active && "bg-violet-500/10 text-violet-300",
                )}
                aria-current={active ? "page" : undefined}
              >
                <item.icon className="size-4.5" strokeWidth={1.8} />
                <span>{item.label}</span>
                {active && (
                  <span className="ml-auto size-1.5 rounded-full bg-violet-400 shadow-[0_0_12px_rgba(167,139,250,.9)]" />
                )}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto rounded-2xl border border-border bg-surface p-4">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60 motion-reduce:animate-none" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
            </span>
            System ready
          </div>
          <p className="text-xs leading-5 text-muted">
            No worker. Audits run only when you ask.
          </p>
        </div>
      </aside>

      <div className="lg:pl-62">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/88 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
          <div className="lg:hidden">
            <Logo />
          </div>
          <div className="hidden items-center gap-2 text-sm text-muted lg:flex">
            <Search className="size-4" />
            <span>Find the next conversation</span>
            <kbd className="ml-2 rounded-md border border-border bg-surface px-2 py-0.5 text-[10px] font-semibold">
              ⌘ K
            </kbd>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" aria-label="Notifications">
              <Bell className="size-4" />
            </Button>
            <div className="ml-2 grid size-11 place-items-center rounded-xl border border-border bg-surface">
              <UserButton />
            </div>
          </div>
        </header>
        <main
          id="main-content"
          className="mx-auto w-full max-w-400 px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:pb-10"
        >
          {children}
        </main>
      </div>

      <nav
        aria-label="Mobile primary"
        className="fixed inset-x-3 bottom-3 z-50 grid grid-cols-5 rounded-2xl border border-border bg-sidebar/95 p-1.5 shadow-2xl backdrop-blur-xl lg:hidden"
      >
        {navigation.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-semibold text-muted",
                active && "bg-violet-500/10 text-violet-300",
              )}
              aria-current={active ? "page" : undefined}
            >
              <item.icon className="size-4.5" strokeWidth={1.8} />
              <span>{item.label === "Command" ? "Home" : item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
