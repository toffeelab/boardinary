"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { templates } from "@/components/storyboard/templates";
import { createStoryboardAction } from "@/actions/storyboard-actions";

const GENRES = [
  "RPG",
  "FPS",
  "액션",
  "어드벤처",
  "퍼즐",
  "전략",
  "시뮬레이션",
  "기타",
];

interface TemplateSelectFormProps {
  orgSlug: string;
  projectSlug: string;
}

export function TemplateSelectForm({
  orgSlug,
  projectSlug,
}: TemplateSelectFormProps) {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    null,
  );

  const selectedTemplate =
    templates.find((t) => t.id === selectedTemplateId) ?? null;

  return (
    <form
      action={
        createStoryboardAction as unknown as (formData: FormData) => void
      }
      className="space-y-6"
    >
      <input type="hidden" name="orgSlug" value={orgSlug} />
      <input type="hidden" name="projectSlug" value={projectSlug} />
      {selectedTemplate && (
        <input
          type="hidden"
          name="templateContent"
          value={JSON.stringify(selectedTemplate.content)}
        />
      )}

      {/* Template selection */}
      <div className="space-y-3">
        <Label>템플릿 선택</Label>
        <div className="grid grid-cols-2 gap-3">
          {/* Empty canvas option */}
          <button
            type="button"
            onClick={() => setSelectedTemplateId(null)}
            className={`rounded-lg border p-3 text-left transition-colors hover:bg-accent ${
              selectedTemplateId === null
                ? "border-primary ring-2 ring-primary/30"
                : "border-border"
            }`}
          >
            <span className="text-sm font-semibold">빈 캔버스</span>
            <p className="mt-1 text-xs text-muted-foreground">
              빈 스토리보드에서 시작합니다.
            </p>
          </button>

          {/* Template options */}
          {templates.map((template) => (
            <button
              key={template.id}
              type="button"
              onClick={() => setSelectedTemplateId(template.id)}
              className={`rounded-lg border p-3 text-left transition-colors hover:bg-accent ${
                selectedTemplateId === template.id
                  ? "border-primary ring-2 ring-primary/30"
                  : "border-border"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">{template.name}</span>
                <Badge variant="secondary" className="text-xs">
                  {template.genre}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {template.description}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                요소 {template.nodeCount}개
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Form fields */}
      <div className="space-y-2">
        <Label htmlFor="name">스토리보드 이름</Label>
        <Input
          id="name"
          name="name"
          placeholder="예: 메인 퀘스트 — 1장: 시작의 마을"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">설명 (선택)</Label>
        <Input
          id="description"
          name="description"
          placeholder="스토리보드에 대한 간단한 설명"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="genre">장르 (선택)</Label>
        <select
          id="genre"
          name="genre"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">장르 선택...</option>
          {GENRES.map((genre) => (
            <option key={genre} value={genre}>
              {genre}
            </option>
          ))}
        </select>
      </div>

      <div className="flex gap-2">
        <Button type="submit" className="flex-1">
          스토리보드 생성
        </Button>
        <Button variant="outline" asChild>
          <Link href={`/dashboard/${orgSlug}/projects/${projectSlug}`}>
            취소
          </Link>
        </Button>
      </div>
    </form>
  );
}
