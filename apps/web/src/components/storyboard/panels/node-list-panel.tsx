"use client";

import { useMemo } from "react";
import type { Node } from "@xyflow/react";
import { PanelLeftClose } from "lucide-react";
import type { StoryboardNodeData } from "@repo/types";
import { useEditorStore } from "@/stores/editor-store";
import { Separator } from "@/components/ui/separator";

interface NodeListPanelProps {
  nodes: Node[];
  onNodeSelect: (nodeId: string) => void;
}

const NODE_TYPE_CONFIG = {
  scene: { label: "씬", color: "#8b5cf6" },
  event: { label: "이벤트", color: "#10b981" },
  branch: { label: "분기", color: "#f59e0b" },
  dialogue: { label: "대사", color: "#3b82f6" },
  condition: { label: "조건", color: "#ef4444" },
  note: { label: "메모", color: "#6b7280" },
} as const;

type NodeType = keyof typeof NODE_TYPE_CONFIG;

export function NodeListPanel({ nodes, onNodeSelect }: NodeListPanelProps) {
  const { selectedNodeId, toggleNodeList } = useEditorStore();

  const groupedNodes = useMemo(() => {
    const groups: Record<NodeType, Node[]> = {
      scene: [],
      event: [],
      branch: [],
      dialogue: [],
      condition: [],
      note: [],
    };
    for (const node of nodes) {
      const type = node.type as NodeType;
      if (type in groups) {
        groups[type].push(node);
      }
    }
    return groups;
  }, [nodes]);

  const hasNodes = nodes.length > 0;

  return (
    <aside className="flex h-full min-w-0 flex-col overflow-hidden bg-card">
      <div className="flex items-center justify-between px-4 py-3">
        <h2 className="truncate text-sm font-semibold text-foreground">
          노드 목록
        </h2>
        <button
          type="button"
          onClick={toggleNodeList}
          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label="목록 닫기"
        >
          <PanelLeftClose className="h-4 w-4" />
        </button>
      </div>
      <Separator />
      <div className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto px-2 py-2">
        {!hasNodes && (
          <p className="px-2 py-4 text-center text-xs text-muted-foreground">
            툴바에서 노드를 추가하세요
          </p>
        )}
        {hasNodes &&
          (Object.entries(NODE_TYPE_CONFIG) as [NodeType, (typeof NODE_TYPE_CONFIG)[NodeType]][]).map(
            ([type, config]) => {
              const typeNodes = groupedNodes[type];
              if (typeNodes.length === 0) return null;
              return (
                <div key={type} className="mb-3">
                  <div className="flex items-center gap-2 px-2 py-1">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: config.color }}
                    />
                    <span className="truncate text-xs font-medium text-muted-foreground">
                      {config.label} ({typeNodes.length})
                    </span>
                  </div>
                  <div className="space-y-0.5">
                    {typeNodes.map((node) => {
                      const nodeData = node.data as unknown as StoryboardNodeData;
                      const isSelected = node.id === selectedNodeId;
                      return (
                        <button
                          key={node.id}
                          type="button"
                          onClick={() => onNodeSelect(node.id)}
                          className={`w-full truncate rounded-md px-3 py-1.5 text-left text-sm transition-colors ${
                            isSelected
                              ? "bg-accent text-accent-foreground"
                              : "text-foreground hover:bg-accent/50"
                          }`}
                        >
                          {nodeData.title || "제목 없음"}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            },
          )}
      </div>
    </aside>
  );
}
