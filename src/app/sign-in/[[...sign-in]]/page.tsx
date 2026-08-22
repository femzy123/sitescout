import { SignIn } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Logo } from "@/components/brand/logo";

export default async function SignInPage() {
  const { userId } = await auth();
  if (userId) redirect("/dashboard");

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-background p-5">
      <div className="absolute inset-x-0 top-0 h-64 bg-[radial-gradient(circle_at_top,rgba(139,92,246,.14),transparent_65%)]" />
      <div className="absolute left-5 top-5 sm:left-8 sm:top-7">
        <Link href="/" aria-label="SiteScout home">
          <Logo />
        </Link>
      </div>
      <div className="relative">
        <div className="absolute -inset-12 -z-10 rounded-full bg-violet-500/10 blur-3xl" />
        <SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" />
      </div>
    </main>
  );
}
