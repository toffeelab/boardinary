"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import type { Node, Edge } from "@xyflow/react";
import { Loader2, Trash2 } from "lucide-react";
import { fetchBlueprints, removeBlueprint } from "@/actions/blueprint-actions";
import { instantiateBlueprint } from "@/lib/blueprint-utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface BlueprintItem {
  id: string;
  name: string;
  type: "preset" | "flow" | "template";
  description: string | null;
  tags: string[] | null;
}

interface BlueprintPanelProps {
  onInsert: (content: { nodes: Node[]; edges: Edge[] }) => void;
  orgId?: string;
}

export function BlueprintPanel({ onInsert, orgId }: BlueprintPanelProps) {
  const [blueprints, setBlueprints] = useState<BlueprintItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const loadBlueprints = useCallback(async () => {
    try {
      setError(null);
      setIsLoading(true);
      const data = await fetchBlueprints("personal", orgId);
      setBlueprints(
        data.map((b) => ({
          id: b.id,
          name: b.name,
          type: b.type,
          description: b.description,
          tags: b.tags,
        })),
      );
    } catch {
      setError("블루프린트를 불러올 수 없습니다.");
    } finally {
      setIsLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    void loadBlueprints();
  }, [loadBlueprints]);

  const handleInsert = useCallback(
    async (id: string) => {
      try {
        // Fetch full blueprint with content
        const { fetchBlueprintById } =
          await import("@/actions/blueprint-actions");
        const blueprint = await fetchBlueprintById(id);
        const content = blueprint.content as {
          nodes: Node[];
          edges: Edge[];
        };
        onInsert(content);
      } catch {
        setError("블루프린트를 삽입할 수 없습니다.");
      }
    },
    [onInsert],
  );

  const handleDelete = useCallback((id: string) => {
    startTransition(async () => {
      try {
        await removeBlueprint(id);
        setBlueprints((prev) => prev.filter((b) => b.id !== id));
      } catch {
        setError("삭제에 실패했습니다.");
      }
    });
  }, []);

  const typeLabel = (type: string) => {
    switch (type) {
      case "preset":
        return "프리셋";
      case "flow":
        return "플로우";
      case "template":
        return "템플릿";
      default:
        return type;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-2 px-2 py-4 text-center">
        <p className="text-xs text-destructive">{error}</p>
        <Button variant="ghost" size="sm" onClick={() => void loadBlueprints()}>
          다시 시도
        </Button>
      </div>
    );
  }

  if (blueprints.length === 0) {
    return (
      <p className="px-2 py-4 text-center text-xs text-muted-foreground">
        저장된 블루프린트가 없습니다.
        <br />
        노드를 선택하고 Ctrl+Shift+S로 저장하세요.
      </p>
    );
  }

  return (
    <div className="space-y-1 px-2 py-2">
      {blueprints.map((bp) => (
        <div
          key={bp.id}
          className="group flex items-start gap-2 rounded-md px-2 py-2 transition-colors hover:bg-accent/50"
        >
          <button
            type="button"
            className="min-w-0 flex-1 text-left"
            onClick={() => void handleInsert(bp.id)}
            disabled={isPending}
          >
            <div className="flex items-center gap-1.5">
              <span className="truncate text-sm font-medium text-foreground">
                {bp.name}
              </span>
              <Badge variant="secondary" className="shrink-0 text-[10px]">
                {typeLabel(bp.type)}
              </Badge>
            </div>
            {bp.description && (
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {bp.description}
              </p>
            )}
          </button>
          <Button
            variant="ghost"
            size="icon-xs"
            className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
            onClick={() => handleDelete(bp.id)}
            disabled={isPending}
            aria-label="삭제"
          >
            <Trash2 />
          </Button>
        </div>
      ))}
    </div>
  );
}

export { instantiateBlueprint };
