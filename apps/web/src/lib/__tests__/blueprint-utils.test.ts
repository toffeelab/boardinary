import { describe, it, expect } from "vitest";
import {
  extractBlueprintContent,
  instantiateBlueprint,
  detectBlueprintType,
} from "../blueprint-utils";
import type { Node, Edge } from "@xyflow/react";

const makeNode = (id: string, x: number, y: number, type = "scene"): Node => ({
  id,
  type,
  position: { x, y },
  data: { title: `Node ${id}`, description: "" },
});

const makeEdge = (id: string, source: string, target: string): Edge => ({
  id,
  source,
  target,
});

describe("extractBlueprintContent", () => {
  it("빈 선택 → 빈 결과", () => {
    const result = extractBlueprintContent([], []);
    expect(result.nodes).toHaveLength(0);
    expect(result.edges).toHaveLength(0);
  });

  it("단일 노드 → preset (위치 0,0으로 정규화)", () => {
    const nodes = [makeNode("a", 100, 200)];
    const result = extractBlueprintContent(nodes, []);
    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0].position).toEqual({ x: 0, y: 0 });
    expect(result.nodes[0].id).not.toBe("a"); // 새 ID
  });

  it("다중 노드 → flow (상대좌표 변환 + 엣지 포함)", () => {
    const nodes = [makeNode("a", 100, 100), makeNode("b", 300, 200)];
    const edges = [
      makeEdge("e1", "a", "b"),
      makeEdge("e2", "a", "external"), // 외부 연결 → 제외
    ];
    const result = extractBlueprintContent(nodes, edges);
    expect(result.nodes).toHaveLength(2);
    expect(result.nodes[0].position).toEqual({ x: 0, y: 0 });
    expect(result.nodes[1].position).toEqual({ x: 200, y: 100 });
    expect(result.edges).toHaveLength(1); // 내부 엣지만
    expect(result.edges[0].source).toBe(result.nodes[0].id);
    expect(result.edges[0].target).toBe(result.nodes[1].id);
  });

  it("parentId가 선택 내 → 재매핑", () => {
    const parent = makeNode("p", 0, 0, "group");
    const child = { ...makeNode("c", 10, 10), parentId: "p" };
    const result = extractBlueprintContent([parent, child], []);
    expect(result.nodes[1].parentId).toBe(result.nodes[0].id);
  });

  it("parentId가 선택 외 → undefined", () => {
    const child = { ...makeNode("c", 10, 10), parentId: "external-parent" };
    const result = extractBlueprintContent([child], []);
    expect(result.nodes[0].parentId).toBeUndefined();
  });
});

describe("instantiateBlueprint", () => {
  it("빈 content → 빈 결과", () => {
    const result = instantiateBlueprint(
      { nodes: [], edges: [] },
      { x: 0, y: 0 },
    );
    expect(result.nodes).toHaveLength(0);
  });

  it("offset 적용 + 새 ID 생성", () => {
    const content = {
      nodes: [makeNode("a", 0, 0), makeNode("b", 200, 100)],
      edges: [makeEdge("e1", "a", "b")],
    };
    const result = instantiateBlueprint(content, { x: 500, y: 300 });
    expect(result.nodes[0].position).toEqual({ x: 500, y: 300 });
    expect(result.nodes[1].position).toEqual({ x: 700, y: 400 });
    expect(result.nodes[0].id).not.toBe("a");
    expect(result.edges[0].source).toBe(result.nodes[0].id);
    expect(result.edges[0].target).toBe(result.nodes[1].id);
  });
});

describe("detectBlueprintType", () => {
  it("0 또는 1개 → preset", () => {
    expect(detectBlueprintType(0)).toBe("preset");
    expect(detectBlueprintType(1)).toBe("preset");
  });

  it("2개 이상 → flow", () => {
    expect(detectBlueprintType(2)).toBe("flow");
    expect(detectBlueprintType(10)).toBe("flow");
  });
});
