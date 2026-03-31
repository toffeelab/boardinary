import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from "@nestjs/common";
import { BlueprintsService } from "../blueprints.service";
import type { CreateBlueprintDto } from "../dto/create-blueprint.dto";
import type { UpdateBlueprintDto } from "../dto/update-blueprint.dto";

// Mock drizzle-orm operators as passthrough helpers
vi.mock("drizzle-orm", () => ({
  eq: (col: unknown, val: unknown) => ({ col, val, op: "eq" }),
  and: (...conditions: unknown[]) => ({ conditions, op: "and" }),
  desc: (col: unknown) => ({ col, op: "desc" }),
}));

// --- db mock setup ---
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();

vi.mock("@repo/db", () => ({
  db: {
    select: (...args: unknown[]) => mockSelect(...args),
    insert: (...args: unknown[]) => mockInsert(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
  },
}));

// Also mock schema to avoid actual DB imports
vi.mock("@repo/db/schema", () => ({
  blueprints: {
    id: "id",
    type: "type",
    scope: "scope",
    createdBy: "created_by",
    orgId: "org_id",
    projectId: "project_id",
    name: "name",
    description: "description",
    content: "content",
    contentVersion: "content_version",
    tags: "tags",
    icon: "icon",
    color: "color",
    createdAt: "created_at",
    updatedAt: "updated_at",
    $inferInsert: {},
  },
  orgMembers: {
    orgId: "org_id",
    userId: "user_id",
    role: "role",
    joinedAt: "joined_at",
  },
}));

// Helper to build a chainable mock for SELECT queries
function createSelectChain(result: unknown) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockResolvedValue(result),
    limit: vi.fn().mockResolvedValue(result),
  };
  return chain;
}

// Helper for INSERT chains (.values().returning())
function createInsertChain(result: unknown) {
  return {
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue(result),
  };
}

// Helper for UPDATE chains (.set().where().returning())
function createUpdateChain(result: unknown) {
  return {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue(result),
  };
}

// Helper for DELETE chains (.where())
function createDeleteChain() {
  return {
    where: vi.fn().mockResolvedValue(undefined),
  };
}

// --- fixtures ---
const userId = "user-1";
const orgId = "org-1";
const blueprintId = "bp-1";

const personalBlueprint = {
  id: blueprintId,
  type: "preset" as const,
  scope: "personal",
  createdBy: userId,
  orgId: null,
  projectId: null,
  name: "My Blueprint",
  description: null,
  content: {},
  contentVersion: 1,
  tags: [],
  icon: null,
  color: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const orgBlueprint = {
  ...personalBlueprint,
  id: "bp-2",
  scope: "organization",
  orgId,
};

const membership = [{ orgId, userId, role: "member", joinedAt: new Date() }];

// ============================================================
describe("BlueprintsService", () => {
  let service: BlueprintsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new BlueprintsService();
  });

  // ----------------------------------------------------------
  describe("getBlueprints", () => {
    it("returns personal blueprints for personal scope", async () => {
      const expected = [personalBlueprint];
      mockSelect.mockReturnValue(createSelectChain(expected));

      const result = await service.getBlueprints(userId, "personal");

      expect(result).toEqual(expected);
      expect(mockSelect).toHaveBeenCalledTimes(1);
    });

    it("returns org blueprints after membership check for org scope", async () => {
      const expected = [orgBlueprint];

      // First call: membership check (returns member)
      // Second call: org blueprints
      mockSelect
        .mockReturnValueOnce(createSelectChain(membership))
        .mockReturnValueOnce(createSelectChain(expected));

      const result = await service.getBlueprints(userId, "organization", orgId);

      expect(result).toEqual(expected);
      expect(mockSelect).toHaveBeenCalledTimes(2);
    });

    it("throws ForbiddenException when user is not org member", async () => {
      // membership check returns empty array
      mockSelect.mockReturnValue(createSelectChain([]));

      await expect(
        service.getBlueprints(userId, "organization", orgId),
      ).rejects.toThrow(ForbiddenException);
    });

    it("returns empty array for unknown scope", async () => {
      const result = await service.getBlueprints(userId, "unknown-scope");

      expect(result).toEqual([]);
      expect(mockSelect).not.toHaveBeenCalled();
    });
  });

  // ----------------------------------------------------------
  describe("getBlueprintById", () => {
    it("returns blueprint when found", async () => {
      mockSelect.mockReturnValue(createSelectChain([personalBlueprint]));

      const result = await service.getBlueprintById(blueprintId);

      expect(result).toEqual(personalBlueprint);
    });

    it("throws NotFoundException when not found", async () => {
      mockSelect.mockReturnValue(createSelectChain([]));

      await expect(service.getBlueprintById(blueprintId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("calls ensureBlueprintAccess when userId is provided", async () => {
      mockSelect.mockReturnValue(createSelectChain([personalBlueprint]));

      const spy = vi
        .spyOn(service, "ensureBlueprintAccess")
        .mockResolvedValue(undefined);

      await service.getBlueprintById(blueprintId, userId);

      expect(spy).toHaveBeenCalledWith(personalBlueprint, userId);
    });

    it("does not call ensureBlueprintAccess when userId is not provided", async () => {
      mockSelect.mockReturnValue(createSelectChain([personalBlueprint]));

      const spy = vi.spyOn(service, "ensureBlueprintAccess");

      await service.getBlueprintById(blueprintId);

      expect(spy).not.toHaveBeenCalled();
    });

    it("throws ForbiddenException for unauthorized access to personal blueprint", async () => {
      mockSelect.mockReturnValue(createSelectChain([personalBlueprint]));

      const otherUserId = "other-user";
      await expect(
        service.getBlueprintById(blueprintId, otherUserId),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ----------------------------------------------------------
  describe("ensureBlueprintAccess", () => {
    it("allows owner access to personal blueprint", async () => {
      await expect(
        service.ensureBlueprintAccess(personalBlueprint, userId),
      ).resolves.toBeUndefined();
    });

    it("throws ForbiddenException for non-owner on personal blueprint", async () => {
      await expect(
        service.ensureBlueprintAccess(personalBlueprint, "other-user"),
      ).rejects.toThrow(ForbiddenException);
    });

    it("allows org member access to org blueprint", async () => {
      mockSelect.mockReturnValue(createSelectChain(membership));

      await expect(
        service.ensureBlueprintAccess(orgBlueprint, userId),
      ).resolves.toBeUndefined();
    });

    it("throws ForbiddenException for non-member on org blueprint", async () => {
      mockSelect.mockReturnValue(createSelectChain([]));

      await expect(
        service.ensureBlueprintAccess(orgBlueprint, "non-member"),
      ).rejects.toThrow(ForbiddenException);
    });

    it("throws ForbiddenException for org blueprint without orgId", async () => {
      const blueprintWithoutOrg = { ...orgBlueprint, orgId: null };

      await expect(
        service.ensureBlueprintAccess(blueprintWithoutOrg, userId),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ----------------------------------------------------------
  describe("createBlueprint", () => {
    const personalDto: CreateBlueprintDto = {
      type: "preset",
      scope: "personal",
      name: "Test Blueprint",
      content: { nodes: [] },
    };

    const orgDto: CreateBlueprintDto = {
      type: "flow",
      scope: "organization",
      orgId,
      name: "Org Blueprint",
      content: { nodes: [] },
    };

    it("creates personal blueprint successfully", async () => {
      mockInsert.mockReturnValue(createInsertChain([personalBlueprint]));

      const result = await service.createBlueprint(userId, personalDto);

      expect(result).toEqual(personalBlueprint);
      expect(mockInsert).toHaveBeenCalledTimes(1);
    });

    it("creates org blueprint with membership check", async () => {
      // First: membership check, Second: insert
      mockSelect.mockReturnValue(createSelectChain(membership));
      mockInsert.mockReturnValue(createInsertChain([orgBlueprint]));

      const result = await service.createBlueprint(userId, orgDto);

      expect(result).toEqual(orgBlueprint);
      expect(mockSelect).toHaveBeenCalledTimes(1);
      expect(mockInsert).toHaveBeenCalledTimes(1);
    });

    it("throws BadRequestException when org scope but no orgId", async () => {
      const badDto: CreateBlueprintDto = {
        ...orgDto,
        orgId: undefined,
      };

      await expect(service.createBlueprint(userId, badDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it("throws ForbiddenException when not org member", async () => {
      mockSelect.mockReturnValue(createSelectChain([]));

      await expect(service.createBlueprint(userId, orgDto)).rejects.toThrow(
        ForbiddenException,
      );

      expect(mockInsert).not.toHaveBeenCalled();
    });
  });

  // ----------------------------------------------------------
  describe("updateBlueprint", () => {
    const updateDto: UpdateBlueprintDto = {
      name: "Updated Name",
    };

    it("updates blueprint with valid data", async () => {
      const updated = { ...personalBlueprint, name: "Updated Name" };

      // getBlueprintById -> select
      mockSelect.mockReturnValue(createSelectChain([personalBlueprint]));
      // db.update
      mockUpdate.mockReturnValue(createUpdateChain([updated]));

      const result = await service.updateBlueprint(
        blueprintId,
        userId,
        updateDto,
      );

      expect(result).toEqual(updated);
      expect(mockUpdate).toHaveBeenCalledTimes(1);
    });

    it("returns existing blueprint when no fields to update", async () => {
      mockSelect.mockReturnValue(createSelectChain([personalBlueprint]));

      const emptyDto: UpdateBlueprintDto = {};
      const result = await service.updateBlueprint(
        blueprintId,
        userId,
        emptyDto,
      );

      expect(result).toEqual(personalBlueprint);
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it("throws ForbiddenException for unauthorized update", async () => {
      mockSelect.mockReturnValue(createSelectChain([personalBlueprint]));

      await expect(
        service.updateBlueprint(blueprintId, "other-user", updateDto),
      ).rejects.toThrow(ForbiddenException);

      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it("throws NotFoundException when blueprint does not exist", async () => {
      mockSelect.mockReturnValue(createSelectChain([]));

      await expect(
        service.updateBlueprint(blueprintId, userId, updateDto),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ----------------------------------------------------------
  describe("deleteBlueprint", () => {
    it("deletes blueprint successfully", async () => {
      mockSelect.mockReturnValue(createSelectChain([personalBlueprint]));
      mockDelete.mockReturnValue(createDeleteChain());

      const result = await service.deleteBlueprint(blueprintId, userId);

      expect(result).toEqual({ success: true });
      expect(mockDelete).toHaveBeenCalledTimes(1);
    });

    it("throws ForbiddenException for unauthorized delete", async () => {
      mockSelect.mockReturnValue(createSelectChain([personalBlueprint]));

      await expect(
        service.deleteBlueprint(blueprintId, "other-user"),
      ).rejects.toThrow(ForbiddenException);

      expect(mockDelete).not.toHaveBeenCalled();
    });

    it("throws NotFoundException when blueprint does not exist", async () => {
      mockSelect.mockReturnValue(createSelectChain([]));

      await expect(
        service.deleteBlueprint(blueprintId, userId),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
