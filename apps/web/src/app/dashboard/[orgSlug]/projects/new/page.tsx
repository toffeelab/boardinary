import { notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getCurrentUserId } from "@/lib/auth";
import { getOrganizationBySlug, isOrgMember } from "@/data-access/organizations";
import { createProjectAction } from "@/actions/project-actions";

export default async function NewProjectPage({
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

  return (
    <div className="mx-auto max-w-lg">
      <Card>
        <CardHeader>
          <CardTitle>새 프로젝트</CardTitle>
          <CardDescription>
            게임 프로젝트를 생성하고 스토리보드를 만들어보세요.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createProjectAction} className="space-y-4">
            <input type="hidden" name="orgSlug" value={orgSlug} />
            <div className="space-y-2">
              <Label htmlFor="name">프로젝트 이름</Label>
              <Input
                id="name"
                name="name"
                placeholder="예: 판타지 RPG 메인 퀘스트"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">설명 (선택)</Label>
              <Input
                id="description"
                name="description"
                placeholder="프로젝트에 대한 간단한 설명"
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" className="flex-1">
                프로젝트 생성
              </Button>
              <Button variant="outline" asChild>
                <Link href={`/dashboard/${orgSlug}`}>취소</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
