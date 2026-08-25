"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { LoaderCircle, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";

const fields = [
  { name: "category", label: "Category", placeholder: "Dental clinic" },
  { name: "websiteUrl", label: "Website", placeholder: "example.com" },
  {
    name: "businessPhone",
    label: "Business phone",
    placeholder: "+1 555 0100",
  },
  { name: "contactName", label: "Contact name", placeholder: "Optional" },
  {
    name: "contactEmail",
    label: "Contact email",
    placeholder: "name@example.com",
    type: "email",
  },
  { name: "contactPhone", label: "Contact phone", placeholder: "Optional" },
] as const;

export function CreateLeadDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  async function submit(formData: FormData) {
    setSaving(true);
    try {
      const payload = Object.fromEntries(
        [...formData.entries()].map(([key, value]) => [
          key,
          String(value).trim(),
        ]),
      );
      const response = await fetch("/api/leads/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as {
        error?: string;
        status?: "created" | "updated" | "unchanged";
        leadId?: string;
      };
      if (!response.ok || !result.leadId) {
        throw new Error(result.error ?? "Could not create the lead");
      }
      toast.success(
        result.status === "created"
          ? "Lead created"
          : result.status === "updated"
            ? "Existing lead enriched"
            : "Existing lead found",
      );
      setOpen(false);
      router.push(`/leads/${result.leadId}`);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not create the lead",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button>
          <Plus className="size-4" />
          Create lead
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm data-[state=closed]:animate-out data-[state=open]:animate-in" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[90dvh] w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-border-strong bg-[#111014] p-5 shadow-2xl outline-none sm:p-7">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="font-display text-2xl font-bold tracking-tighter">
                Create a lead
              </Dialog.Title>
              <Dialog.Description className="mt-1 max-w-lg text-sm leading-6 text-muted">
                Start with a business name. Add whatever context you already
                have—SiteScout will leave the rest untouched until analysis.
              </Dialog.Description>
            </div>
            <Dialog.Close
              className="grid size-10 shrink-0 place-items-center rounded-xl text-muted transition hover:bg-surface-strong hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
              aria-label="Close dialog"
            >
              <X className="size-4" />
            </Dialog.Close>
          </div>

          <form action={submit} className="space-y-5">
            <label className="block text-sm font-semibold text-foreground">
              Business name <span className="text-violet-300">*</span>
              <Input
                name="businessName"
                className="mt-2"
                placeholder="Acme Studio"
                required
                autoFocus
                maxLength={240}
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              {fields.map((field) => (
                <label
                  key={field.name}
                  className="block text-sm font-medium text-muted-strong"
                >
                  {field.label}
                  <Input
                    name={field.name}
                    type={"type" in field ? field.type : "text"}
                    className="mt-2"
                    placeholder={field.placeholder}
                  />
                </label>
              ))}
            </div>
            <label className="block text-sm font-medium text-muted-strong">
              Address
              <Input
                name="formattedAddress"
                className="mt-2"
                placeholder="Street, city, region, country"
              />
            </label>
            <label className="block text-sm font-medium text-muted-strong">
              Google Maps URL
              <Input
                name="googleMapsUrl"
                className="mt-2"
                placeholder="https://maps.google.com/..."
              />
            </label>
            <label className="block text-sm font-medium text-muted-strong">
              Note
              <Textarea
                name="note"
                className="mt-2 min-h-24"
                placeholder="Why this business is worth following up with..."
              />
            </label>
            <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-end">
              <Dialog.Close asChild>
                <Button type="button" variant="ghost" disabled={saving}>
                  Cancel
                </Button>
              </Dialog.Close>
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <Plus className="size-4" />
                )}
                {saving ? "Creating..." : "Create lead"}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
