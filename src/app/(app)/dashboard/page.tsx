import {
  ArrowRight,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Radar,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/empty-state";
import { PageHeading } from "@/components/page-heading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { titleCase } from "@/lib/utils";
import { requireOwnerContext } from "@/server/auth/owner-context";
import { getDashboardData } from "@/server/services/dashboard";

export default async function DashboardPage() {
  const context = await requireOwnerContext();
  const data = await getDashboardData(context.organizationId);
  const funnel = [
    "new",
    "ready_to_contact",
    "contacted",
    "replied",
    "meeting",
    "proposal",
    "won",
  ];

  return (
    <>
      <PageHeading
        eyebrow="Agency signal room"
        title="Your next best conversation"
        description="SiteScout turns scattered business signals into a focused prospecting queue."
        action={
          <Button asChild>
            <Link href="/discover">
              <Radar className="size-4" />
              Start scouting
            </Link>
          </Button>
        }
      />

      <section
        aria-label="Overview metrics"
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
      >
        {[
          {
            label: "Active leads",
            value: data.totalLeads,
            icon: Target,
            note: `${data.qualifiedLeads} high intent`,
          },
          {
            label: "Due now",
            value: data.dueFollowUps,
            icon: Clock3,
            note: "Follow-ups needing action",
          },
          {
            label: "Qualified",
            value: data.qualifiedLeads,
            icon: TrendingUp,
            note: "High and hot prospects",
          },
          {
            label: "Won this week",
            value: data.wonThisWeek,
            icon: CircleDollarSign,
            note: "Closed website projects",
          },
        ].map((metric) => (
          <article key={metric.label} className="panel p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted">
                {metric.label}
              </p>
              <metric.icon className="size-4 text-violet-500" />
            </div>
            <p className="tabular mt-4 font-display text-4xl font-bold tracking-tighter">
              {metric.value}
            </p>
            <p className="mt-1 text-xs text-muted">{metric.note}</p>
          </article>
        ))}
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-[1.4fr_.8fr]">
        <div className="panel overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div>
              <h2 className="font-display text-lg font-bold">Priority queue</h2>
              <p className="mt-1 text-xs text-muted">
                Highest-opportunity leads still waiting for momentum.
              </p>
            </div>
            <Badge tone="violet">
              <Sparkles className="size-3" />
              Ranked
            </Badge>
          </div>
          {data.priority.length === 0 ? (
            <div className="p-4">
              <EmptyState
                icon={Radar}
                title="No signals yet"
                description="Run your first discovery search, choose the strongest candidates, then analyze the ones worth your time."
                action={
                  <Button asChild size="sm">
                    <Link href="/discover">Find prospects</Link>
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="divide-y divide-border">
              {data.priority.map((lead, index) => (
                <Link
                  key={lead.id}
                  href={`/leads/${lead.id}`}
                  className="group grid min-h-20 grid-cols-[32px_1fr_auto] items-center gap-3 px-5 transition-colors hover:bg-surface-strong"
                >
                  <span className="tabular text-xs font-bold text-muted">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold group-hover:text-violet-500">
                      {lead.name}
                    </p>
                    <p className="mt-1 truncate text-xs text-muted">
                      {lead.category ?? "Local business"} ·{" "}
                      {titleCase(lead.stage)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="tabular font-display text-xl font-bold">
                        {lead.score ?? "—"}
                      </p>
                      <p className="text-[10px] uppercase tracking-wider text-muted">
                        signal
                      </p>
                    </div>
                    <ArrowRight className="size-4 text-muted transition-transform group-hover:translate-x-1 group-hover:text-violet-400" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="panel overflow-hidden">
          <div className="border-b border-border px-5 py-4">
            <h2 className="font-display text-lg font-bold">Recent movement</h2>
            <p className="mt-1 text-xs text-muted">
              The latest changes across your pipeline.
            </p>
          </div>
          {data.activity.length === 0 ? (
            <div className="p-6 text-center">
              <CheckCircle2 className="mx-auto size-7 text-muted" />
              <p className="mt-3 text-sm font-semibold">No activity recorded</p>
              <p className="mt-1 text-xs leading-5 text-muted">
                Your audit, outreach, note, and pipeline events will appear
                here.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {data.activity.map((event) => (
                <Link
                  key={event.id}
                  href={`/leads/${event.leadId}`}
                  className="flex min-h-16 items-center gap-3 px-5 hover:bg-surface-strong"
                >
                  <span className="size-2 rounded-full bg-violet-400 shadow-[0_0_10px_rgba(167,139,250,.6)]" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{event.name}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      {titleCase(event.type)} ·{" "}
                      {event.occurredAt.toLocaleDateString()}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      <section
        className="panel mt-5 overflow-hidden px-5 py-4"
        aria-label="Sales funnel"
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="font-display text-lg font-bold">Conversion line</h2>
            <p className="text-xs text-muted">
              A compact view from discovery to client.
            </p>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/pipeline">
              Open pipeline
              <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-4 xl:grid-cols-7">
          {funnel.map((stage) => (
            <div key={stage} className="bg-surface px-4 py-3">
              <p className="tabular font-display text-2xl font-bold">
                {data.stages[stage] ?? 0}
              </p>
              <p className="mt-1 truncate text-[10px] font-semibold uppercase tracking-wider text-muted">
                {titleCase(stage)}
              </p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
