import { FileUp, Radar } from "lucide-react";
import Link from "next/link";

import { PageHeading } from "@/components/page-heading";
import { Button } from "@/components/ui/button";
import { LeadsTable } from "@/features/leads/leads-table";
import { CreateLeadDialog } from "@/features/leads/create-lead-dialog";
import { requireOwnerContext } from "@/server/auth/owner-context";
import { getLeads } from "@/server/services/leads";

export default async function LeadsPage() {
  const context = await requireOwnerContext();
  const rows = await getLeads(context.organizationId);
  return (
    <>
      <PageHeading
        eyebrow="Opportunity index"
        title="Leads worth your attention"
        description="Prioritize evidence-rich opportunities, analyze selected leads sequentially, and keep every sales thread moving."
        action={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="ghost">
              <Link href="/discover">
                <Radar className="size-4" />
                Add from discovery
              </Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/leads/import">
                <FileUp className="size-4" />
                Import CSV
              </Link>
            </Button>
            <CreateLeadDialog />
          </div>
        }
      />
      <LeadsTable leads={rows} />
    </>
  );
}
