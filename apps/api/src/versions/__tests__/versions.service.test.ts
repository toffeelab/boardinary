import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Test } from "@nestjs/testing";
import { VersionsService } from "../versions.service";
import {
  db,
  storyboardVersions,
  storyboards,
  users,
  organizations,
  orgMembers,
  projects,
} from "@repo/db";
import { eq, and } from "drizzle-orm";

async function createTestUser() {
  const [user] = await db
    .insert(users)
    .values({
      id: `test-user-${Date.now()}`,
      name: "Test User",
      email: `test-${Date.now()}@example.com`,
    })
    .returning();
  return user!;
}

async function createTestStoryboard(userId: string) {
  const [org] = await db
    .insert(organizations)
    .values({
      name: "Test Org",
      slug: `test-org-${Date.now()}`,
      ownerId: userId,
    })
    .returning();

  await db.insert(orgMembers).values({
    orgId: org!.id,
    userId,
    role: "owner",
  });

  const [project] = await db
    .insert(projects)
    .values({
      orgId: org!.id,
      createdBy: userId,
      name: "Test Project",
      slug: `test-project-${Date.now()}`,
    })
    .returning();

  const [storyboard] = await db
    .insert(storyboards)
    .values({
      projectId: project!.id,
      createdBy: userId,
      name: "Test Storyboard",
      content: {
        version: 1,
        viewport: { x: 0, y: 0, zoom: 1 },
        nodes: [],
        edges: [],
      },
      contentVersion: 10,
    })
    .returning();

  return { storyboard: storyboard!, orgId: org!.id };
}

describe("VersionsService", () => {
  let service: VersionsService;
  let userId: string;
  let storyboardId: string;
  let orgId: string;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [VersionsService],
    }).compile();
    service = module.get(VersionsService);

    const user = await createTestUser();
    userId = user.id;
    const { storyboard, orgId: createdOrgId } =
      await createTestStoryboard(userId);
    storyboardId = storyboard.id;
    orgId = createdOrgId;
  });

  afterEach(async () => {
    // storyboard cascade deletes storyboard_versions
    await db.delete(storyboards).where(eq(storyboards.id, storyboardId));
    // org cascade deletes projects, org_members; must delete before user due to FK
    await db.delete(organizations).where(eq(organizations.id, orgId));
    await db.delete(users).where(eq(users.id, userId));
  });

  describe("createSnapshot", () => {
    it("자동 스냅샷을 생성한다 (label null)", async () => {
      const content = {
        version: 1,
        viewport: { x: 0, y: 0, zoom: 1 },
        nodes: [],
        edges: [],
      };
      const version = await service.createSnapshot(
        storyboardId,
        content,
        10,
        null,
        userId,
      );
      expect(version.label).toBeNull();
      expect(version.contentVersion).toBe(10);
    });

    it("수동 체크포인트를 생성한다 (label 있음)", async () => {
      const content = {
        version: 1,
        viewport: { x: 0, y: 0, zoom: 1 },
        nodes: [],
        edges: [],
      };
      const version = await service.createSnapshot(
        storyboardId,
        content,
        10,
        "v1.0 퀘스트 완성",
        userId,
      );
      expect(version.label).toBe("v1.0 퀘스트 완성");
    });

    it("동일 contentVersion 중복 저장 시 에러 없이 기존 버전 반환한다", async () => {
      const content = {
        version: 1,
        viewport: { x: 0, y: 0, zoom: 1 },
        nodes: [],
        edges: [],
      };
      await service.createSnapshot(storyboardId, content, 10, null, userId);
      const result = await service.createSnapshot(
        storyboardId,
        content,
        10,
        null,
        userId,
      );
      expect(result).toBeDefined();
    });
  });

  describe("pruneAutoVersions", () => {
    it("자동 버전이 50개 초과 시 가장 오래된 자동 버전 삭제", async () => {
      const content = {
        version: 1,
        viewport: { x: 0, y: 0, zoom: 1 },
        nodes: [],
        edges: [],
      };
      for (let i = 1; i <= 51; i++) {
        await db.insert(storyboardVersions).values({
          storyboardId,
          createdBy: userId,
          label: null,
          content,
          contentVersion: i,
          createdAt: new Date(Date.now() + i * 1000),
        });
      }
      await service.pruneAutoVersions(storyboardId);
      const remaining = await db
        .select()
        .from(storyboardVersions)
        .where(and(eq(storyboardVersions.storyboardId, storyboardId)));
      expect(remaining.length).toBe(50);
    });

    it("수동 체크포인트는 삭제하지 않는다", async () => {
      const content = {
        version: 1,
        viewport: { x: 0, y: 0, zoom: 1 },
        nodes: [],
        edges: [],
      };
      for (let i = 1; i <= 50; i++) {
        await db.insert(storyboardVersions).values({
          storyboardId,
          createdBy: userId,
          label: null,
          content,
          contentVersion: i,
        });
      }
      await db.insert(storyboardVersions).values({
        storyboardId,
        createdBy: userId,
        label: "중요 체크포인트",
        content,
        contentVersion: 51,
      });
      await service.pruneAutoVersions(storyboardId);
      const manualVersions = await db
        .select()
        .from(storyboardVersions)
        .where(and(eq(storyboardVersions.storyboardId, storyboardId)));
      const manual = manualVersions.find((v) => v.label === "중요 체크포인트");
      expect(manual).toBeDefined();
    });
  });

  describe("listVersions", () => {
    it("content 제외하고 목록 반환", async () => {
      const content = {
        version: 1,
        viewport: { x: 0, y: 0, zoom: 1 },
        nodes: [{ id: "n1" }],
        edges: [],
      };
      await service.createSnapshot(storyboardId, content, 10, null, userId);
      const versions = await service.listVersions(storyboardId);
      expect(versions.length).toBe(1);
      expect(
        (versions[0] as Record<string, unknown>)["content"],
      ).toBeUndefined();
    });
  });

  describe("getVersionById", () => {
    it("content 포함한 단건 반환", async () => {
      const content = {
        version: 1,
        viewport: { x: 0, y: 0, zoom: 1 },
        nodes: [],
        edges: [],
      };
      const created = await service.createSnapshot(
        storyboardId,
        content,
        10,
        null,
        userId,
      );
      const found = await service.getVersionById(created.id);
      expect(found.content).toEqual(content);
    });
  });
});
