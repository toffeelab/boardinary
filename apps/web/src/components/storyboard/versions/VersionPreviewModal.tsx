"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  ReactFlow,
  ReactFlowProvider,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { getVersionById } from "@/lib/api-client";
import { migrateContent } from "@/lib/content-migration";
import type { StoryboardContentV1 } from "@repo/types";
import { nodeTypes } from "../nodes/node-types";

interface VersionPreviewModalProps {
  versionId: string | null;
  storyboardId: string;
  userId: string;
  onClose: () => void;
  onRestore: (versionId: string) => Promise<void>;
}

export function VersionPreviewModal({
  versionId,
  storyboardId,
  userId,
  onClose,
  onRestore,
}: VersionPreviewModalProps) {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  useEffect(() => {
    if (!versionId) return;
    setIsLoading(true);
    getVersionById(userId, storyboardId, versionId)
      .then((v) => {
        const content = migrateContent(v.content) as StoryboardContentV1;
        setNodes(
          (content.nodes ?? []).map((n) => ({
            id: n.id,
            type: n.type,
            position: n.position,
            data: n.data,
          })),
        );
        setEdges(
          (content.edges ?? []).map((e) => ({
            id: e.id,
            source: e.source,
            target: e.target,
            ...(e.sourceHandle ? { sourceHandle: e.sourceHandle } : {}),
            ...(e.label ? { label: e.label } : {}),
          })),
        );
      })
      .finally(() => setIsLoading(false));
  }, [versionId, userId, storyboardId]);

  const handleRestore = async () => {
    if (!versionId) return;
    setIsRestoring(true);
    try {
      await onRestore(versionId);
      onClose();
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <Dialog open={!!versionId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>버전 미리보기</DialogTitle>
        </DialogHeader>
        <div className="h-[60vh] rounded-md border border-border bg-background">
          {isLoading ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              로딩 중...
            </div>
          ) : (
            <ReactFlowProvider key={versionId}>
              <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                nodesDraggable={false}
                nodesConnectable={false}
                elementsSelectable={false}
                panOnDrag
                zoomOnScroll
                fitView
              />
            </ReactFlowProvider>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isRestoring}>
            닫기
          </Button>
          <Button onClick={handleRestore} disabled={isRestoring || isLoading}>
            {isRestoring ? "복원 중..." : "이 버전으로 복원"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
