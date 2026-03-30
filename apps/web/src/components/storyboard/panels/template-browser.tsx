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
  templates,
  type StoryboardTemplate,
} from "@/components/storyboard/templates";

interface TemplateBrowserProps {
  open: boolean;
  onClose: () => void;
  onApply: (template: StoryboardTemplate) => void;
}

export function TemplateBrowser({
  open,
  onClose,
  onApply,
}: TemplateBrowserProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selectedTemplate = templates.find((t) => t.id === selectedId) ?? null;

  function handleOpenChange(isOpen: boolean) {
    if (!isOpen) {
      setSelectedId(null);
      onClose();
    }
  }

  function handleApply() {
    if (selectedTemplate) {
      onApply(selectedTemplate);
      setSelectedId(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>템플릿 선택</DialogTitle>
          <DialogDescription>
            장르별 템플릿을 선택하면 현재 캔버스에 노드가 추가됩니다.
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
                노드 {template.nodeCount}개
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
  );
}
