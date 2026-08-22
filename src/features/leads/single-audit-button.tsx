"use client";

import { LoaderCircle, Radar } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

export function SingleAuditButton({ leadId }: { leadId: string }) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  async function run() {
    setRunning(true);
    setProgress(0);
    setMessage("Starting analysis");
    try {
      const response = await fetch("/api/audits/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId }),
      });
      if (!response.ok || !response.body)
        throw new Error(
          (await response.json().catch(() => null))?.error ??
            "Could not start analysis",
        );
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as {
            type: string;
            progress: number;
            message: string;
          };
          setProgress(event.progress);
          setMessage(event.message);
          if (event.type === "error") throw new Error(event.message);
        }
      }
      toast.success("Website analysis complete");
      router.refresh();
    } catch (error) {
      toast.error("Analysis failed", {
        description: error instanceof Error ? error.message : "Try again",
      });
    } finally {
      setRunning(false);
    }
  }
  return (
    <div className="min-w-55">
      {running && (
        <div className="mb-2">
          <div className="flex items-center justify-between text-[10px] font-semibold text-muted">
            <span className="truncate pr-2">{message}</span>
            <span className="tabular">{progress}%</span>
          </div>
          <div className="mt-1 h-1 overflow-hidden rounded-full bg-surface-strong">
            <div
              className="h-full bg-violet-500 transition-[width]"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}
      <Button onClick={() => void run()} disabled={running} className="w-full">
        {running ? (
          <LoaderCircle className="size-4 animate-spin" />
        ) : (
          <Radar className="size-4" />
        )}
        {running ? "Analyzing…" : "Analyze website"}
      </Button>
    </div>
  );
}
