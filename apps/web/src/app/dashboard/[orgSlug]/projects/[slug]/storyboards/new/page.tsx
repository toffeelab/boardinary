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
import { getProjectBySlug } from "@/data-access/projects";
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

export default async function NewStoryboardPage({
  params,
}: {
  params: Promise<{ orgSlug: string; slug: string }>;
}) {
  const { orgSlug, slug } = await params;
  const userId = await getCurrentUserId();

  const org = await getOrganizationBySlug(orgSlug);
  if (!org) notFound();

  const isMember = await isOrgMember(org.id, userId);
  if (!isMember) notFound();

  const project = await getProjectBySlug(org.id, slug);
  if (!project) notFound();

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
          <form action={createStoryboardAction} className="space-y-4">
            <input type="hidden" name="orgSlug" value={orgSlug} />
            <input type="hidden" name="projectSlug" value={slug} />

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
                <Link href={`/dashboard/${orgSlug}/projects/${slug}`}>취소</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
