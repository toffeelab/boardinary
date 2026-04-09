"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  templates,
  type StoryboardTemplate,
} from "@/components/storyboard/templates";

interface TemplateBrowserProps {
  open: boolean;
  onClose: () => void;
  onApply: (template: StoryboardTemplate, mode: "replace" | "append") => void;
  currentNodeCount: number;
  currentEdgeCount: number;
}

export function TemplateBrowser({
  open,
  onClose,
  onApply,
  currentNodeCount,
}: TemplateBrowserProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const selectedTemplate = templates.find((t) => t.id === selectedId) ?? null;

  function handleOpenChange(isOpen: boolean) {
    if (!isOpen) {
      setSelectedId(null);
      onClose();
    }
  }

  function handleApply() {
    if (!selectedTemplate) return;

    if (currentNodeCount === 0) {
      onApply(selectedTemplate, "replace");
      setSelectedId(null);
    } else {
      setIsConfirmOpen(true);
    }
  }

  function handleConfirmAppend() {
    if (!selectedTemplate) return;
    onApply(selectedTemplate, "append");
    setIsConfirmOpen(false);
    setSelectedId(null);
  }

  function handleConfirmReplace() {
    if (!selectedTemplate) return;
    onApply(selectedTemplate, "replace");
    setIsConfirmOpen(false);
    setSelectedId(null);
  }

  function handleConfirmCancel() {
    setIsConfirmOpen(false);
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>템플릿 선택</DialogTitle>
            <DialogDescription>
              장르별 템플릿을 선택하면 현재 캔버스에 요소가 추가됩니다.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {templates.map((template) => (
              <button
                key={template.id}
                type="button"
                onClick={() => setSelectedId(template.id)}
                className={`rounded-lg border p-4 text-left transition-colors hover:bg-accent ${
                  selectedId === template.id
                    ? "border-primary ring-2 ring-primary/30"
                    : "border-border"
                }`}
              >
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-sm font-semibold">{template.name}</span>
                  <Badge variant="secondary" className="text-xs">
                    {template.genre}
                  </Badge>
                </div>
                <p className="mb-2 text-xs text-muted-foreground">
                  {template.description}
                </p>
                <p className="text-xs text-muted-foreground">
                  요소 {template.nodeCount}개
                </p>
              </button>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              취소
            </Button>
            <Button onClick={handleApply} disabled={!selectedTemplate}>
              적용
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>템플릿 적용 방식 선택</AlertDialogTitle>
            <AlertDialogDescription>
              캔버스에 이미 요소가 있습니다. 템플릿을 어떻게 적용하시겠습니까?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleConfirmCancel}>
              취소
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmReplace}
              variant="destructive"
            >
              덮어쓰기
            </AlertDialogAction>
            <AlertDialogAction onClick={handleConfirmAppend}>
              추가 배치
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
