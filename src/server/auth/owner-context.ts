import { auth, currentUser } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";

import { getDb, type Database } from "@/server/db";
import { organizationMembers, organizations, users } from "@/server/db/schema";
import { workspaceName, workspaceSlug } from "./workspace-identity";

export type OwnerContext = {
  clerkUserId: string;
  userId: string;
  organizationId: string;
  organizationName: string;
  timezone: string;
};

async function findOwnerContext(
  db: Database,
  clerkUserId: string,
): Promise<OwnerContext | undefined> {
  const [context] = await db
    .select({
      userId: users.id,
      organizationId: organizations.id,
      organizationName: organizations.name,
      timezone: organizations.timezone,
    })
    .from(users)
    .innerJoin(organizationMembers, eq(organizationMembers.userId, users.id))
    .innerJoin(
      organizations,
      eq(organizations.id, organizationMembers.organizationId),
    )
    .where(
      and(
        eq(users.clerkUserId, clerkUserId),
        eq(organizationMembers.role, "owner"),
      ),
    )
    .limit(1);

  return context ? { clerkUserId, ...context } : undefined;
}

export async function requireOwnerContext(): Promise<OwnerContext> {
  const { userId: clerkUserId } = await auth.protect();
  const db = getDb();
  const existing = await findOwnerContext(db, clerkUserId);
  if (existing) return existing;

  const clerkUser = await currentUser();
  if (!clerkUser) {
    throw new Error("The authenticated Clerk user could not be loaded");
  }

  const email =
    clerkUser.primaryEmailAddress?.emailAddress ??
    clerkUser.emailAddresses[0]?.emailAddress;
  if (!email) {
    throw new Error("A verified Clerk email address is required");
  }

  const displayName =
    [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") ||
    email.split("@")[0];

  const [localUser] = await db
    .insert(users)
    .values({
      clerkUserId,
      email,
      displayName,
      avatarUrl: clerkUser.imageUrl,
    })
    .onConflictDoUpdate({
      target: users.clerkUserId,
      set: {
        email,
        displayName,
        avatarUrl: clerkUser.imageUrl,
        updatedAt: new Date(),
      },
    })
    .returning({ id: users.id });

  const slug = workspaceSlug(localUser.id);
  await db
    .insert(organizations)
    .values({
      name: workspaceName(displayName, email),
      slug,
      timezone: "UTC",
    })
    .onConflictDoNothing({ target: organizations.slug });

  const [organization] = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.slug, slug))
    .limit(1);

  if (!organization) {
    throw new Error("Could not provision the SiteScout workspace");
  }

  await db
    .insert(organizationMembers)
    .values({
      organizationId: organization.id,
      userId: localUser.id,
      role: "owner",
    })
    .onConflictDoNothing();

  const provisioned = await findOwnerContext(db, clerkUserId);
  if (!provisioned) {
    throw new Error("Could not provision the workspace owner membership");
  }

  return provisioned;
}
