import { notFound } from "next/navigation";
import { getCurrentUserId } from "@/lib/auth";
import { apiClient } from "@/lib/api-client";
import type { StoryboardDto } from "@repo/types";
import { StoryboardEditor } from "@/components/storyboard/editor";

export default async function StoryboardDetailPage({
  params,
}: {
  params: Promise<{ orgSlug: string; slug: string; id: string }>;
}) {
  const { id, orgSlug } = await params;
  const userId = await getCurrentUserId();

  let storyboard: StoryboardDto;
  try {
    storyboard = await apiClient<StoryboardDto>(`/api/storyboards/${id}`, {
      userId,
    });
  } catch {
    notFound();
  }

  return (
    <div className="-m-6 h-[calc(100%+3rem)]">
      <StoryboardEditor
        storyboardId={storyboard.id}
        userId={userId}
        initialContent={storyboard.content}
        initialContentVersion={storyboard.contentVersion}
        storyboardName={storyboard.name}
        orgSlug={orgSlug}
      />
    </div>
  );
}
