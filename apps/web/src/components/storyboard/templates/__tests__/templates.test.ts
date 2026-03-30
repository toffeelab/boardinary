import { describe, it, expect } from "vitest";
import { templates } from "../index";
import { migrateContent } from "@/lib/content-migration";

describe("genre templates", () => {
  it("3개 템플릿 존재", () => {
    expect(templates).toHaveLength(3);
  });

  templates.forEach((template) => {
    describe(template.name, () => {
      it("유효한 StoryboardContentV1 구조", () => {
        expect(template.id).toBeTruthy();
        expect(template.content.version).toBe(1);
        expect(template.content.nodes.length).toBeGreaterThan(0);
        expect(template.content.edges.length).toBeGreaterThan(0);
      });

      it("migrateContent를 통과", () => {
        const migrated = migrateContent(template.content);
        expect(migrated.nodes.length).toBe(template.content.nodes.length);
      });

      it("nodeCount가 실제 노드 수와 일치", () => {
        expect(template.nodeCount).toBe(template.content.nodes.length);
      });

      it("모든 엣지의 source/target이 유효한 노드 ID", () => {
        const nodeIds = new Set(template.content.nodes.map((n) => n.id));
        for (const edge of template.content.edges) {
          expect(nodeIds.has(edge.source)).toBe(true);
          expect(nodeIds.has(edge.target)).toBe(true);
        }
      });
    });
  });
});
