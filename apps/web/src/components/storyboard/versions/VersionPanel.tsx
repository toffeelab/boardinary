"use client";

import { useState } from "react";
import { X, Star, RotateCcw, Trash2, BookmarkPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { useEditorStore } from "@/stores/editor-store";
import { SaveCheckpointDialog } from "./SaveCheckpointDialog";
import type { VersionDto } from "@repo/types";

interface VersionPanelProps {
  versions: VersionDto[];
  isLoading: boolean;
  onSelectVersion: (versionId: string) => void;
  onRestore: (versionId: string) => Promise<void>;
  onDelete: (versionId: string) => Promise<void>;
  onSaveCheckpoint: (label: string) => Promise<void>;
}

export function VersionPanel({
  versions,
  isLoading,
  onSelectVersion,
  onRestore,
  onDelete,
  onSaveCheckpoint,
}: VersionPanelProps) {
  const { setActiveSidePanel } = useEditorStore();
  const [checkpointDialogOpen, setCheckpointDialogOpen] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

  const handleRestoreConfirm = async () => {
    if (!restoreTarget) return;
    setIsRestoring(true);
    try {
      await onRestore(restoreTarget);
    } finally {
      setIsRestoring(false);
      setRestoreTarget(null);
    }
  };

  return (
    <div className="flex h-full w-72 flex-col border-l border-border bg-card">
      {/* 헤더 */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <span className="text-sm font-semibold">버전 히스토리</span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setCheckpointDialogOpen(true)}
            title="체크포인트 저장"
          >
            <BookmarkPlus className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setActiveSidePanel(null)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* 버전 목록 */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
            로딩 중...
          </div>
        ) : versions.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <p>저장된 버전이 없습니다.</p>
            <p className="text-xs">편집 후 자동으로 저장됩니다.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {versions.map((v) => (
              <div
                key={v.id}
                className="group flex cursor-pointer flex-col gap-1 px-4 py-3 hover:bg-accent"
                onClick={() => onSelectVersion(v.id)}
              >
                <div className="flex items-center gap-1.5">
                  {v.label && (
                    <Star className="h-3 w-3 shrink-0 fill-amber-400 text-amber-400" />
                  )}
                  <span className="truncate text-sm font-medium">
                    {v.label ?? "자동저장"}
                  </span>
                  {v.restoredFromId && (
                    <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                      복원됨
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {new Intl.DateTimeFormat("ko-KR", {
                      month: "numeric",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    }).format(new Date(v.createdAt))}
                  </span>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      title="이 버전으로 복원"
                      onClick={(e) => {
                        e.stopPropagation();
                        setRestoreTarget(v.id);
                      }}
                    >
                      <RotateCcw className="h-3 w-3" />
                    </Button>
                    {v.label && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive"
                        title="삭제"
                        onClick={(e) => {
                          e.stopPropagation();
                          void onDelete(v.id);
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
                {v.metadata && (
                  <span className="text-xs text-muted-foreground">
                    +{v.metadata.added} -{v.metadata.removed}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 복원 확인 다이얼로그 */}
      <AlertDialog
        open={!!restoreTarget}
        onOpenChange={(o) => !o && setRestoreTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>버전 복원</AlertDialogTitle>
            <AlertDialogDescription>
              이 버전으로 복원하면 현재 작업이 새 버전으로 저장된 뒤 선택한
              버전으로 되돌아갑니다. 협업 중인 팀원의 화면도 즉시 복원됩니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRestoring}>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRestoreConfirm}
              disabled={isRestoring}
            >
              {isRestoring ? "복원 중..." : "복원"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 체크포인트 저장 다이얼로그 */}
      <SaveCheckpointDialog
        open={checkpointDialogOpen}
        onClose={() => setCheckpointDialogOpen(false)}
        onSave={onSaveCheckpoint}
      />
    </div>
  );
}
