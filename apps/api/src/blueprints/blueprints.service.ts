import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from "@nestjs/common";
import { db } from "@repo/db";
import { blueprints, orgMembers } from "@repo/db/schema";
import { eq, and } from "drizzle-orm";
import { CreateBlueprintDto } from "./dto/create-blueprint.dto";
import { UpdateBlueprintDto } from "./dto/update-blueprint.dto";

@Injectable()
export class BlueprintsService {
  async getBlueprints(userId: string, scope: string, orgId?: string) {
    if (scope === "personal") {
      return db
        .select({
          id: blueprints.id,
          type: blueprints.type,
          scope: blueprints.scope,
          createdBy: blueprints.createdBy,
          orgId: blueprints.orgId,
          projectId: blueprints.projectId,
          name: blueprints.name,
          description: blueprints.description,
          contentVersion: blueprints.contentVersion,
          tags: blueprints.tags,
          icon: blueprints.icon,
          color: blueprints.color,
          createdAt: blueprints.createdAt,
          updatedAt: blueprints.updatedAt,
        })
        .from(blueprints)
        .where(
          and(
            eq(blueprints.createdBy, userId),
            eq(blueprints.scope, "personal"),
          ),
        )
        .orderBy(blueprints.updatedAt);
    }

    if (scope === "organization" && orgId) {
      const membership = await db
        .select()
        .from(orgMembers)
        .where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, userId)))
        .limit(1);

      if (membership.length === 0) {
        throw new ForbiddenException("Not a member of this organization");
      }

      return db
        .select({
          id: blueprints.id,
          type: blueprints.type,
          scope: blueprints.scope,
          createdBy: blueprints.createdBy,
          orgId: blueprints.orgId,
          projectId: blueprints.projectId,
          name: blueprints.name,
          description: blueprints.description,
          contentVersion: blueprints.contentVersion,
          tags: blueprints.tags,
          icon: blueprints.icon,
          color: blueprints.color,
          createdAt: blueprints.createdAt,
          updatedAt: blueprints.updatedAt,
        })
        .from(blueprints)
        .where(
          and(
            eq(blueprints.orgId, orgId),
            eq(blueprints.scope, "organization"),
          ),
        )
        .orderBy(blueprints.updatedAt);
    }

    return [];
  }

  async getBlueprintById(id: string, userId?: string) {
    const rows = await db
      .select()
      .from(blueprints)
      .where(eq(blueprints.id, id))
      .limit(1);

    if (rows.length === 0) {
      throw new NotFoundException("Blueprint not found");
    }

    const blueprint = rows[0]!;

    if (userId !== undefined) {
      await this.ensureBlueprintAccess(blueprint, userId);
    }

    return blueprint;
  }

  async ensureBlueprintAccess(
    blueprint: {
      id: string;
      scope: string;
      createdBy: string;
      orgId: string | null;
    },
    userId: string,
  ) {
    if (blueprint.scope === "personal") {
      if (blueprint.createdBy !== userId) {
        throw new ForbiddenException("Not authorized");
      }
      return;
    }

    if (blueprint.scope === "organization") {
      if (!blueprint.orgId) {
        throw new ForbiddenException("Not authorized");
      }
      const [member] = await db
        .select()
        .from(orgMembers)
        .where(
          and(
            eq(orgMembers.orgId, blueprint.orgId),
            eq(orgMembers.userId, userId),
          ),
        )
        .limit(1);
      if (!member) {
        throw new ForbiddenException("Not authorized");
      }
    }
  }

  async createBlueprint(userId: string, dto: CreateBlueprintDto) {
    if (dto.scope === "organization" && !dto.orgId) {
      throw new BadRequestException(
        "orgId is required for organization-scoped blueprints",
      );
    }

    if (dto.scope === "organization" && dto.orgId) {
      const membership = await db
        .select()
        .from(orgMembers)
        .where(
          and(eq(orgMembers.orgId, dto.orgId), eq(orgMembers.userId, userId)),
        )
        .limit(1);

      if (membership.length === 0) {
        throw new ForbiddenException("Not a member of this organization");
      }
    }

    const rows = await db
      .insert(blueprints)
      .values({
        type: dto.type,
        scope: dto.scope,
        createdBy: userId,
        orgId: dto.scope === "organization" ? (dto.orgId ?? null) : null,
        projectId: null,
        name: dto.name,
        description: dto.description ?? null,
        content: dto.content,
        tags: dto.tags ?? [],
        icon: dto.icon ?? null,
        color: dto.color ?? null,
      })
      .returning();

    return rows[0];
  }

  async updateBlueprint(id: string, userId: string, dto: UpdateBlueprintDto) {
    const existing = await this.getBlueprintById(id);

    await this.ensureBlueprintAccess(existing!, userId);

    const updateData: Partial<typeof blueprints.$inferInsert> = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.content !== undefined) updateData.content = dto.content;
    if (dto.tags !== undefined) updateData.tags = dto.tags;
    if (dto.icon !== undefined) updateData.icon = dto.icon;
    if (dto.color !== undefined) updateData.color = dto.color;

    if (Object.keys(updateData).length === 0) return existing;

    const rows = await db
      .update(blueprints)
      .set(updateData)
      .where(eq(blueprints.id, id))
      .returning();

    return rows[0];
  }

  async deleteBlueprint(id: string, userId: string) {
    const existing = await this.getBlueprintById(id);

    await this.ensureBlueprintAccess(existing!, userId);

    await db.delete(blueprints).where(eq(blueprints.id, id));
    return { success: true };
  }
}
