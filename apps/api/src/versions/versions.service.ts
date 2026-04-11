import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { db, storyboardVersions, storyboards } from "@repo/db";
import { eq, and, isNull, sql, desc, asc, inArray } from "drizzle-orm";
import type { VersionMetadata } from "@repo/types";

const MAX_AUTO_VERSIONS = 50;

@Injectable()
export class VersionsService {
  /** 스냅샷 생성 (자동: label=null, 수동: label=string) */
  async createSnapshot(
    storyboardId: string,
    content: Record<string, unknown>,
    contentVersion: number,
    label: string | null,
    createdBy: string,
    restoredFromId?: string,
  ) {
    const metadata = this.calcMetadata(content);

    try {
      const [version] = await db
        .insert(storyboardVersions)
        .values({
          storyboardId,
          createdBy,
          label,
          content,
          contentVersion,
          restoredFromId: restoredFromId ?? null,
          metadata,
        })
        .onConflictDoNothing()
        .returning();

      if (!version) {
        const [existing] = await db
          .select()
          .from(storyboardVersions)
          .where(
            and(
              eq(storyboardVersions.storyboardId, storyboardId),
              eq(storyboardVersions.contentVersion, contentVersion),
            ),
          )
          .limit(1);
        if (!existing) {
          throw new UnprocessableEntityException(
            "Concurrent version conflict; please retry",
          );
        }
        return existing;
      }

      return version;
    } catch (error: unknown) {
      // unique constraint violation (PostgreSQL error code 23505)만 처리
      const isUniqueViolation =
        error instanceof Error &&
        (error.message.includes("unique") || error.message.includes("23505"));

      if (!isUniqueViolation) throw error;

      const [existing] = await db
        .select()
        .from(storyboardVersions)
        .where(
          and(
            eq(storyboardVersions.storyboardId, storyboardId),
            eq(storyboardVersions.contentVersion, contentVersion),
          ),
        )
        .limit(1);

      if (!existing) throw error;
      return existing;
    }
  }

  /** 자동 버전 50개 초과 시 가장 오래된 자동 버전 삭제 */
  async pruneAutoVersions(storyboardId: string): Promise<void> {
    const autoVersions = await db
      .select({ id: storyboardVersions.id })
      .from(storyboardVersions)
      .where(
        and(
          eq(storyboardVersions.storyboardId, storyboardId),
          isNull(storyboardVersions.label),
        ),
      )
      .orderBy(asc(storyboardVersions.createdAt));

    if (autoVersions.length <= MAX_AUTO_VERSIONS) return;

    const toDelete = autoVersions.slice(
      0,
      autoVersions.length - MAX_AUTO_VERSIONS,
    );
    const idsToDelete = toDelete.map((v) => v.id);
    await db
      .delete(storyboardVersions)
      .where(inArray(storyboardVersions.id, idsToDelete));
  }

  /** 버전 목록 (content 제외) */
  async listVersions(storyboardId: string) {
    return db
      .select({
        id: storyboardVersions.id,
        storyboardId: storyboardVersions.storyboardId,
        createdBy: storyboardVersions.createdBy,
        label: storyboardVersions.label,
        contentVersion: storyboardVersions.contentVersion,
        restoredFromId: storyboardVersions.restoredFromId,
        metadata: storyboardVersions.metadata,
        createdAt: storyboardVersions.createdAt,
      })
      .from(storyboardVersions)
      .where(eq(storyboardVersions.storyboardId, storyboardId))
      .orderBy(desc(storyboardVersions.createdAt));
  }

  /** 단건 조회 (content 포함) */
  async getVersionById(versionId: string) {
    const [version] = await db
      .select()
      .from(storyboardVersions)
      .where(eq(storyboardVersions.id, versionId))
      .limit(1);
    if (!version) throw new NotFoundException("Version not found");
    return version;
  }

  /** 버전 삭제 — 수동(label IS NOT NULL)만 허용 */
  async deleteVersion(versionId: string): Promise<void> {
    const version = await this.getVersionById(versionId);
    if (version.label === null) {
      throw new UnprocessableEntityException(
        "Auto-generated versions cannot be deleted",
      );
    }
    await db
      .delete(storyboardVersions)
      .where(eq(storyboardVersions.id, versionId));
  }

  /** 복원: 선택한 버전 content를 storyboard에 적용하고 새 스냅샷 생성 */
  async restoreVersion(
    storyboardId: string,
    versionId: string,
    restoredBy: string,
  ) {
    const version = await this.getVersionById(versionId);
    if (version.storyboardId !== storyboardId) {
      throw new NotFoundException("Version not found");
    }

    return await db.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtext(${storyboardId}))`,
      );

      const [current] = await tx
        .select({ contentVersion: storyboards.contentVersion })
        .from(storyboards)
        .where(eq(storyboards.id, storyboardId))
        .limit(1);
      if (!current) throw new NotFoundException("Storyboard not found");

      const newVersion = current.contentVersion + 1;

      await tx
        .update(storyboards)
        .set({
          content: version.content as Record<string, unknown>,
          contentVersion: newVersion,
          updatedAt: new Date(),
        })
        .where(eq(storyboards.id, storyboardId));

      const [snapshot] = await tx
        .insert(storyboardVersions)
        .values({
          storyboardId,
          createdBy: restoredBy,
          label: null,
          content: version.content as Record<string, unknown>,
          contentVersion: newVersion,
          restoredFromId: versionId,
          metadata: this.calcMetadata(
            version.content as Record<string, unknown>,
          ),
        })
        .returning();

      if (!snapshot) {
        throw new UnprocessableEntityException(
          "Failed to create restore snapshot",
        );
      }
      return { snapshot, contentVersion: newVersion };
    });
  }

  /** 변경 요약 계산 */
  private calcMetadata(content: Record<string, unknown>): VersionMetadata {
    const nodes = (content["nodes"] as Array<unknown>) ?? [];
    const edges = (content["edges"] as Array<unknown>) ?? [];
    return {
      added: nodes.length,
      removed: 0,
      modified: edges.length,
    };
  }
}
