import { PageHeading } from "@/components/page-heading";
import { DiscoveryWorkspace } from "@/features/discovery/discovery-workspace";
import { requireOwnerContext } from "@/server/auth/owner-context";
import { getLatestDiscovery } from "@/server/services/places";

export default async function DiscoverPage() {
  const context = await requireOwnerContext();
  const latest = await getLatestDiscovery(context.organizationId);
  return (
    <>
      <PageHeading
        eyebrow="Prospect radar"
        title="Find overlooked businesses"
        description="Search a market, inspect the signals, then explicitly choose who deserves a place in your pipeline."
      />
      <DiscoveryWorkspace initialCandidates={latest?.candidates ?? []} />
    </>
  );
}
