"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { Button } from "@/components/ui/button";

export function DeleteLeadButton({
  leadId,
  leadName,
}: {
  leadId: string;
  leadName: string;
}) {
  const router = useRouter();

  async function deleteLead() {
    const response = await fetch("/api/leads", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leadIds: [leadId] }),
    });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      const message = data.error ?? "Lead deletion failed";
      toast.error("Could not delete lead", { description: message });
      throw new Error(message);
    }
    toast.success(`${leadName} was deleted`);
    router.push("/leads");
    router.refresh();
  }

  return (
    <ConfirmDeleteDialog
      title={`Delete ${leadName}?`}
      description="This permanently removes the lead and its audits, scores, notes, outreach, follow-ups, and generated sales intelligence. The business can still be added again from discovery."
      confirmLabel="Delete lead"
      onConfirm={deleteLead}
      trigger={
        <Button variant="ghost" className="text-red-400 hover:text-red-300">
          <Trash2 className="size-4" />
          Delete lead
        </Button>
      }
    />
  );
}
