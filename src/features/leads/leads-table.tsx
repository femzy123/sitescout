"use client";

import {
  ExternalLink,
  Globe2,
  LoaderCircle,
  Radar,
  Search,
  Star,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { Input } from "@/components/ui/input";
import { titleCase } from "@/lib/utils";
import type { LeadListRow } from "@/server/services/leads";

type ProgressEvent = {
  type: "progress" | "complete" | "error";
  progress: number;
  stage: string;
  message: string;
  leadId?: string;
};

export function LeadsTable({ leads }: { leads: LeadListRow[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [running, setRunning] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{
    current: number;
    total: number;
    lead: string;
    progress: number;
    stage: string;
    failed: number;
  } | null>(null);
  const filtered = useMemo(
    () =>
      leads.filter(
        (lead) =>
          !deletedIds.has(lead.id) &&
          `${lead.name} ${lead.category ?? ""} ${lead.address ?? ""}`
            .toLowerCase()
            .includes(query.toLowerCase()),
      ),
    [deletedIds, leads, query],
  );

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function runOne(lead: LeadListRow, current: number, total: number) {
    const response = await fetch("/api/audits/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leadId: lead.id }),
    });
    if (!response.ok || !response.body)
      throw new Error(
        (await response.json().catch(() => null))?.error ??
          "Audit could not start",
      );
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        const event = JSON.parse(line) as ProgressEvent;
        setBatchProgress((state) => ({
          current,
          total,
          lead: lead.name,
          progress: event.progress,
          stage: event.message,
          failed: state?.failed ?? 0,
        }));
        if (event.type === "error") throw new Error(event.message);
      }
    }
  }

  async function analyzeSelected() {
    const batch = leads
      .filter((lead) => !deletedIds.has(lead.id) && selected.has(lead.id))
      .slice(0, 20);
    if (!batch.length) return;
    setRunning(true);
    let failed = 0;
    for (let index = 0; index < batch.length; index += 1) {
      try {
        await runOne(batch[index], index + 1, batch.length);
      } catch (error) {
        failed += 1;
        setBatchProgress((state) => (state ? { ...state, failed } : null));
        toast.error(`${batch[index].name} failed`, {
          description: error instanceof Error ? error.message : "Try again",
        });
      }
    }
    setRunning(false);
    setSelected(new Set());
    toast.success("Bulk analysis finished", {
      description: `${batch.length - failed} completed · ${failed} failed`,
    });
    router.refresh();
  }

  async function deleteLeads(leadIds: string[]) {
    if (!leadIds.length) return;
    setDeleting(true);
    try {
      const response = await fetch("/api/leads", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadIds }),
      });
      const data = (await response.json()) as {
        deletedCount?: number;
        error?: string;
      };
      if (!response.ok) throw new Error(data.error ?? "Lead deletion failed");
      const removedIds = new Set(leadIds);
      setDeletedIds((current) => new Set([...current, ...leadIds]));
      setSelected((current) => {
        const next = new Set(current);
        removedIds.forEach((id) => next.delete(id));
        return next;
      });
      toast.success(
        `${data.deletedCount ?? leadIds.length} lead${leadIds.length === 1 ? "" : "s"} deleted`,
      );
      router.refresh();
    } catch (error) {
      toast.error("Could not delete leads", {
        description: error instanceof Error ? error.message : "Try again",
      });
      throw error;
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-4">
      {batchProgress && (
        <div className="panel p-4" role="status" aria-live="polite">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">
                Analyzing {batchProgress.lead}
              </p>
              <p className="mt-1 text-xs text-muted">
                Lead {batchProgress.current} of {batchProgress.total} ·{" "}
                {batchProgress.stage}
              </p>
            </div>
            <p className="tabular font-display text-2xl font-bold text-violet-500">
              {batchProgress.progress}%
            </p>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-strong">
            <div
              className="h-full rounded-full bg-violet-500 transition-[width] duration-300"
              style={{ width: `${batchProgress.progress}%` }}
            />
          </div>
          {batchProgress.failed > 0 && (
            <p className="mt-2 text-xs text-red-500">
              {batchProgress.failed} item{batchProgress.failed === 1 ? "" : "s"}{" "}
              failed; the remaining batch will continue.
            </p>
          )}
        </div>
      )}
      <div className="panel overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative max-w-md flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search businesses, categories, places…"
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-2">
            <Badge>{selected.size} selected</Badge>
            <ConfirmDeleteDialog
              title={`Delete ${selected.size} lead${selected.size === 1 ? "" : "s"}?`}
              description="This permanently removes the selected leads and all of their audits, scores, notes, outreach, follow-ups, and generated sales intelligence."
              confirmLabel="Delete leads"
              onConfirm={() => deleteLeads([...selected])}
              trigger={
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-red-400 hover:text-red-300"
                  disabled={!selected.size || running || deleting}
                >
                  <Trash2 className="size-4" />
                  Delete selected
                </Button>
              }
            />
            <Button
              size="sm"
              disabled={
                !selected.size || selected.size > 20 || running || deleting
              }
              onClick={() => void analyzeSelected()}
              title={
                selected.size > 20
                  ? "Bulk analysis supports up to 20 selected leads"
                  : undefined
              }
            >
              {running ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <Radar className="size-4" />
              )}
              {selected.size > 20 ? "Select up to 20" : "Analyze selected"}
            </Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-245 text-left">
            <thead className="border-b border-border bg-surface-strong/70 text-[10px] uppercase tracking-widest text-muted">
              <tr>
                <th className="w-12 px-4 py-3">
                  <input
                    type="checkbox"
                    aria-label="Select visible leads"
                    checked={
                      filtered.length > 0 &&
                      filtered.every((lead) => selected.has(lead.id))
                    }
                    onChange={() =>
                      setSelected(
                        filtered.every((lead) => selected.has(lead.id))
                          ? new Set()
                          : new Set(filtered.map((lead) => lead.id)),
                      )
                    }
                    className="size-4 accent-violet-500"
                  />
                </th>
                <th className="px-3 py-3">Lead</th>
                <th className="px-3 py-3">Opportunity</th>
                <th className="px-3 py-3">Stage</th>
                <th className="px-3 py-3">Website</th>
                <th className="px-3 py-3">Proof</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((lead) => (
                <tr key={lead.id} className="hover:bg-surface-strong/50">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(lead.id)}
                      onChange={() => toggle(lead.id)}
                      aria-label={`Select ${lead.name}`}
                      className="size-4 accent-violet-500"
                    />
                  </td>
                  <td className="px-3 py-3">
                    <p className="text-sm font-semibold">{lead.name}</p>
                    <p className="mt-1 text-xs text-muted">
                      {lead.category?.replaceAll("_", " ") ??
                        lead.address ??
                        "Local business"}
                    </p>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <span className="tabular font-display text-2xl font-bold">
                        {lead.opportunityScore ?? "—"}
                      </span>
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
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <Badge
                      tone={
                        lead.stage === "won"
                          ? "success"
                          : lead.stage === "lost"
                            ? "danger"
                            : "info"
                      }
                    >
                      {titleCase(lead.stage)}
                    </Badge>
                  </td>
                  <td className="px-3 py-3">
                    {lead.websiteUrl ? (
                      <a
                        href={lead.websiteUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-cyan-300 hover:underline"
                      >
                        <Globe2 className="size-3.5" />
                        Visit
                        <ExternalLink className="size-3" />
                      </a>
                    ) : (
                      <Badge tone="warning">Missing</Badge>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <span className="inline-flex items-center gap-1 text-xs">
                      <Star className="size-3.5 fill-amber-400 text-amber-400" />
                      {lead.rating ?? "—"}{" "}
                      <span className="text-muted">
                        ({lead.reviewCount ?? 0})
                      </span>
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/leads/${lead.id}`}>
                          Open
                          <ExternalLink className="size-3.5" />
                        </Link>
                      </Button>
                      <ConfirmDeleteDialog
                        title={`Delete ${lead.name}?`}
                        description="This permanently removes the lead and all of its audit and sales history. The business can still be added again from discovery."
                        confirmLabel="Delete lead"
                        onConfirm={() => deleteLeads([lead.id])}
                        trigger={
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-9 min-h-9 text-red-400 hover:text-red-300"
                            aria-label={`Delete ${lead.name}`}
                            disabled={running || deleting}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        }
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
