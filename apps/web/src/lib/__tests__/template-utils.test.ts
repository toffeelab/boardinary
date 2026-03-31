import { describe, it, expect } from "vitest";
import { calcTemplateAppendOffset } from "../template-utils";
import type { Node } from "@xyflow/react";

const makeNode = (id: string, x: number, y: number, width?: number): Node => ({
  id,
  type: "scene",
  position: { x, y },
  data: {},
  measured: width ? { width, height: 100 } : undefined,
});

describe("calcTemplateAppendOffset", () => {
  it("기존 노드 없음 → offset 0", () => {
    expect(calcTemplateAppendOffset([])).toBe(0);
  });

  it("단일 노드 (measured width 있음) → position.x + width + 300", () => {
    const nodes = [makeNode("a", 100, 50, 200)];
    expect(calcTemplateAppendOffset(nodes)).toBe(600);
  });

  it("단일 노드 (measured width 없음) → position.x + 기본값(200) + 300", () => {
    const nodes = [makeNode("a", 100, 50)];
    expect(calcTemplateAppendOffset(nodes)).toBe(600);
  });

  it("다중 노드 → 가장 우측 끝 + 300", () => {
    const nodes = [
      makeNode("a", 0, 0, 150),
      makeNode("b", 500, 100, 200),
      makeNode("c", 300, 200, 100),
    ];
    expect(calcTemplateAppendOffset(nodes)).toBe(1000);
  });
});
