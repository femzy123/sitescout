import { AppShell } from "@/components/app-shell";
import { requireOwnerContext } from "@/server/auth/owner-context";

export const dynamic = "force-dynamic";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const context = await requireOwnerContext();
  return (
    <AppShell organizationName={context.organizationName}>{children}</AppShell>
  );
}
