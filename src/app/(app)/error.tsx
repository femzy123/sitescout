"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function AppError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="panel mx-auto mt-16 max-w-lg p-8 text-center">
      <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-red-500/10 text-red-500">
        <AlertTriangle className="size-5" />
      </div>
      <h1 className="mt-4 font-display text-2xl font-bold">
        The signal dropped
      </h1>
      <p className="mt-2 text-sm leading-6 text-muted">
        SiteScout could not load this workspace view. Check the provider
        configuration or try the request again.
      </p>
      <Button className="mt-5" onClick={reset}>
        <RotateCcw className="size-4" /> Retry
      </Button>
    </div>
  );
}
