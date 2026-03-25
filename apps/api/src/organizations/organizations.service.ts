import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { eq, and } from "drizzle-orm";
import { db, organizations, orgMembers } from "@repo/db";

@Injectable()
export class OrganizationsService {
  async getOrganizationsByUserId(userId: string) {
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

  async getOrganizationBySlug(slug: string) {
    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.slug, slug))
      .limit(1);
    return org ?? null;
  }

  async getPersonalOrganization(userId: string) {
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

  async ensureOrgMember(orgSlug: string, userId: string) {
    const org = await this.getOrganizationBySlug(orgSlug);
    if (!org) throw new NotFoundException("Organization not found");

    const [member] = await db
      .select()
      .from(orgMembers)
      .where(and(eq(orgMembers.orgId, org.id), eq(orgMembers.userId, userId)))
      .limit(1);

    if (!member)
      throw new ForbiddenException("Not a member of this organization");
    return org;
  }
}
