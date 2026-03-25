import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCurrentUserId } from "@/lib/auth";
import { apiClient } from "@/lib/api-client";
import type { StoryboardDto } from "@repo/types";

export default async function StoryboardDetailPage({
  params,
}: {
  params: Promise<{ orgSlug: string; slug: string; id: string }>;
}) {
  const { id } = await params;
  const userId = await getCurrentUserId();

  let storyboard: StoryboardDto;
  try {
    storyboard = await apiClient<StoryboardDto>(
      `/api/storyboards/${id}`,
      { userId },
    );
  } catch {
    notFound();
  }

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">{storyboard.name}</h1>
          {storyboard.genre && (
            <Badge variant="secondary">{storyboard.genre}</Badge>
          )}
          <Badge variant="outline">{storyboard.status}</Badge>
        </div>
        {storyboard.description && (
          <p className="mt-1 text-sm text-muted-foreground">
            {storyboard.description}
          </p>
        )}
      </div>

      {/* Phase 1에서 에디터 캔버스가 들어갈 영역 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">캔버스 에디터</CardTitle>
          <CardDescription>
            Phase 1에서 스토리보드 에디터가 여기에 연결됩니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-96 items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/20">
            <p className="text-sm text-muted-foreground">
              에디터 영역 — Phase 1에서 구현 예정
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
