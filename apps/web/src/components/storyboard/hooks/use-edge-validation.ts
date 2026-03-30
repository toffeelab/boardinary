"use client";

import { useCallback } from "react";
import type { Edge, Connection, IsValidConnection } from "@xyflow/react";

function hasCycle(edges: Edge[], source: string, target: string): boolean {
  const adj = new Map<string, string[]>();
  for (const edge of edges) {
    if (!adj.has(edge.source)) adj.set(edge.source, []);
    adj.get(edge.source)!.push(edge.target);
  }
  // After adding source→target, check if target can reach source (cycle)
  const visited = new Set<string>();
  const stack = [target];
  while (stack.length > 0) {
    const node = stack.pop()!;
    if (node === source) return true;
    if (visited.has(node)) continue;
    visited.add(node);
    const neighbors = adj.get(node) ?? [];
    stack.push(...neighbors);
  }
  return false;
}

export function useEdgeValidation(edges: Edge[]) {
  const isValidConnection: IsValidConnection = useCallback(
    (connection: Edge | Connection) => {
      const source = connection.source;
      const target = connection.target;
      if (!source || !target) return false;

      // Self-loop prevention
      if (source === target) return false;

      // Duplicate edge prevention
      const sourceHandle = connection.sourceHandle ?? null;
      const isDuplicate = edges.some(
        (e) =>
          e.source === source &&
          e.target === target &&
          (e.sourceHandle ?? null) === sourceHandle,
      );
      if (isDuplicate) return false;

      // Cycle detection
      if (hasCycle(edges, source, target)) return false;

      return true;
    },
    [edges],
  );

  return { isValidConnection };
}
