"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface SaveCheckpointDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (label: string) => Promise<void>;
}

export function SaveCheckpointDialog({
  open,
  onClose,
  onSave,
}: SaveCheckpointDialogProps) {
  const [label, setLabel] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!label.trim()) return;
    setIsSaving(true);
    try {
      await onSave(label.trim());
      setLabel("");
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>체크포인트 저장</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Label htmlFor="checkpoint-label">이름</Label>
          <Input
            id="checkpoint-label"
            placeholder="예: v2.0 퀘스트 분기 확정"
            value={label}
            maxLength={100}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleSave();
            }}
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            취소
          </Button>
          <Button onClick={handleSave} disabled={!label.trim() || isSaving}>
            {isSaving ? "저장 중..." : "저장"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
