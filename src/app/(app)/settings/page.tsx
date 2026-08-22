import {
  CheckCircle2,
  CircleDashed,
  Database,
  KeyRound,
  Radar,
  Sparkles,
} from "lucide-react";
import { PageHeading } from "@/components/page-heading";
import { Badge } from "@/components/ui/badge";
import { requireOwnerContext } from "@/server/auth/owner-context";

export default async function SettingsPage() {
  await requireOwnerContext();
  const checks = [
    {
      label: "Neon database",
      icon: Database,
      ready: Boolean(process.env.DATABASE_URL),
    },
    {
      label: "Clerk authentication",
      icon: KeyRound,
      ready: Boolean(
        process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
        process.env.CLERK_SECRET_KEY,
      ),
    },
    {
      label: "Google Places",
      icon: Radar,
      ready: Boolean(process.env.GOOGLE_PLACES_API_KEY),
    },
    {
      label: "Gemini",
      icon: Sparkles,
      ready: Boolean(process.env.GEMINI_API_KEY),
    },
  ];
  return (
    <>
      <PageHeading
        eyebrow="Workspace configuration"
        title="System readiness"
        description="SiteScout checks configuration presence without exposing secret values."
      />
      <div className="panel divide-y divide-border">
        {checks.map((check) => (
          <div
            key={check.label}
            className="flex min-h-16 items-center gap-3 px-5"
          >
            <check.icon className="size-4 text-muted" />
            <span className="flex-1 text-sm font-semibold">{check.label}</span>
            <Badge tone={check.ready ? "success" : "warning"}>
              {check.ready ? (
                <CheckCircle2 className="size-3" />
              ) : (
                <CircleDashed className="size-3" />
              )}
              {check.ready ? "Configured" : "Needs setup"}
            </Badge>
          </div>
        ))}
      </div>
      <p className="mt-4 text-sm text-muted">
        Follow{" "}
        <code className="rounded bg-surface-strong px-1.5 py-1 text-xs">
          SETUP_TASKS.md
        </code>{" "}
        to finish provider and deployment setup.
      </p>
    </>
  );
}
