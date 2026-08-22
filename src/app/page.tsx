import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Globe2,
  MapPin,
  Radar,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  Zap,
} from "lucide-react";
import { auth } from "@clerk/nextjs/server";
import type { Metadata } from "next";
import Link from "next/link";

import { Logo } from "@/components/brand/logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Find website opportunities before your competitors do",
  description:
    "SiteScout helps web agencies discover businesses with weak websites, qualify the opportunity, and prepare evidence-led outreach.",
};

const workflow = [
  {
    number: "01",
    icon: Search,
    title: "Scout a market",
    description:
      "Search a location and category. SiteScout organizes local businesses into a reviewable candidate list without turning everything into a lead.",
  },
  {
    number: "02",
    icon: Globe2,
    title: "Inspect the evidence",
    description:
      "Run website analysis only on the prospects worth the cost. See technical checks, business context, and the reasons behind every score.",
  },
  {
    number: "03",
    icon: Target,
    title: "Start the right conversation",
    description:
      "Turn findings into tailored talking points, emails, DMs, follow-ups, and a focused pipeline you can actually work from.",
  },
];

function ProspectPreview() {
  return (
    <div className="relative mx-auto w-full max-w-xl" aria-hidden="true">
      <div className="absolute -left-12 top-10 size-52 rounded-full bg-violet-500/15 blur-3xl" />
      <div className="absolute -right-10 bottom-4 size-44 rounded-full bg-cyan-400/8 blur-3xl" />
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#111016] p-3 shadow-[0_36px_100px_-36px_rgba(0,0,0,.9)] sm:p-4">
        <div className="flex items-center justify-between border-b border-white/8 px-2 pb-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-strong">
            <span className="flex size-7 items-center justify-center rounded-lg bg-violet-500/12 text-violet-400">
              <Radar className="size-3.5" />
            </span>
            Opportunity queue
          </div>
          <span className="rounded-full border border-emerald-400/15 bg-emerald-400/8 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-emerald-300">
            Live evidence
          </span>
        </div>

        <div className="mt-3 rounded-2xl border border-violet-400/15 bg-gradient-to-br from-violet-500/10 via-white/3 to-transparent p-4 sm:p-5">
          <div className="flex flex-wrap gap-2">
            <Badge tone="success">Ready to contact</Badge>
            <Badge tone="violet">High opportunity</Badge>
          </div>
          <div className="mt-5 flex items-start justify-between gap-4">
            <div>
              <p className="font-display text-xl font-bold tracking-tight sm:text-2xl">
                Northline Dental Studio
              </p>
              <p className="mt-2 flex items-center gap-1.5 text-xs text-muted">
                <MapPin className="size-3.5" /> Lekki, Lagos
              </p>
            </div>
            <div className="text-right">
              <p className="text-[9px] font-bold uppercase tracking-widest text-muted">
                Signal
              </p>
              <p className="tabular font-display text-5xl font-bold tracking-tighter text-violet-400">
                84
              </p>
            </div>
          </div>
          <div className="mt-5 space-y-2">
            {[
              "Mobile experience creates booking friction",
              "Strong review volume signals existing demand",
              "Service pages lack clear conversion paths",
            ].map((item) => (
              <div
                key={item}
                className="flex items-center gap-2 rounded-xl bg-black/20 px-3 py-2.5 text-xs text-muted-strong"
              >
                <CheckCircle2 className="size-3.5 shrink-0 text-emerald-400" />
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/8 bg-white/3 p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted">
              Next move
            </p>
            <p className="mt-2 text-sm font-semibold">
              Lead with booking friction
            </p>
            <p className="mt-1 text-xs leading-5 text-muted">
              A useful opening angle grounded in visible evidence.
            </p>
          </div>
          <div className="rounded-2xl border border-white/8 bg-white/3 p-4">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted">
                Pipeline
              </p>
              <span className="text-[10px] text-violet-300">3 due today</span>
            </div>
            <div className="mt-4 flex items-end gap-1.5">
              {[42, 68, 54, 88, 72, 96].map((height, index) => (
                <span
                  key={height + index}
                  className="flex-1 rounded-full bg-violet-400/25"
                  style={{ height: height / 2 }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default async function LandingPage() {
  const { userId } = await auth();

  return (
    <main className="overflow-hidden bg-background text-foreground">
      <header className="fixed inset-x-0 top-0 z-40 border-b border-white/8 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-18 max-w-7xl items-center justify-between px-5 sm:px-8">
          <Link href="/" aria-label="SiteScout home">
            <Logo />
          </Link>
          <nav
            className="hidden items-center gap-8 text-sm font-medium text-muted sm:flex"
            aria-label="Marketing"
          >
            <Link href="#workflow" className="hover:text-foreground">
              How it works
            </Link>
            <Link href="#why-sitescout" className="hover:text-foreground">
              Why SiteScout
            </Link>
          </nav>
          <div className="flex items-center gap-1 sm:gap-2">
            {userId ? (
              <Button size="sm" asChild>
                <Link href="/dashboard">
                  Dashboard
                  <ArrowRight className="size-3.5" />
                </Link>
              </Button>
            ) : (
              <>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/sign-in">Sign in</Link>
                </Button>
                <Button size="sm" asChild>
                  <Link href="/sign-up">
                    Start scouting
                    <ArrowRight className="size-3.5" />
                  </Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <section className="relative px-5 pb-20 pt-36 sm:px-8 sm:pb-28 sm:pt-44">
        <div className="absolute inset-x-0 top-0 -z-0 h-160 bg-[radial-gradient(circle_at_72%_24%,rgba(124,58,237,.18),transparent_34%),radial-gradient(circle_at_18%_30%,rgba(139,92,246,.08),transparent_28%)]" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-16 lg:grid-cols-[1.02fr_.98fr]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-violet-400/20 bg-violet-500/8 px-3 py-1.5 text-xs font-semibold text-violet-200">
              <Zap className="size-3.5" />
              Prospecting intelligence for web agencies
            </div>
            <h1 className="mt-7 max-w-3xl font-display text-5xl font-bold leading-[0.94] tracking-tighter sm:text-6xl lg:text-7xl">
              Find the businesses already telling you they need a{" "}
              <span className="text-violet-400">better website.</span>
            </h1>
            <p className="mt-7 max-w-xl text-base leading-7 text-muted-strong sm:text-lg sm:leading-8">
              SiteScout finds local prospects, inspects their digital presence,
              explains the opportunity, and helps you start a more relevant
              sales conversation.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild className="group px-5">
                <Link href="/sign-up">
                  Find your next client
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </Button>
              <Button asChild variant="secondary" className="px-5">
                <Link href="#workflow">
                  See the workflow
                  <ChevronRight className="size-4" />
                </Link>
              </Button>
            </div>
            <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted">
              <span className="inline-flex items-center gap-1.5">
                <Check className="size-3.5 text-emerald-400" /> Human-led
                outreach
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Check className="size-3.5 text-emerald-400" /> Analysis runs
                only when requested
              </span>
            </div>
          </div>
          <ProspectPreview />
        </div>
      </section>

      <section className="border-y border-white/8 bg-white/2 px-5 sm:px-8">
        <div className="mx-auto grid max-w-7xl divide-y divide-white/8 sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
          {[
            {
              icon: MapPin,
              title: "Places discovery",
              detail: "Search a market with intent",
            },
            {
              icon: Globe2,
              title: "Website evidence",
              detail: "Inspect what prospects can see",
            },
            {
              icon: Target,
              title: "Opportunity scoring",
              detail: "Know who deserves attention",
            },
            {
              icon: Sparkles,
              title: "Sales intelligence",
              detail: "Prepare a relevant approach",
            },
          ].map((item) => (
            <div
              key={item.title}
              className="flex items-center gap-3 px-5 py-5 sm:px-6"
            >
              <item.icon className="size-4 shrink-0 text-violet-400" />
              <div>
                <p className="text-sm font-semibold">{item.title}</p>
                <p className="mt-0.5 text-xs text-muted">{item.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section
        id="workflow"
        className="scroll-mt-24 px-5 py-24 sm:px-8 sm:py-32"
      >
        <div className="mx-auto max-w-7xl">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-widest text-violet-300">
              A shorter path to a useful conversation
            </p>
            <h2 className="mt-4 font-display text-4xl font-bold tracking-tighter sm:text-5xl">
              Stop prospecting from a pile of tabs.
            </h2>
            <p className="mt-5 text-base leading-7 text-muted">
              SiteScout keeps discovery, evidence, qualification, and follow-up
              in one focused system built for selling website work.
            </p>
          </div>
          <div className="mt-14 grid gap-4 lg:grid-cols-3">
            {workflow.map((step) => (
              <article
                key={step.number}
                className="group rounded-2xl border border-border bg-surface p-6 transition-colors hover:border-violet-400/25 sm:p-7"
              >
                <div className="flex items-center justify-between">
                  <span className="font-display text-sm font-bold text-violet-400">
                    {step.number}
                  </span>
                  <span className="grid size-10 place-items-center rounded-xl bg-white/4 text-muted-strong transition-colors group-hover:bg-violet-500/10 group-hover:text-violet-300">
                    <step.icon className="size-4" />
                  </span>
                </div>
                <h3 className="mt-12 font-display text-2xl font-bold tracking-tight">
                  {step.title}
                </h3>
                <p className="mt-3 text-sm leading-6 text-muted">
                  {step.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section
        id="why-sitescout"
        className="scroll-mt-24 px-5 pb-24 sm:px-8 sm:pb-32"
      >
        <div className="mx-auto grid max-w-7xl overflow-hidden rounded-3xl border border-border bg-surface lg:grid-cols-[.9fr_1.1fr]">
          <div className="relative min-h-96 overflow-hidden border-b border-border p-7 sm:p-10 lg:border-b-0 lg:border-r">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(139,92,246,.2),transparent_35%)]" />
            <div className="relative">
              <p className="text-xs font-bold uppercase tracking-widest text-violet-300">
                Evidence before AI
              </p>
              <h2 className="mt-4 max-w-md font-display text-4xl font-bold tracking-tighter sm:text-5xl">
                A score you can explain on the call.
              </h2>
              <p className="mt-5 max-w-md text-sm leading-7 text-muted-strong">
                SiteScout gathers visible facts first, then uses AI to help
                reason about the sales opportunity. You see the evidence and
                keep the final judgment.
              </p>
            </div>
            <div className="relative mt-12 flex max-w-sm items-center justify-between rounded-2xl border border-white/10 bg-black/25 p-5">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted">
                  Opportunity
                </p>
                <p className="tabular mt-1 font-display text-5xl font-bold tracking-tighter">
                  78<span className="text-2xl text-muted">/100</span>
                </p>
              </div>
              <div className="space-y-2 text-right text-xs text-muted-strong">
                <p>
                  Demand signal{" "}
                  <span className="ml-2 text-emerald-300">Strong</span>
                </p>
                <p>
                  Website gap{" "}
                  <span className="ml-2 text-amber-300">Visible</span>
                </p>
                <p>
                  Outreach angle{" "}
                  <span className="ml-2 text-violet-300">Ready</span>
                </p>
              </div>
            </div>
          </div>

          <div className="divide-y divide-border">
            {[
              {
                icon: ShieldCheck,
                title: "You stay in control",
                body: "SiteScout prepares the work. It does not send autonomous emails, DMs, or calls on your behalf.",
              },
              {
                icon: CircleDollarSign,
                title: "Cost-aware by design",
                body: "Expensive audits and AI reasoning run only for the candidates you explicitly select.",
              },
              {
                icon: Radar,
                title: "Built for website sales",
                body: "Every view answers who to contact next, why the opportunity exists, and what to say.",
              },
              {
                icon: Target,
                title: "A focused pipeline",
                body: "Track outreach, notes, follow-ups, and progress without carrying the weight of a generic CRM.",
              },
            ].map((feature) => (
              <article key={feature.title} className="flex gap-5 p-7 sm:p-8">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-violet-500/10 text-violet-400">
                  <feature.icon className="size-5" />
                </span>
                <div>
                  <h3 className="font-display text-xl font-bold tracking-tight">
                    {feature.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-muted">
                    {feature.body}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 pb-20 sm:px-8 sm:pb-24">
        <div className="relative mx-auto max-w-7xl overflow-hidden rounded-3xl border border-violet-400/20 bg-[#15111e] px-6 py-14 sm:px-12 sm:py-16">
          <div className="absolute -right-16 -top-24 size-80 rounded-full border border-violet-400/10" />
          <div className="absolute -right-6 -top-14 size-56 rounded-full border border-violet-400/15" />
          <div className="relative max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-widest text-violet-300">
              Your next client is already leaving clues
            </p>
            <h2 className="mt-4 font-display text-4xl font-bold tracking-tighter sm:text-5xl">
              Turn those clues into a better first conversation.
            </h2>
            <p className="mt-5 max-w-xl text-sm leading-7 text-muted-strong">
              Create your private agency workspace and start with the market you
              already know.
            </p>
            <Button asChild className="mt-7 px-5">
              <Link href="/sign-up">
                Start scouting
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/8 px-5 py-8 sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <Logo />
          <p className="text-xs text-muted">
            Prospecting intelligence for independent web agencies.
          </p>
          <div className="flex items-center gap-5 text-xs font-semibold text-muted">
            <Link href="/sign-in" className="hover:text-foreground">
              Sign in
            </Link>
            <Link href="/sign-up" className="hover:text-foreground">
              Create workspace
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
