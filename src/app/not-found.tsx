import { SearchX } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <div className="panel max-w-md p-8 text-center">
        <SearchX className="mx-auto size-10 text-violet-500" />
        <h1 className="mt-4 font-display text-3xl font-bold">
          Signal not found
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted">
          This lead or workspace route does not exist.
        </p>
        <Button className="mt-5" asChild>
          <Link href="/">Return home</Link>
        </Button>
      </div>
    </main>
  );
}
