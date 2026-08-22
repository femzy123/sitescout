"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireOwnerContext } from "@/server/auth/owner-context";
import { getDb } from "@/server/db";
import {
  followUps,
  leadEvents,
  leads,
  notes,
  outreachActivities,
} from "@/server/db/schema";

const idSchema = z.string().uuid();
const stageSchema = z.enum([
  "new",
  "researching",
  "ready_to_contact",
  "contacted",
  "replied",
  "meeting",
  "proposal",
  "won",
  "lost",
]);
const qualificationSchema = z.enum([
  "unqualified",
  "low",
  "medium",
  "high",
  "hot",
]);

async function recordEvent(
  context: Awaited<ReturnType<typeof requireOwnerContext>>,
  leadId: string,
  type: string,
  metadata: Record<string, unknown>,
) {
  await getDb().insert(leadEvents).values({
    organizationId: context.organizationId,
    leadId,
    actorUserId: context.userId,
    type,
    metadata,
  });
}

export async function updateLeadStage(formData: FormData) {
  const context = await requireOwnerContext();
  const leadId = idSchema.parse(formData.get("leadId"));
  const stage = stageSchema.parse(formData.get("stage"));
  await getDb()
    .update(leads)
    .set({
      pipelineStage: stage,
      stageChangedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(leads.organizationId, context.organizationId),
        eq(leads.id, leadId),
      ),
    );
  await recordEvent(context, leadId, "pipeline.changed", { stage });
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/pipeline");
  revalidatePath("/");
}

export async function updateQualification(formData: FormData) {
  const context = await requireOwnerContext();
  const leadId = idSchema.parse(formData.get("leadId"));
  const qualification = qualificationSchema.parse(
    formData.get("qualification"),
  );
  await getDb()
    .update(leads)
    .set({
      qualification,
      qualificationOverridden: true,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(leads.organizationId, context.organizationId),
        eq(leads.id, leadId),
      ),
    );
  await recordEvent(context, leadId, "qualification.overridden", {
    qualification,
  });
  revalidatePath(`/leads/${leadId}`);
}

export async function addNote(formData: FormData) {
  const context = await requireOwnerContext();
  const leadId = idSchema.parse(formData.get("leadId"));
  const body = z.string().trim().min(1).max(5000).parse(formData.get("body"));
  await getDb().insert(notes).values({
    organizationId: context.organizationId,
    leadId,
    authorUserId: context.userId,
    body,
  });
  await recordEvent(context, leadId, "note.added", {});
  revalidatePath(`/leads/${leadId}`);
}

export async function addOutreach(formData: FormData) {
  const context = await requireOwnerContext();
  const leadId = idSchema.parse(formData.get("leadId"));
  const input = z
    .object({
      type: z.enum(["call", "email", "dm", "meeting", "other"]),
      outcome: z.enum([
        "no_answer",
        "voicemail",
        "sent",
        "replied",
        "interested",
        "not_interested",
        "meeting_booked",
        "other",
      ]),
      body: z.string().trim().max(5000).optional(),
    })
    .parse({
      type: formData.get("type"),
      outcome: formData.get("outcome"),
      body: formData.get("body") || undefined,
    });
  await getDb().insert(outreachActivities).values({
    organizationId: context.organizationId,
    leadId,
    actorUserId: context.userId,
    type: input.type,
    outcome: input.outcome,
    body: input.body,
  });
  await getDb()
    .update(leads)
    .set({
      lastContactedAt: new Date(),
      pipelineStage: "contacted",
      stageChangedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(leads.organizationId, context.organizationId),
        eq(leads.id, leadId),
      ),
    );
  await recordEvent(context, leadId, "outreach.recorded", {
    type: input.type,
    outcome: input.outcome,
  });
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/");
}

export async function addFollowUp(formData: FormData) {
  const context = await requireOwnerContext();
  const leadId = idSchema.parse(formData.get("leadId"));
  const input = z
    .object({
      title: z.string().trim().min(1).max(160),
      details: z.string().trim().max(2000).optional(),
      dueAt: z.coerce.date(),
    })
    .parse({
      title: formData.get("title"),
      details: formData.get("details") || undefined,
      dueAt: formData.get("dueAt"),
    });
  await getDb()
    .insert(followUps)
    .values({
      organizationId: context.organizationId,
      leadId,
      assignedTo: context.userId,
      ...input,
    });
  await getDb()
    .update(leads)
    .set({ nextFollowUpAt: input.dueAt, updatedAt: new Date() })
    .where(
      and(
        eq(leads.organizationId, context.organizationId),
        eq(leads.id, leadId),
      ),
    );
  await recordEvent(context, leadId, "follow_up.created", {
    dueAt: input.dueAt.toISOString(),
  });
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/follow-ups");
  revalidatePath("/");
}

export async function completeFollowUp(formData: FormData) {
  const context = await requireOwnerContext();
  const leadId = idSchema.parse(formData.get("leadId"));
  const followUpId = idSchema.parse(formData.get("followUpId"));
  await getDb()
    .update(followUps)
    .set({
      status: "completed",
      completedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(followUps.organizationId, context.organizationId),
        eq(followUps.leadId, leadId),
        eq(followUps.id, followUpId),
      ),
    );
  await recordEvent(context, leadId, "follow_up.completed", { followUpId });
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/follow-ups");
  revalidatePath("/");
}
