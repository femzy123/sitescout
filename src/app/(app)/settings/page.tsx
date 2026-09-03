import { AlertTriangle, CheckCircle2, CircleDashed } from "lucide-react";

import { PageHeading } from "@/components/page-heading";
import { Badge } from "@/components/ui/badge";
import {
  getEnvironmentDiagnostics,
  type EnvironmentDiagnosticStatus,
} from "@/lib/env";
import { requireOwnerContext } from "@/server/auth/owner-context";

function statusTone(status: EnvironmentDiagnosticStatus) {
  if (status === "Configured") return "success" as const;
  if (status === "Using default") return "info" as const;
  if (status === "Unexpected in production") return "warning" as const;
  return "danger" as const;
}

function StatusIcon({ status }: { status: EnvironmentDiagnosticStatus }) {
  if (status === "Configured") return <CheckCircle2 className="size-3" />;
  if (status === "Using default") return <CircleDashed className="size-3" />;
  return <AlertTriangle className="size-3" />;
}

export default async function SettingsPage() {
  await requireOwnerContext();
  const diagnosticGroups = getEnvironmentDiagnostics();
  const needsAttention = diagnosticGroups
    .flatMap((group) => group.items)
    .some(
      (item) => item.status !== "Configured" && item.status !== "Using default",
    );

  return (
    <>
      <PageHeading
        eyebrow="Workspace configuration"
        title="Environment diagnostics"
        description="Production readiness checks without exposing configured values or secrets."
      />

      <div className="mb-4 flex items-center gap-2 text-sm text-muted">
        {needsAttention ? (
          <AlertTriangle className="size-4 text-amber-400" />
        ) : (
          <CheckCircle2 className="size-4 text-emerald-400" />
        )}
        <span>
          {needsAttention
            ? "One or more production settings need attention."
            : "Required settings are present and valid."}
        </span>
      </div>

      <div className="panel overflow-hidden">
        {diagnosticGroups.map((group, groupIndex) => (
          <section
            key={group.label}
            aria-labelledby={`environment-${groupIndex}`}
            className={groupIndex === 0 ? undefined : "border-t border-border"}
          >
            <div className="border-b border-border bg-surface-strong/45 px-5 py-3">
              <h2
                id={`environment-${groupIndex}`}
                className="text-xs font-bold uppercase tracking-widest text-muted"
              >
                {group.label}
              </h2>
            </div>
            <div className="divide-y divide-border">
              {group.items.map((item) => (
                <div
                  key={item.key}
                  className="flex min-h-18 flex-col justify-center gap-3 px-5 py-4 sm:flex-row sm:items-center"
                >
                  <div className="min-w-0 flex-1">
                    <code className="text-sm font-semibold text-foreground">
                      {item.key}
                    </code>
                    <p className="mt-1 max-w-2xl text-xs leading-5 text-muted">
                      {item.description}
                    </p>
                  </div>
                  <Badge
                    tone={statusTone(item.status)}
                    className="w-fit shrink-0 whitespace-nowrap"
                  >
                    <StatusIcon status={item.status} />
                    {item.status}
                  </Badge>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="mt-4 max-w-3xl space-y-2 text-sm leading-6 text-muted">
        <p>
          Set <code className="text-muted-strong">AUDIT_DEBUG=true</code> in the
          production environment and redeploy to stream redacted audit
          diagnostics to the browser console.
        </p>
        <p>
          The checks above validate presence and format only. They do not make
          live provider, database, or Chromium-download requests.
        </p>
      </div>
    </>
  );
}
