import { clerkMiddleware } from "@clerk/nextjs/server";

// Clerk attaches request auth here. Each page, Route Handler, and Server Action
// protects itself through requireOwnerContext(), following Clerk's resource-based
// authorization model.
export default clerkMiddleware();

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
