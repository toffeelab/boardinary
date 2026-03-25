import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { organizations, orgMembers } from "@/db/schema";

export async function getOrganizationsByUserId(userId: string) {
  return db
    .select({
      id: organizations.id,
      name: organizations.name,
      slug: organizations.slug,
      description: organizations.description,
      ownerId: organizations.ownerId,
      isPersonal: organizations.isPersonal,
      role: orgMembers.role,
      createdAt: organizations.createdAt,
      updatedAt: organizations.updatedAt,
    })
    .from(orgMembers)
    .innerJoin(organizations, eq(orgMembers.orgId, organizations.id))
    .where(eq(orgMembers.userId, userId));
}

export async function getOrganizationBySlug(slug: string) {
  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, slug))
    .limit(1);
  return org ?? null;
}

export async function getPersonalOrganization(userId: string) {
  const [org] = await db
    .select()
    .from(organizations)
    .where(
      and(
        eq(organizations.ownerId, userId),
        eq(organizations.isPersonal, true),
      ),
    )
    .limit(1);
  return org ?? null;
}

export async function isOrgMember(orgId: string, userId: string) {
  const [member] = await db
    .select()
    .from(orgMembers)
    .where(
      and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, userId)),
    )
    .limit(1);
  return !!member;
}
