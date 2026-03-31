import type { Node, Edge } from "@xyflow/react";

function createId(): string {
  return crypto.randomUUID();
}

export function extractBlueprintContent(
  selectedNodes: Node[],
  allEdges: Edge[],
): { nodes: Node[]; edges: Edge[] } {
  if (selectedNodes.length === 0) return { nodes: [], edges: [] };

  const selectedIds = new Set(selectedNodes.map((n) => n.id));

  const minX = Math.min(...selectedNodes.map((n) => n.position.x));
  const minY = Math.min(...selectedNodes.map((n) => n.position.y));

  const idMap = new Map<string, string>();
  selectedNodes.forEach((n) => idMap.set(n.id, createId()));

  const nodes = selectedNodes.map((n) => ({
    ...n,
    id: idMap.get(n.id)!,
    position: {
      x: n.position.x - minX,
      y: n.position.y - minY,
    },
    selected: false,
    parentId:
      n.parentId && idMap.has(n.parentId) ? idMap.get(n.parentId) : undefined,
  }));

  const edges = allEdges
    .filter((e) => selectedIds.has(e.source) && selectedIds.has(e.target))
    .map((e) => ({
      ...e,
      id: createId(),
      source: idMap.get(e.source)!,
      target: idMap.get(e.target)!,
      selected: false,
    }));

  return { nodes, edges };
}

export function instantiateBlueprint(
  content: { nodes: Node[]; edges: Edge[] },
  offset: { x: number; y: number },
): { nodes: Node[]; edges: Edge[] } {
  if (!content.nodes || content.nodes.length === 0) {
    return { nodes: [], edges: [] };
  }

  const idMap = new Map<string, string>();
  content.nodes.forEach((n) => idMap.set(n.id, createId()));

  const nodes = content.nodes.map((n) => ({
    ...n,
    id: idMap.get(n.id)!,
    position: {
      x: n.position.x + offset.x,
      y: n.position.y + offset.y,
    },
    selected: false,
    parentId:
      n.parentId && idMap.has(n.parentId) ? idMap.get(n.parentId) : undefined,
  }));

  const edges = (content.edges ?? []).map((e) => ({
    ...e,
    id: createId(),
    source: idMap.get(e.source) ?? e.source,
    target: idMap.get(e.target) ?? e.target,
    selected: false,
  }));

  return { nodes, edges };
}

export function detectBlueprintType(nodeCount: number): "preset" | "flow" {
  return nodeCount <= 1 ? "preset" : "flow";
}
