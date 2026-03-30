import { describe, it, expect } from "vitest";
import { hasCycle } from "@/components/storyboard/hooks/use-edge-validation";
import type { Edge } from "@xyflow/react";

function makeEdge(source: string, target: string): Edge {
  return {
    id: `${source}-${target}`,
    source,
    target,
  };
}

describe("hasCycle", () => {
  it("detects self-loop (source === target)", () => {
    const edges: Edge[] = [];
    expect(hasCycle(edges, "a", "a")).toBe(true);
  });

  it("detects cycle: a->b->c, then c->a", () => {
    const edges: Edge[] = [makeEdge("a", "b"), makeEdge("b", "c")];
    // Adding c->a would create a cycle: a->b->c->a
    expect(hasCycle(edges, "c", "a")).toBe(true);
  });

  it("allows valid connection (no cycle)", () => {
    const edges: Edge[] = [makeEdge("a", "b"), makeEdge("b", "c")];
    // Adding c->d is fine, no cycle
    expect(hasCycle(edges, "c", "d")).toBe(false);
  });

  it("allows all connections with empty edges (except self-loop)", () => {
    const edges: Edge[] = [];
    expect(hasCycle(edges, "a", "b")).toBe(false);
    expect(hasCycle(edges, "x", "y")).toBe(false);
  });

  it("detects indirect cycle", () => {
    const edges: Edge[] = [
      makeEdge("a", "b"),
      makeEdge("b", "c"),
      makeEdge("c", "d"),
    ];
    // Adding d->a would create a->b->c->d->a
    expect(hasCycle(edges, "d", "a")).toBe(true);
  });

  it("does not flag duplicate edges as cycles", () => {
    const edges: Edge[] = [makeEdge("a", "b")];
    // Adding another a->b is not a cycle (it's a duplicate, but hasCycle checks reachability)
    expect(hasCycle(edges, "a", "b")).toBe(false);
  });
});
