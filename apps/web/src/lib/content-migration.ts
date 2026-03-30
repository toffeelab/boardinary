import type {
  StoryboardContentV1,
  StoryboardNode,
} from "@repo/types";

const EMPTY_CONTENT: StoryboardContentV1 = {
  version: 1,
  viewport: { x: 0, y: 0, zoom: 1 },
  nodes: [],
  edges: [],
};

const VALID_NODE_TYPES = new Set([
  "scene",
  "event",
  "branch",
  "group",
  "dialogue",
  "condition",
  "note",
]);

/** Sanitize a single node, ensuring new optional fields are valid */
function sanitizeNode(raw: Record<string, unknown>): StoryboardNode | null {
  if (!raw.id || !raw.type || !raw.position || !raw.data) return null;
  if (!VALID_NODE_TYPES.has(raw.type as string)) return null;

  const node: StoryboardNode = {
    id: raw.id as string,
    type: raw.type as StoryboardNode["type"],
    position: raw.position as { x: number; y: number },
    data: raw.data as StoryboardNode["data"],
  };

  // Preserve optional fields when present
  if (typeof raw.width === "number") node.width = raw.width;
  if (typeof raw.height === "number") node.height = raw.height;
  if (typeof raw.parentId === "string") node.parentId = raw.parentId;

  return node;
}

export function migrateContent(raw: unknown): StoryboardContentV1 {
  if (!raw || typeof raw !== "object") return EMPTY_CONTENT;

  const content = raw as Record<string, unknown>;

  // 빈 객체 (Phase 0 기본값)
  if (Object.keys(content).length === 0) return EMPTY_CONTENT;

  // version 1 검증
  if (content.version === 1) {
    const rawNodes = Array.isArray(content.nodes) ? content.nodes : [];
    const nodes = rawNodes
      .map((n: unknown) => sanitizeNode(n as Record<string, unknown>))
      .filter((n): n is StoryboardNode => n !== null);

    return {
      version: 1,
      viewport: (content.viewport as StoryboardContentV1["viewport"]) ??
        EMPTY_CONTENT.viewport,
      nodes,
      edges: (Array.isArray(content.edges)
        ? content.edges
        : []) as StoryboardContentV1["edges"],
    };
  }

  // 알 수 없는 버전 → 빈 상태로 fallback
  return EMPTY_CONTENT;
}
