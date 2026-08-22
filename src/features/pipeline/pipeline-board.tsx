"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { titleCase } from "@/lib/utils";
import type { LeadListRow } from "@/server/services/leads";

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
] as const;
type Stage = (typeof stages)[number];

function Card({
  lead,
  onStage,
}: {
  lead: LeadListRow;
  onStage: (id: string, stage: Stage) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: lead.id, data: { stage: lead.stage } });
  return (
    <article
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={`rounded-xl border border-border bg-surface p-3 shadow-sm ${isDragging ? "z-50 opacity-70" : ""}`}
    >
      <div className="flex items-start gap-2">
        <button
          className="grid size-8 shrink-0 cursor-grab place-items-center rounded-lg text-muted hover:bg-surface-strong"
          aria-label={`Drag ${lead.name}`}
          {...listeners}
          {...attributes}
        >
          <GripVertical className="size-4" />
        </button>
        <Link href={`/leads/${lead.id}`} className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold hover:text-violet-500">
            {lead.name}
          </p>
          <p className="mt-1 truncate text-xs text-muted">
            {lead.category?.replaceAll("_", " ") ?? "Local business"}
          </p>
        </Link>
        <span className="tabular font-display text-xl font-bold">
          {lead.opportunityScore ?? "—"}
        </span>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <Badge
          tone={
            lead.qualification === "hot" || lead.qualification === "high"
              ? "violet"
              : "neutral"
          }
        >
          {titleCase(lead.qualification)}
        </Badge>
        <label className="ml-auto">
          <span className="sr-only">Move {lead.name} to stage</span>
          <select
            value={lead.stage}
            onChange={(event) => onStage(lead.id, event.target.value as Stage)}
            className="h-8 max-w-28 rounded-lg border border-border bg-surface-strong px-2 text-[10px] font-semibold"
          >
            {stages.map((stage) => (
              <option key={stage} value={stage}>
                {titleCase(stage)}
              </option>
            ))}
          </select>
        </label>
      </div>
    </article>
  );
}

function Column({
  stage,
  leads,
  onStage,
}: {
  stage: Stage;
  leads: LeadListRow[];
  onStage: (id: string, stage: Stage) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  return (
    <section
      ref={setNodeRef}
      className={`w-72.5 shrink-0 rounded-2xl border p-3 transition-colors ${isOver ? "border-violet-400 bg-violet-500/5" : "border-border bg-sidebar/60"}`}
    >
      <div className="mb-3 flex items-center justify-between px-1">
        <h2 className="text-xs font-bold uppercase tracking-widest">
          {titleCase(stage)}
        </h2>
        <Badge>{leads.length}</Badge>
      </div>
      <div className="space-y-2">
        {leads.map((lead) => (
          <Card key={lead.id} lead={lead} onStage={onStage} />
        ))}
        {leads.length === 0 && (
          <div className="rounded-xl border border-dashed border-border px-3 py-8 text-center text-xs text-muted">
            Drop a lead here
          </div>
        )}
      </div>
    </section>
  );
}

export function PipelineBoard({
  initialLeads,
}: {
  initialLeads: LeadListRow[];
}) {
  const [leads, setLeads] = useState(initialLeads);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  );
  async function move(id: string, stage: Stage) {
    const previous = leads;
    setLeads((items) =>
      items.map((lead) => (lead.id === id ? { ...lead, stage } : lead)),
    );
    try {
      const response = await fetch(`/api/leads/${id}/stage`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage }),
      });
      if (!response.ok) throw new Error("Update failed");
    } catch {
      setLeads(previous);
      toast.error("Could not move lead");
    }
  }
  function dragEnd(event: DragEndEvent) {
    const stage = event.over?.id as Stage | undefined;
    if (stage && stages.includes(stage))
      void move(String(event.active.id), stage);
  }
  return (
    <DndContext sensors={sensors} onDragEnd={dragEnd}>
      <div className="overflow-x-auto pb-4">
        <div className="flex min-w-max gap-3">
          {stages.map((stage) => (
            <Column
              key={stage}
              stage={stage}
              leads={leads.filter((lead) => lead.stage === stage)}
              onStage={(id, next) => void move(id, next)}
            />
          ))}
        </div>
      </div>
    </DndContext>
  );
}
