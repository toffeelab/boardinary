import { fetchBlueprintById } from "@/actions/blueprint-actions";
import { StoryboardEditor } from "@/components/storyboard/editor";
import { notFound } from "next/navigation";

export default async function BlueprintEditPage({
  params,
}: {
  params: Promise<{ orgSlug: string; id: string }>;
}) {
  const { id } = await params;
  let blueprint;
  try {
    blueprint = await fetchBlueprintById(id);
  } catch {
    notFound();
  }

  return (
    <div className="flex h-full flex-col">
      <StoryboardEditor
        mode="blueprint"
        blueprintId={blueprint.id}
        blueprintName={blueprint.name}
        initialContent={blueprint.content as Record<string, unknown>}
        contentVersion={blueprint.contentVersion}
      />
    </div>
  );
}
