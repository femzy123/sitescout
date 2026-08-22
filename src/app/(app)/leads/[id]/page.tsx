import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  ExternalLink,
  Globe2,
  Mail,
  MapPin,
  MessageSquare,
  NotebookPen,
  Phone,
  Star,
  Target,
  Timeline,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { AiAssistant } from "@/features/leads/ai-assistant";
import { DeleteLeadButton } from "@/features/leads/delete-lead-button";
import { SingleAuditButton } from "@/features/leads/single-audit-button";
import { titleCase } from "@/lib/utils";
import { requireOwnerContext } from "@/server/auth/owner-context";
import { getLeadDetail } from "@/server/services/leads";
import {
  addFollowUp,
  addNote,
  addOutreach,
  completeFollowUp,
  updateLeadStage,
  updateQualification,
} from "../actions";

const stages = [
  "new",
  "researching",
  "ready_to_contact",
  "contacted",
  "replied",
  "meeting",
  "proposal",
  "won",
  "lost",
];
const qualifications = ["unqualified", "low", "medium", "high", "hot"];

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const context = await requireOwnerContext();
  const detail = await getLeadDetail(context.organizationId, id);
  if (!detail) notFound();
  const { lead } = detail;
  const latestAudit = detail.audits[0];
  const latestScore = detail.scores[0];
  const reasons =
    (latestScore?.evidence as { reasons?: string[] } | undefined)?.reasons ??
    [];
  return (
    <>
      <Link
        href="/leads"
        className="mb-5 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-muted hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to leads
      </Link>
      <section className="panel overflow-hidden border-violet-400/20">
        <div className="p-5 sm:p-7">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  tone={
                    lead.scoreStatus === "complete"
                      ? "success"
                      : lead.scoreStatus === "provisional"
                        ? "warning"
                        : "neutral"
                  }
                >
                  {titleCase(lead.scoreStatus)}
                </Badge>
                <Badge tone="info">{titleCase(lead.stage)}</Badge>
                <Badge tone="violet">{titleCase(lead.qualification)}</Badge>
              </div>
              <h1 className="mt-4 max-w-5xl font-display text-3xl font-bold tracking-tighter sm:text-5xl">
                {lead.business.name}
              </h1>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted">
                {lead.business.category && (
                  <span>{titleCase(lead.business.category)}</span>
                )}
                {lead.business.address && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="size-3.5" />
                    {lead.business.address}
                  </span>
                )}
                <span className="inline-flex items-center gap-1">
                  <Star className="size-3.5 fill-amber-400 text-amber-400" />
                  {lead.business.rating ?? "—"} (
                  {lead.business.reviewCount ?? 0})
                </span>
              </div>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="text-left sm:text-right">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted">
                  Opportunity signal
                </p>
                <p className="tabular font-display text-6xl font-bold tracking-tighter text-violet-400">
                  {lead.opportunityScore ?? "—"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <DeleteLeadButton
                  leadId={lead.id}
                  leadName={lead.business.name}
                />
                <SingleAuditButton leadId={lead.id} />
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.25fr_.75fr]">
        <div className="space-y-5">
          <section className="panel p-5">
            <div className="flex items-center gap-2">
              <Target className="size-4 text-violet-500" />
              <h2 className="font-display text-lg font-bold">
                Opportunity evidence
              </h2>
            </div>
            {latestScore ? (
              <>
                <p className="mt-3 text-sm leading-6 text-muted-strong">
                  {latestScore.summary}
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  {[
                    { label: "Rule score", value: latestScore.ruleScore },
                    { label: "AI score", value: latestScore.aiScore ?? "—" },
                    { label: "Final score", value: latestScore.finalScore },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="rounded-xl border border-border bg-surface-strong/50 p-3"
                    >
                      <p className="text-[10px] uppercase tracking-wider text-muted">
                        {item.label}
                      </p>
                      <p className="tabular mt-1 font-display text-2xl font-bold">
                        {item.value}
                      </p>
                    </div>
                  ))}
                </div>
                <ul className="mt-4 space-y-2">
                  {reasons.map((reason) => (
                    <li
                      key={reason}
                      className="flex gap-2 text-sm text-muted-strong"
                    >
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-500" />
                      {reason}
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="mt-3 text-sm text-muted">
                Analyze this lead to build an explainable opportunity score.
              </p>
            )}
          </section>

          <section className="panel p-5">
            <div className="flex items-center gap-2">
              <Globe2 className="size-4 text-cyan-500" />
              <h2 className="font-display text-lg font-bold">Website audit</h2>
            </div>
            {latestAudit ? (
              <div className="mt-4">
                <div className="flex flex-wrap gap-2">
                  <Badge
                    tone={
                      latestAudit.status === "completed"
                        ? "success"
                        : latestAudit.status === "failed"
                          ? "danger"
                          : "warning"
                    }
                  >
                    {titleCase(latestAudit.status)}
                  </Badge>
                  <Badge>{latestAudit.auditVersion}</Badge>
                  <span className="text-xs text-muted">
                    {latestAudit.createdAt.toLocaleString()}
                  </span>
                </div>
                {latestAudit.errorMessage ? (
                  <p className="mt-3 rounded-xl border border-red-400/20 bg-red-500/10 p-3 text-sm text-red-300">
                    {latestAudit.errorMessage}
                  </p>
                ) : (
                  <>
                    <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {[
                        { l: "Performance", v: latestAudit.performanceScore },
                        { l: "SEO", v: latestAudit.seoScore },
                        {
                          l: "Accessibility",
                          v: latestAudit.accessibilityScore,
                        },
                        { l: "Website", v: latestAudit.overallWebsiteScore },
                      ].map((item) => (
                        <div
                          key={item.l}
                          className="rounded-xl border border-border p-3"
                        >
                          <p className="text-[10px] uppercase tracking-wider text-muted">
                            {item.l}
                          </p>
                          <p className="tabular mt-1 font-display text-2xl font-bold">
                            {item.v ?? "—"}
                          </p>
                        </div>
                      ))}
                    </div>
                    {latestAudit.aiSummary && (
                      <p className="mt-4 text-sm leading-6 text-muted-strong">
                        {latestAudit.aiSummary}
                      </p>
                    )}
                  </>
                )}
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted">
                No website analysis has been run.
              </p>
            )}
          </section>

          <AiAssistant
            leadId={lead.id}
            initialContent={detail.generations[0]?.content}
          />

          <section className="panel p-5">
            <div className="flex items-center gap-2">
              <Timeline className="size-4 text-violet-500" />
              <h2 className="font-display text-lg font-bold">Timeline</h2>
            </div>
            <div className="mt-4 space-y-0">
              {detail.events.length ? (
                detail.events.map((event) => (
                  <div
                    key={event.id}
                    className="grid grid-cols-[1rem_1fr] gap-3 pb-5 last:pb-0"
                  >
                    <div className="relative">
                      <span className="mt-1 block size-2 rounded-full bg-violet-400" />
                      <span className="absolute left-0.75 top-4 h-[calc(100%-8px)] w-px bg-border last:hidden" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">
                        {titleCase(event.type)}
                      </p>
                      <p className="mt-1 text-xs text-muted">
                        {event.occurredAt.toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted">No activity yet.</p>
              )}
            </div>
          </section>
        </div>

        <aside className="space-y-5">
          <section className="panel p-5">
            <h2 className="font-display text-lg font-bold">Lead controls</h2>
            <form action={updateLeadStage} className="mt-4">
              <input type="hidden" name="leadId" value={lead.id} />
              <label className="text-xs font-semibold">Pipeline stage</label>
              <div className="mt-2 flex gap-2">
                <select
                  name="stage"
                  defaultValue={lead.stage}
                  className="h-11 min-w-0 flex-1 rounded-xl border border-border bg-surface px-3 text-sm"
                >
                  {stages.map((stage) => (
                    <option key={stage} value={stage}>
                      {titleCase(stage)}
                    </option>
                  ))}
                </select>
                <Button size="sm">Save</Button>
              </div>
            </form>
            <form action={updateQualification} className="mt-4">
              <input type="hidden" name="leadId" value={lead.id} />
              <label className="text-xs font-semibold">Qualification</label>
              <div className="mt-2 flex gap-2">
                <select
                  name="qualification"
                  defaultValue={lead.qualification}
                  className="h-11 min-w-0 flex-1 rounded-xl border border-border bg-surface px-3 text-sm"
                >
                  {qualifications.map((value) => (
                    <option key={value} value={value}>
                      {titleCase(value)}
                    </option>
                  ))}
                </select>
                <Button size="sm" variant="secondary">
                  Override
                </Button>
              </div>
            </form>
          </section>

          <section className="panel p-5">
            <h2 className="font-display text-lg font-bold">Business details</h2>
            <div className="mt-4 space-y-3 text-sm">
              {lead.business.phone && (
                <a
                  href={`tel:${lead.business.phone}`}
                  className="flex min-h-11 items-center gap-3 rounded-xl px-2 hover:bg-surface-strong"
                >
                  <Phone className="size-4 text-muted" />
                  {lead.business.phone}
                </a>
              )}
              {lead.business.websiteUrl && (
                <a
                  href={lead.business.websiteUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex min-h-11 items-center gap-3 rounded-xl px-2 hover:bg-surface-strong"
                >
                  <Globe2 className="size-4 text-muted" />
                  Visit website
                  <ExternalLink className="ml-auto size-3.5" />
                </a>
              )}
              {lead.business.mapsUrl && (
                <a
                  href={lead.business.mapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex min-h-11 items-center gap-3 rounded-xl px-2 hover:bg-surface-strong"
                >
                  <MapPin className="size-4 text-muted" />
                  Open in Maps
                  <ExternalLink className="ml-auto size-3.5" />
                </a>
              )}
              {lead.contactEmail && (
                <a
                  href={`mailto:${lead.contactEmail}`}
                  className="flex min-h-11 items-center gap-3 rounded-xl px-2 hover:bg-surface-strong"
                >
                  <Mail className="size-4 text-muted" />
                  {lead.contactEmail}
                </a>
              )}
            </div>
          </section>

          <section className="panel p-5">
            <div className="flex items-center gap-2">
              <Phone className="size-4 text-cyan-500" />
              <h2 className="font-display text-lg font-bold">
                Record outreach
              </h2>
            </div>
            <form action={addOutreach} className="mt-4 space-y-3">
              <input type="hidden" name="leadId" value={lead.id} />
              <div className="grid grid-cols-2 gap-2">
                <select
                  name="type"
                  className="h-11 rounded-xl border border-border bg-surface px-3 text-sm"
                >
                  <option value="call">Call</option>
                  <option value="email">Email</option>
                  <option value="dm">DM</option>
                  <option value="meeting">Meeting</option>
                </select>
                <select
                  name="outcome"
                  className="h-11 rounded-xl border border-border bg-surface px-3 text-sm"
                >
                  <option value="no_answer">No answer</option>
                  <option value="sent">Sent</option>
                  <option value="replied">Replied</option>
                  <option value="interested">Interested</option>
                  <option value="meeting_booked">Meeting booked</option>
                  <option value="not_interested">Not interested</option>
                </select>
              </div>
              <Textarea name="body" placeholder="What happened?" />
              <Button className="w-full">
                <MessageSquare className="size-4" />
                Record activity
              </Button>
            </form>
          </section>

          <section className="panel p-5">
            <div className="flex items-center gap-2">
              <CalendarClock className="size-4 text-amber-500" />
              <h2 className="font-display text-lg font-bold">Follow-up</h2>
            </div>
            <form action={addFollowUp} className="mt-4 space-y-3">
              <input type="hidden" name="leadId" value={lead.id} />
              <Input
                name="title"
                placeholder="Call with website outline"
                required
              />
              <Input name="dueAt" type="datetime-local" required />
              <Textarea
                name="details"
                placeholder="Context for the next touch"
              />
              <Button variant="secondary" className="w-full">
                Schedule follow-up
              </Button>
            </form>
            {detail.followups
              .filter((item) => item.status === "pending")
              .map((item) => (
                <div
                  key={item.id}
                  className="mt-3 rounded-xl border border-border p-3"
                >
                  <p className="text-sm font-semibold">{item.title}</p>
                  <p className="mt-1 text-xs text-muted">
                    {item.dueAt.toLocaleString()}
                  </p>
                  <form action={completeFollowUp} className="mt-2">
                    <input type="hidden" name="leadId" value={lead.id} />
                    <input type="hidden" name="followUpId" value={item.id} />
                    <Button size="sm" variant="ghost">
                      <CheckCircle2 className="size-3.5" />
                      Complete
                    </Button>
                  </form>
                </div>
              ))}
          </section>

          <section className="panel p-5">
            <div className="flex items-center gap-2">
              <NotebookPen className="size-4 text-violet-500" />
              <h2 className="font-display text-lg font-bold">Notes</h2>
            </div>
            <form action={addNote} className="mt-4 space-y-3">
              <input type="hidden" name="leadId" value={lead.id} />
              <Textarea
                name="body"
                placeholder="Add prospect context…"
                required
              />
              <Button variant="secondary" className="w-full">
                Add note
              </Button>
            </form>
            <div className="mt-4 space-y-3">
              {detail.notes.map((note) => (
                <div
                  key={note.id}
                  className="rounded-xl bg-surface-strong/60 p-3"
                >
                  <p className="whitespace-pre-wrap text-sm leading-5">
                    {note.body}
                  </p>
                  <p className="mt-2 text-[10px] text-muted">
                    {note.createdAt.toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </>
  );
}
