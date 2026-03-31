export interface BlueprintDto {
  id: string;
  type: "preset" | "flow" | "template";
  scope: "personal" | "organization" | "project";
  createdBy: string;
  orgId: string | null;
  projectId: string | null;
  name: string;
  description: string | null;
  content: Record<string, unknown>;
  contentVersion: number;
  tags: string[] | null;
  icon: string | null;
  color: string | null;
  createdAt: string;
  updatedAt: string;
}

export type BlueprintMetaDto = Omit<BlueprintDto, "content">;

export interface CreateBlueprintDto {
  type: "preset" | "flow";
  scope: "personal" | "organization";
  orgId?: string;
  name: string;
  description?: string;
  content: Record<string, unknown>;
  tags?: string[];
  icon?: string;
  color?: string;
}

export interface UpdateBlueprintDto {
  name?: string;
  description?: string;
  content?: Record<string, unknown>;
  tags?: string[];
  icon?: string;
  color?: string;
}
