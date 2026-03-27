import type { StoryboardContentV1 } from "@repo/types";

const EMPTY_CONTENT: StoryboardContentV1 = {
  version: 1,
  viewport: { x: 0, y: 0, zoom: 1 },
  nodes: [],
  edges: [],
};

export function migrateContent(raw: unknown): StoryboardContentV1 {
  if (!raw || typeof raw !== "object") return EMPTY_CONTENT;

  const content = raw as Record<string, unknown>;

  // 빈 객체 (Phase 0 기본값)
  if (Object.keys(content).length === 0) return EMPTY_CONTENT;

  // version 1 검증
  if (content.version === 1) {
    return {
      version: 1,
      viewport: (content.viewport as StoryboardContentV1["viewport"]) ??
        EMPTY_CONTENT.viewport,
      nodes: (Array.isArray(content.nodes)
        ? content.nodes
        : []) as StoryboardContentV1["nodes"],
      edges: (Array.isArray(content.edges)
        ? content.edges
        : []) as StoryboardContentV1["edges"],
    };
  }

  // 알 수 없는 버전 → 빈 상태로 fallback
  return EMPTY_CONTENT;
}
