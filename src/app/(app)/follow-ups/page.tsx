import { CalendarCheck, CheckCircle2, Clock3 } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/empty-state";
import { PageHeading } from "@/components/page-heading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireOwnerContext } from "@/server/auth/owner-context";
import { getPendingFollowUps } from "@/server/services/follow-ups";
import { completeFollowUp } from "../leads/actions";

export default async function FollowUpsPage() {
  const context = await requireOwnerContext();
  const items = await getPendingFollowUps(context.organizationId);
  const now = new Date();
  return (
    <>
      <PageHeading
        eyebrow="Due work"
        title="Keep promises visible"
        description="Every follow-up stays attached to its prospect, evidence, and place in the sales conversation."
      />
      {items.length === 0 ? (
        <EmptyState
          icon={CalendarCheck}
          title="No follow-ups waiting"
          description="Schedule the next touch from a lead workspace and it will appear here when it matters."
        />
      ) : (
        <div className="grid gap-3">
          {items.map((item) => {
            const overdue = item.dueAt < now;
            return (
              <article
                key={item.id}
                className="panel flex flex-col gap-4 p-4 sm:flex-row sm:items-center"
              >
                <div
                  className={`grid size-11 shrink-0 place-items-center rounded-xl ${overdue ? "bg-red-500/10 text-red-500" : "bg-amber-500/10 text-amber-500"}`}
                >
                  <Clock3 className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/leads/${item.leadId}`}
                      className="font-semibold hover:text-violet-500"
                    >
                      {item.businessName}
                    </Link>
                    <Badge tone={overdue ? "danger" : "warning"}>
                      {overdue ? "Overdue" : "Upcoming"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-strong">{item.title}</p>
                  <p className="mt-1 text-xs text-muted">
                    {item.dueAt.toLocaleString()} · Signal {item.score ?? "—"}
                  </p>
                </div>
                <form action={completeFollowUp}>
                  <input type="hidden" name="leadId" value={item.leadId} />
                  <input type="hidden" name="followUpId" value={item.id} />
                  <Button variant="secondary">
                    <CheckCircle2 className="size-4" />
                    Complete
                  </Button>
                </form>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
