"use client";

import { useState, useTransition } from "react";
import type { Node, Edge } from "@xyflow/react";
import { Loader2 } from "lucide-react";
import { detectBlueprintType } from "@/lib/blueprint-utils";
import { saveBlueprint } from "@/actions/blueprint-actions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

interface SaveBlueprintDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  content: { nodes: Node[]; edges: Edge[] };
  orgId?: string;
  onSaved?: () => void;
}

export function SaveBlueprintDialog({
  open,
  onOpenChange,
  content,
  orgId,
  onSaved,
}: SaveBlueprintDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [scope, setScope] = useState<"personal" | "organization">("personal");
  const [tagsInput, setTagsInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const blueprintType = detectBlueprintType(content.nodes.length);
  const typeLabel = blueprintType === "preset" ? "프리셋" : "플로우";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("이름을 입력하세요");
      return;
    }

    const tags = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    startTransition(async () => {
      try {
        await saveBlueprint({
          name: trimmedName,
          description: description.trim() || undefined,
          type: blueprintType,
          scope,
          orgId: scope === "organization" ? orgId : undefined,
          content: {
            nodes: content.nodes.map((n) => ({
              id: n.id,
              type: n.type,
              position: n.position,
              data: n.data,
              ...(n.width != null ? { width: n.width } : {}),
              ...(n.height != null ? { height: n.height } : {}),
              ...(n.parentId ? { parentId: n.parentId } : {}),
            })),
            edges: content.edges.map((e) => ({
              id: e.id,
              source: e.source,
              target: e.target,
              ...(e.sourceHandle ? { sourceHandle: e.sourceHandle } : {}),
              ...(typeof e.label === "string" ? { label: e.label } : {}),
            })),
          },
          tags: tags.length > 0 ? tags : undefined,
        });
        // Reset and close
        setName("");
        setDescription("");
        setScope("personal");
        setTagsInput("");
        setError(null);
        onOpenChange(false);
        onSaved?.();
      } catch {
        setError("저장에 실패했습니다. 다시 시도해주세요.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>블루프린트로 저장</DialogTitle>
          <DialogDescription>
            선택한 노드를 블루프린트로 저장하여 재사용할 수 있습니다.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Type display */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">유형:</span>
            <Badge variant="secondary">{typeLabel}</Badge>
            <span className="text-xs text-muted-foreground">
              (노드 {content.nodes.length}개, 엣지 {content.edges.length}개)
            </span>
          </div>

          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="blueprint-name">이름 *</Label>
            <Input
              id="blueprint-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError(null);
              }}
              placeholder="블루프린트 이름"
              autoFocus
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="blueprint-description">설명</Label>
            <Textarea
              id="blueprint-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="블루프린트에 대한 설명 (선택사항)"
              rows={3}
            />
          </div>

          {/* Scope */}
          <div className="space-y-2">
            <Label htmlFor="blueprint-scope">범위</Label>
            <select
              id="blueprint-scope"
              value={scope}
              onChange={(e) =>
                setScope(e.target.value as "personal" | "organization")
              }
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <option value="personal">개인</option>
              {orgId && <option value="organization">조직</option>}
            </select>
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <Label htmlFor="blueprint-tags">태그</Label>
            <Input
              id="blueprint-tags"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="태그1, 태그2, 태그3 (쉼표로 구분)"
            />
          </div>

          {/* Error */}
          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              취소
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="animate-spin" />}
              저장
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
