"use client";

import {
  Check,
  ExternalLink,
  Globe2,
  LoaderCircle,
  MapPin,
  Plus,
  Radar,
  Star,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { Input } from "@/components/ui/input";
import type { DiscoveryCandidate } from "@/server/services/places";

type SearchResponse = {
  candidates: DiscoveryCandidate[];
  partial: boolean;
  message?: string;
  error?: string;
};

export function DiscoveryWorkspace({
  initialCandidates = [],
}: {
  initialCandidates?: DiscoveryCandidate[];
}) {
  const [location, setLocation] = useState("");
  const [category, setCategory] = useState("");
  const [websiteFilter, setWebsiteFilter] = useState("any");
  const [targetCount, setTargetCount] = useState(25);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [candidates, setCandidates] = useState(initialCandidates);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const addableSelected = useMemo(
    () =>
      candidates.filter(
        (candidate) =>
          selected.has(candidate.discoveryResultId) &&
          !candidate.existingLeadId,
      ),
    [candidates, selected],
  );

  async function search(event: React.FormEvent) {
    event.preventDefault();
    setSearching(true);
    setSelected(new Set());
    try {
      const response = await fetch("/api/discovery/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          location,
          category,
          websiteFilter,
          targetCount,
        }),
      });
      const data = (await response.json()) as SearchResponse;
      if (!response.ok) throw new Error(data.error ?? "Search failed");
      setCandidates(data.candidates);
      if (data.partial)
        toast.warning("Partial results saved", { description: data.message });
      else toast.success(`${data.candidates.length} businesses found`);
    } catch (error) {
      toast.error("Could not complete discovery", {
        description: error instanceof Error ? error.message : "Try again",
      });
    } finally {
      setSearching(false);
    }
  }

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function addBusinessIds(ids: string[]) {
    if (!ids.length) return;
    setAdding(true);
    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessIds: ids }),
      });
      const data = (await response.json()) as {
        leads?: { id: string; businessId: string }[];
        createdCount?: number;
        error?: string;
      };
      if (!response.ok) throw new Error(data.error ?? "Lead creation failed");
      const byBusiness = new Map(
        data.leads?.map((lead) => [lead.businessId, lead.id]),
      );
      setCandidates((items) =>
        items.map((item) => ({
          ...item,
          existingLeadId:
            byBusiness.get(item.businessId) ?? item.existingLeadId,
        })),
      );
      setSelected(new Set());
      toast.success(`${data.createdCount ?? 0} new leads added`);
    } catch (error) {
      toast.error("Could not add leads", {
        description: error instanceof Error ? error.message : "Try again",
      });
    } finally {
      setAdding(false);
    }
  }

  async function addSelected() {
    await addBusinessIds(
      addableSelected.map((candidate) => candidate.businessId),
    );
  }

  async function deleteResults(resultIds: string[]) {
    if (!resultIds.length) return;
    setDeleting(true);
    try {
      const response = await fetch("/api/discovery/results", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resultIds }),
      });
      const data = (await response.json()) as {
        deletedCount?: number;
        error?: string;
      };
      if (!response.ok)
        throw new Error(data.error ?? "Discovery deletion failed");
      const deletedIds = new Set(resultIds);
      setCandidates((items) =>
        items.filter((item) => !deletedIds.has(item.discoveryResultId)),
      );
      setSelected((current) => {
        const next = new Set(current);
        resultIds.forEach((id) => next.delete(id));
        return next;
      });
      toast.success(
        `${data.deletedCount ?? resultIds.length} discovery result${resultIds.length === 1 ? "" : "s"} deleted`,
      );
    } catch (error) {
      toast.error("Could not delete discovery results", {
        description: error instanceof Error ? error.message : "Try again",
      });
      throw error;
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-5">
      <form onSubmit={search} className="panel p-4 sm:p-5">
        <div className="grid gap-4 lg:grid-cols-[1fr_1fr_170px_120px_auto]">
          <label className="block">
            <span className="mb-2 block text-xs font-semibold">Location</span>
            <Input
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder="Lagos, Nigeria"
              required
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-xs font-semibold">
              Business category
            </span>
            <Input
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              placeholder="Dental clinics"
              required
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-xs font-semibold">
              Website signal
            </span>
            <select
              value={websiteFilter}
              onChange={(event) => setWebsiteFilter(event.target.value)}
              className="h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm"
            >
              <option value="any">Any status</option>
              <option value="missing">No website</option>
              <option value="present">Has website</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-2 block text-xs font-semibold">Results</span>
            <select
              value={targetCount}
              onChange={(event) => setTargetCount(Number(event.target.value))}
              className="h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </label>
          <Button className="self-end" disabled={searching}>
            {searching ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <Radar className="size-4" />
            )}
            {searching ? "Scouting…" : "Scout area"}
          </Button>
        </div>
        <p className="mt-3 text-xs text-muted">
          Discovery saves candidates only. It never creates leads or runs
          expensive analysis automatically.
        </p>
      </form>

      {candidates.length > 0 && (
        <div className="panel overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                aria-label="Select all candidates"
                checked={
                  candidates.length > 0 && selected.size === candidates.length
                }
                onChange={() =>
                  setSelected(
                    selected.size === candidates.length
                      ? new Set()
                      : new Set(
                          candidates.map((item) => item.discoveryResultId),
                        ),
                  )
                }
                className="size-4 accent-violet-500"
              />
              <p className="text-sm font-semibold">
                {candidates.length} candidates
              </p>
              <Badge tone="neutral">{selected.size} selected</Badge>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <ConfirmDeleteDialog
                title={`Delete ${selected.size} discovery result${selected.size === 1 ? "" : "s"}?`}
                description="This permanently removes the selected results from this discovery search. Existing businesses and leads are not affected."
                confirmLabel="Delete results"
                onConfirm={() => deleteResults([...selected])}
                trigger={
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-400 hover:text-red-300"
                    disabled={!selected.size || deleting}
                  >
                    <Trash2 className="size-4" />
                    Delete selected
                  </Button>
                }
              />
              <Button
                size="sm"
                disabled={!addableSelected.length || adding || deleting}
                onClick={addSelected}
              >
                {adding ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <Plus className="size-4" />
                )}
                Add {addableSelected.length || "selected"} to leads
              </Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-215 text-left">
              <thead className="border-b border-border bg-surface-strong/70 text-[10px] uppercase tracking-widest text-muted">
                <tr>
                  <th className="w-12 px-4 py-3">
                    <span className="sr-only">Select</span>
                  </th>
                  <th className="px-3 py-3">Business</th>
                  <th className="px-3 py-3">Website</th>
                  <th className="px-3 py-3">Rating</th>
                  <th className="px-3 py-3">Location</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {candidates.map((candidate) => (
                  <tr
                    key={candidate.businessId}
                    className="hover:bg-surface-strong/50"
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        aria-label={`Select ${candidate.name}`}
                        checked={selected.has(candidate.discoveryResultId)}
                        onChange={() => toggle(candidate.discoveryResultId)}
                        className="size-4 accent-violet-500"
                      />
                    </td>
                    <td className="px-3 py-3">
                      <p className="text-sm font-semibold">{candidate.name}</p>
                      <p className="mt-1 text-xs text-muted">
                        {candidate.category?.replaceAll("_", " ") ??
                          "Local business"}
                      </p>
                    </td>
                    <td className="px-3 py-3">
                      {candidate.websiteUrl ? (
                        <a
                          href={candidate.websiteUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-semibold text-cyan-300 hover:underline"
                        >
                          <Globe2 className="size-3.5" />
                          Website
                          <ExternalLink className="size-3" />
                        </a>
                      ) : (
                        <Badge tone="warning">No website</Badge>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <span className="inline-flex items-center gap-1 text-sm">
                        <Star className="size-3.5 fill-amber-400 text-amber-400" />
                        {candidate.rating ?? "—"}
                        <span className="text-xs text-muted">
                          ({candidate.reviewCount ?? 0})
                        </span>
                      </span>
                    </td>
                    <td className="max-w-62.5 px-3 py-3">
                      <p className="flex items-start gap-1.5 text-xs leading-5 text-muted">
                        <MapPin className="mt-0.5 size-3.5 shrink-0" />
                        {candidate.address ?? "Address unavailable"}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        {candidate.existingLeadId ? (
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/leads/${candidate.existingLeadId}`}>
                              <Check className="size-3.5" />
                              View lead
                            </Link>
                          </Button>
                        ) : (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() =>
                              void addBusinessIds([candidate.businessId])
                            }
                          >
                            <Plus className="size-3.5" />
                            Add
                          </Button>
                        )}
                        <ConfirmDeleteDialog
                          title={`Delete ${candidate.name}?`}
                          description="This permanently removes the business from this discovery result only. An existing lead is not affected."
                          confirmLabel="Delete result"
                          onConfirm={() =>
                            deleteResults([candidate.discoveryResultId])
                          }
                          trigger={
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-9 min-h-9 text-red-400 hover:text-red-300"
                              aria-label={`Delete ${candidate.name} from discovery`}
                              disabled={deleting}
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
      )}
    </div>
  );
}
