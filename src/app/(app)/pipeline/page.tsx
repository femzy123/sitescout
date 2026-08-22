import { PageHeading } from "@/components/page-heading";
import { PipelineBoard } from "@/features/pipeline/pipeline-board";
import { requireOwnerContext } from "@/server/auth/owner-context";
import { getLeads } from "@/server/services/leads";

export default async function PipelinePage() {
  const context = await requireOwnerContext();
  const leads = await getLeads(context.organizationId);
  return (
    <>
      <PageHeading
        eyebrow="Sales movement"
        title="Pipeline with a pulse"
        description="Drag leads between stages or use each card’s stage menu for a keyboard-accessible move."
      />
      <PipelineBoard initialLeads={leads} />
    </>
  );
}
