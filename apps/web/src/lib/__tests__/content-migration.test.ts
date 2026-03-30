import { describe, it, expect } from "vitest";
import { migrateContent } from "@/lib/content-migration";
import type { StoryboardContentV1 } from "@repo/types";

const EMPTY_CONTENT: StoryboardContentV1 = {
  version: 1,
  viewport: { x: 0, y: 0, zoom: 1 },
  nodes: [],
  edges: [],
};

describe("migrateContent", () => {
  it("returns default structure for empty object", () => {
    expect(migrateContent({})).toEqual(EMPTY_CONTENT);
  });

  it("returns default structure for null", () => {
    expect(migrateContent(null)).toEqual(EMPTY_CONTENT);
  });

  it("returns default structure for undefined", () => {
    expect(migrateContent(undefined)).toEqual(EMPTY_CONTENT);
  });

  it("preserves valid v1 content", () => {
    const validContent: StoryboardContentV1 = {
      version: 1,
      viewport: { x: 10, y: 20, zoom: 1.5 },
      nodes: [
        {
          id: "node-1",
          type: "scene",
          position: { x: 100, y: 200 },
          data: { title: "Opening Scene" },
        },
      ],
      edges: [{ id: "edge-1", source: "node-1", target: "node-2" }],
    };

    const result = migrateContent(validContent);
    expect(result.version).toBe(1);
    expect(result.viewport).toEqual({ x: 10, y: 20, zoom: 1.5 });
    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0]!.id).toBe("node-1");
    expect(result.edges).toHaveLength(1);
  });

  it("filters out nodes with invalid types", () => {
    const content = {
      version: 1,
      viewport: { x: 0, y: 0, zoom: 1 },
      nodes: [
        {
          id: "valid",
          type: "scene",
          position: { x: 0, y: 0 },
          data: { title: "Valid" },
        },
        {
          id: "invalid",
          type: "unknown_type",
          position: { x: 0, y: 0 },
          data: { title: "Invalid" },
        },
      ],
      edges: [],
    };

    const result = migrateContent(content);
    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0]!.type).toBe("scene");
  });

  it("returns empty fallback for unknown version", () => {
    const content = {
      version: 99,
      viewport: { x: 0, y: 0, zoom: 1 },
      nodes: [],
      edges: [],
    };

    expect(migrateContent(content)).toEqual(EMPTY_CONTENT);
  });

  it("preserves optional fields (width, height, parentId)", () => {
    const content = {
      version: 1,
      viewport: { x: 0, y: 0, zoom: 1 },
      nodes: [
        {
          id: "node-1",
          type: "group",
          position: { x: 0, y: 0 },
          data: { title: "Group" },
          width: 400,
          height: 300,
        },
        {
          id: "node-2",
          type: "scene",
          position: { x: 10, y: 10 },
          data: { title: "Child" },
          parentId: "node-1",
        },
      ],
      edges: [],
    };

    const result = migrateContent(content);
    expect(result.nodes).toHaveLength(2);
    expect(result.nodes[0]!.width).toBe(400);
    expect(result.nodes[0]!.height).toBe(300);
    expect(result.nodes[1]!.parentId).toBe("node-1");
  });

  it("filters out nodes with missing required fields", () => {
    const content = {
      version: 1,
      viewport: { x: 0, y: 0, zoom: 1 },
      nodes: [
        { type: "scene", position: { x: 0, y: 0 }, data: { title: "No ID" } },
        { id: "no-type", position: { x: 0, y: 0 }, data: { title: "No type" } },
        { id: "no-pos", type: "scene", data: { title: "No position" } },
        { id: "no-data", type: "scene", position: { x: 0, y: 0 } },
        {
          id: "valid",
          type: "event",
          position: { x: 0, y: 0 },
          data: { title: "Valid" },
        },
      ],
      edges: [],
    };

    const result = migrateContent(content);
    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0]!.id).toBe("valid");
  });
});
