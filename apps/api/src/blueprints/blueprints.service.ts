import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { db } from "@repo/db";
import { blueprints } from "@repo/db/schema";
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

  async getBlueprintById(id: string) {
    const rows = await db
      .select()
      .from(blueprints)
      .where(eq(blueprints.id, id))
      .limit(1);

    if (rows.length === 0) {
      throw new NotFoundException("Blueprint not found");
    }

    return rows[0];
  }

  async createBlueprint(userId: string, dto: CreateBlueprintDto) {
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

    // existing is guaranteed non-undefined: getBlueprintById throws NotFoundException if missing
    if (existing!.scope === "personal" && existing!.createdBy !== userId) {
      throw new ForbiddenException("Cannot edit another user's blueprint");
    }

    const updateData: Record<string, unknown> = {};
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

    // existing is guaranteed non-undefined: getBlueprintById throws NotFoundException if missing
    if (existing!.scope === "personal" && existing!.createdBy !== userId) {
      throw new ForbiddenException("Cannot delete another user's blueprint");
    }

    await db.delete(blueprints).where(eq(blueprints.id, id));
    return { success: true };
  }
}
