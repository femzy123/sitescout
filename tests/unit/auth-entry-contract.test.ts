import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("auth-aware public entry", () => {
  it("resolves the landing session on the server and renders a dashboard action", () => {
    const page = source("src/app/page.tsx");

    expect(page).toContain('import { auth } from "@clerk/nextjs/server"');
    expect(page).toContain("const { userId } = await auth()");
    expect(page).toContain('href="/dashboard"');
    expect(page).toContain("Dashboard");
  });

  it.each([
    "src/app/sign-in/[[...sign-in]]/page.tsx",
    "src/app/sign-up/[[...sign-up]]/page.tsx",
  ])("redirects authenticated auth-route visits in %s", (path) => {
    const page = source(path);

    expect(page).toContain('import { auth } from "@clerk/nextjs/server"');
    expect(page).toContain('import { redirect } from "next/navigation"');
    expect(page).toContain('if (userId) redirect("/dashboard")');
  });

  it("keeps settings manual by removing its app-shell entry", () => {
    const shell = source("src/components/app-shell.tsx");

    expect(shell).not.toContain("Settings2");
    expect(shell).not.toContain('href="/settings"');
  });
});
