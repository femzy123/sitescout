"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { LoaderCircle, Trash2, X } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

export function ConfirmDeleteDialog({
  title,
  description,
  confirmLabel,
  trigger,
  onConfirm,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  trigger: ReactNode;
  onConfirm: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function confirm() {
    setDeleting(true);
    try {
      await onConfirm();
      setOpen(false);
    } catch {
      // The calling action owns user-facing error feedback. Keep the dialog open.
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm data-[state=closed]:animate-out data-[state=open]:animate-in" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border-strong bg-surface p-5 shadow-2xl outline-none sm:p-6">
          <div className="flex items-start gap-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-red-500/10 text-red-400">
              <Trash2 className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <Dialog.Title className="font-display text-xl font-bold tracking-tight">
                {title}
              </Dialog.Title>
              <Dialog.Description className="mt-2 text-sm leading-6 text-muted">
                {description}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button
                variant="ghost"
                size="icon"
                className="-mr-2 -mt-2 shrink-0"
                aria-label="Close confirmation"
                disabled={deleting}
              >
                <X className="size-4" />
              </Button>
            </Dialog.Close>
          </div>
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Dialog.Close asChild>
              <Button variant="secondary" disabled={deleting}>
                Cancel
              </Button>
            </Dialog.Close>
            <Button
              variant="danger"
              disabled={deleting}
              onClick={() => void confirm()}
            >
              {deleting ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
              {deleting ? "Deleting…" : confirmLabel}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
