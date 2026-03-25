import { notFound } from "next/navigation";
import Link from "next/link";
import { Plus, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCurrentUserId } from "@/lib/auth";
import { apiClient } from "@/lib/api-client";
import type { ProjectDto, StoryboardMetaDto } from "@repo/types";
import { EmptyState } from "@/components/shared/empty-state";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ orgSlug: string; slug: string }>;
}) {
  const { orgSlug, slug } = await params;
  const userId = await getCurrentUserId();

  let project: ProjectDto;
  try {
    project = await apiClient<ProjectDto>(
      `/api/organizations/${orgSlug}/projects/${slug}`,
      { userId },
    );
  } catch {
    notFound();
  }

  const storyboards = await apiClient<StoryboardMetaDto[]>(
    `/api/organizations/${orgSlug}/projects/${slug}/storyboards`,
    { userId },
  );

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{project.name}</h1>
          {project.description && (
            <p className="text-sm text-muted-foreground">
              {project.description}
            </p>
          )}
        </div>
        <Button asChild>
          <Link href={`/dashboard/${orgSlug}/projects/${slug}/storyboards/new`}>
            <Plus className="mr-2 h-4 w-4" />
            새 스토리보드
          </Link>
        </Button>
      </div>

      {storyboards.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {storyboards.map((sb) => (
            <Link
              key={sb.id}
              href={`/dashboard/${orgSlug}/projects/${slug}/storyboards/${sb.id}`}
            >
              <Card className="transition-colors hover:border-primary/50">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-primary" />
                      <CardTitle className="text-base">{sb.name}</CardTitle>
                    </div>
                    {sb.genre && (
                      <Badge variant="secondary">{sb.genre}</Badge>
                    )}
                  </div>
                  {sb.description && (
                    <CardDescription className="line-clamp-2">
                      {sb.description}
                    </CardDescription>
                  )}
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={FileText}
          title="아직 스토리보드가 없습니다"
          description="첫 번째 스토리보드를 만들어 게임 흐름을 시각화하세요."
          actionLabel="스토리보드 만들기"
          actionHref={`/dashboard/${orgSlug}/projects/${slug}/storyboards/new`}
        />
      )}
    </div>
  );
}
