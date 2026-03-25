import { notFound } from "next/navigation";
import Link from "next/link";
import { Plus, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCurrentUserId } from "@/lib/auth";
import {
  getOrganizationBySlug,
  isOrgMember,
} from "@/data-access/organizations";
import { getProjectsByOrgId } from "@/data-access/projects";
import { ProjectList } from "@/components/dashboard/project-list";
import { EmptyState } from "@/components/shared/empty-state";

export default async function OrgDashboardPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const userId = await getCurrentUserId();

  const org = await getOrganizationBySlug(orgSlug);
  if (!org) notFound();

  const isMember = await isOrgMember(org.id, userId);
  if (!isMember) notFound();

  const projects = await getProjectsByOrgId(org.id);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{org.name}</h1>
          <p className="text-sm text-muted-foreground">
            프로젝트 {projects.length}개
          </p>
        </div>
        <Button asChild>
          <Link href={`/dashboard/${orgSlug}/projects/new`}>
            <Plus className="mr-2 h-4 w-4" />
            새 프로젝트
          </Link>
        </Button>
      </div>

      {projects.length > 0 ? (
        <ProjectList
          projects={projects.map((p) => ({
            id: p.id,
            name: p.name,
            slug: p.slug,
            description: p.description,
            updatedAt: p.updatedAt,
          }))}
          orgSlug={orgSlug}
        />
      ) : (
        <EmptyState
          icon={FolderOpen}
          title="아직 프로젝트가 없습니다"
          description="첫 번째 프로젝트를 만들어 게임 스토리보드를 시작하세요."
          actionLabel="프로젝트 만들기"
          actionHref={`/dashboard/${orgSlug}/projects/new`}
        />
      )}
    </div>
  );
}
