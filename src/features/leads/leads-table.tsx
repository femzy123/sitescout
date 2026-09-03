"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  ChevronDown,
  Download,
  ExternalLink,
  FileDown,
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
import type { AuditProgress } from "@/lib/audit-events";
import { readAuditStartFailure } from "@/lib/audit-start-failure";
import { titleCase } from "@/lib/utils";
import type { LeadListRow } from "@/server/services/leads";

export function LeadsTable({ leads }: { leads: LeadListRow[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [running, setRunning] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState<"selected" | "all" | null>(null);
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
    if (!response.ok || !response.body) {
      const failure = await readAuditStartFailure(response);
      console.error("[SiteScout audit start failure]", failure.diagnostic);
      throw new Error(failure.message);
    }
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
        const event = JSON.parse(line) as AuditProgress;
        if (event.type === "diagnostic") {
          console.error("[SiteScout audit diagnostic]", event);
          continue;
        }
        setBatchProgress((state) => ({
          current,
          total,
          lead: lead.name,
          progress: event.progress,
          stage: event.message,
          failed: state?.failed ?? 0,
        }));
        if (event.type === "error") {
          if (event.details)
            console.error("[SiteScout audit diagnostic]", event);
          throw new Error(event.message);
        }
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
        console.error("[SiteScout audit request failed]", error);
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

  async function exportLeads(scope: "selected" | "all") {
    const leadIds =
      scope === "selected"
        ? [...selected].filter((id) => !deletedIds.has(id))
        : undefined;
    if (scope === "selected" && !leadIds?.length) return;

    setExporting(scope);
    try {
      const response = await fetch("/api/leads/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope,
          ...(leadIds ? { leadIds } : {}),
        }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(data?.error ?? "Lead export failed");
      }

      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition");
      const filename =
        disposition?.match(/filename="([^"]+)"/i)?.[1] ??
        `sitescout-${scope}-leads-${new Date().toISOString().slice(0, 10)}.csv`;
      const objectUrl = URL.createObjectURL(blob);
      const download = document.createElement("a");
      download.href = objectUrl;
      download.download = filename;
      document.body.appendChild(download);
      download.click();
      download.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);

      toast.success("CSV export ready", {
        description:
          scope === "selected"
            ? `${leadIds?.length ?? 0} selected lead${leadIds?.length === 1 ? "" : "s"} exported`
            : "All leads exported",
      });
    } catch (error) {
      toast.error("Could not export leads", {
        description: error instanceof Error ? error.message : "Try again",
      });
    } finally {
      setExporting(null);
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
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={Boolean(exporting) || deleting}
                >
                  {exporting ? (
                    <LoaderCircle className="size-4 animate-spin" />
                  ) : (
                    <Download className="size-4" />
                  )}
                  {exporting ? "Exporting..." : "Export"}
                  <ChevronDown className="size-3.5 text-muted" />
                </Button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  align="end"
                  sideOffset={8}
                  className="z-50 min-w-64 rounded-xl border border-border-strong bg-[#111014] p-1.5 shadow-2xl outline-none"
                >
                  <DropdownMenu.Label className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-widest text-muted">
                    Download CSV
                  </DropdownMenu.Label>
                  <DropdownMenu.Item
                    disabled={!selected.size || Boolean(exporting)}
                    onSelect={() => void exportLeads("selected")}
                    className="flex cursor-pointer items-start gap-3 rounded-lg px-3 py-2.5 outline-none transition data-[disabled]:pointer-events-none data-[disabled]:opacity-40 data-[highlighted]:bg-surface-strong"
                  >
                    <FileDown className="mt-0.5 size-4 shrink-0 text-violet-300" />
                    <span>
                      <span className="block text-sm font-semibold">
                        Export selected ({selected.size})
                      </span>
                      <span className="mt-0.5 block text-xs text-muted">
                        Only the leads you checked
                      </span>
                    </span>
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    disabled={Boolean(exporting)}
                    onSelect={() => void exportLeads("all")}
                    className="flex cursor-pointer items-start gap-3 rounded-lg px-3 py-2.5 outline-none transition data-[disabled]:pointer-events-none data-[disabled]:opacity-40 data-[highlighted]:bg-surface-strong"
                  >
                    <Download className="mt-0.5 size-4 shrink-0 text-cyan-300" />
                    <span>
                      <span className="block text-sm font-semibold">
                        Export all leads
                      </span>
                      <span className="mt-0.5 block text-xs text-muted">
                        Your complete lead collection
                      </span>
                    </span>
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
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
