"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface CommentInputProps {
  placeholder?: string;
  onSubmit: (content: string) => Promise<void>;
  onCancel?: () => void;
  autoFocus?: boolean;
}

export function CommentInput({
  placeholder = "주석을 입력하세요...",
  onSubmit,
  onCancel,
  autoFocus = false,
}: CommentInputProps) {
  const [value, setValue] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!value.trim()) return;
    setIsSubmitting(true);
    try {
      await onSubmit(value.trim());
      setValue("");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <Textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        rows={3}
        className="resize-none"
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            void handleSubmit();
          }
        }}
      />
      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button variant="ghost" size="sm" onClick={onCancel}>
            취소
          </Button>
        )}
        <Button
          size="sm"
          onClick={() => void handleSubmit()}
          disabled={!value.trim() || isSubmitting}
        >
          {isSubmitting ? "전송 중..." : "전송"}
        </Button>
      </div>
    </div>
  );
}
