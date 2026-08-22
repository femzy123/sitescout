"use client";

import {
  Clipboard,
  LoaderCircle,
  MessageSquareText,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

const types = [
  { id: "sales_angle", label: "Sales angle" },
  { id: "call_brief", label: "Call brief" },
  { id: "cold_email", label: "Cold email" },
  { id: "dm", label: "DM" },
  { id: "follow_up", label: "Follow-up" },
] as const;

export function AiAssistant({
  leadId,
  initialContent,
}: {
  leadId: string;
  initialContent?: string;
}) {
  const [content, setContent] = useState(initialContent ?? "");
  const [loading, setLoading] = useState<string | null>(null);
  async function generate(type: (typeof types)[number]["id"]) {
    setLoading(type);
    try {
      const response = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId, type }),
      });
      const data = (await response.json()) as {
        content?: string;
        error?: string;
      };
      if (!response.ok || !data.content)
        throw new Error(data.error ?? "Generation failed");
      setContent(data.content);
      toast.success("Draft ready");
    } catch (error) {
      toast.error("Could not generate draft", {
        description: error instanceof Error ? error.message : "Try again",
      });
    } finally {
      setLoading(null);
    }
  }
  return (
    <div className="panel p-5">
      <div className="flex items-center gap-2">
        <Sparkles className="size-4 text-violet-500" />
        <h2 className="font-display text-lg font-bold">Sales copilot</h2>
      </div>
      <p className="mt-1 text-xs text-muted">
        Draft from stored evidence. Nothing is sent automatically.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {types.map((type) => (
          <Button
            key={type.id}
            size="sm"
            variant="secondary"
            disabled={Boolean(loading)}
            onClick={() => void generate(type.id)}
          >
            {loading === type.id ? (
              <LoaderCircle className="size-3.5 animate-spin" />
            ) : (
              <MessageSquareText className="size-3.5" />
            )}
            {type.label}
          </Button>
        ))}
      </div>
      <div className="mt-4 min-h-36 whitespace-pre-wrap rounded-xl border border-border bg-surface-strong/60 p-4 text-sm leading-6 text-muted-strong">
        {content || "Choose a format to generate an evidence-grounded draft."}
      </div>
      {content && (
        <Button
          size="sm"
          variant="ghost"
          className="mt-2"
          onClick={() => {
            void navigator.clipboard.writeText(content);
            toast.success("Copied");
          }}
        >
          <Clipboard className="size-3.5" />
          Copy draft
        </Button>
      )}
    </div>
  );
}
