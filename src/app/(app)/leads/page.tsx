import { Plus } from "lucide-react";
import Link from "next/link";

import { PageHeading } from "@/components/page-heading";
import { Button } from "@/components/ui/button";
import { LeadsTable } from "@/features/leads/leads-table";
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
          <Button asChild variant="secondary">
            <Link href="/discover">
              <Plus className="size-4" />
              Add from discovery
            </Link>
          </Button>
        }
      />
      <LeadsTable leads={rows} />
    </>
  );
}
