"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Node, Edge } from "@xyflow/react";
import { Download, Loader2, Pencil, Trash2 } from "lucide-react";
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
  orgSlug?: string;
}

export function BlueprintPanel({
  onInsert,
  orgId,
  orgSlug,
}: BlueprintPanelProps) {
  const router = useRouter();
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
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : "알 수 없는 오류";
        setError(`블루프린트를 삽입할 수 없습니다: ${message}`);
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
    <div className="space-y-2 px-2 py-2">
      {blueprints.map((bp) => (
        <div key={bp.id} className="rounded-md border border-border bg-card">
          <div className="px-3 py-2">
            <div className="flex items-center gap-1.5">
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
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
          </div>
          <div className="flex items-center gap-1 border-t border-border px-2 py-1.5">
            <Button
              variant="default"
              size="sm"
              className="flex-1 gap-1 text-xs"
              onClick={() => void handleInsert(bp.id)}
              disabled={isPending}
            >
              <Download className="h-3 w-3" />
              삽입
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 gap-1 text-xs"
              onClick={() => {
                if (orgSlug) {
                  router.push(`/dashboard/${orgSlug}/blueprints/${bp.id}/edit`);
                }
              }}
              disabled={!orgSlug || isPending}
            >
              <Pencil className="h-3 w-3" />
              편집
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              className="shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => handleDelete(bp.id)}
              disabled={isPending}
              aria-label="삭제"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

export { instantiateBlueprint };
