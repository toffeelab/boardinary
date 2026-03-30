import { notFound } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCurrentUserId } from "@/lib/auth";
import { apiClient } from "@/lib/api-client";
import type { ProjectDto } from "@repo/types";
import { TemplateSelectForm } from "@/components/storyboard/template-select-form";

export default async function NewStoryboardPage({
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

  return (
    <div className="mx-auto max-w-lg">
      <Card>
        <CardHeader>
          <CardTitle>새 스토리보드</CardTitle>
          <CardDescription>
            {project.name}에 새로운 스토리보드를 추가합니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TemplateSelectForm orgSlug={orgSlug} projectSlug={slug} />
        </CardContent>
      </Card>
    </div>
  );
}
