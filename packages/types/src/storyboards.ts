export interface StoryboardDto {
  id: string;
  projectId: string;
  createdBy: string | null;
  updatedBy: string | null;
  name: string;
  description: string | null;
  /** Always becomes StoryboardContentV1 after migration. Typed as Record for API backward compat. */
  content: Record<string, unknown>;
  contentVersion: number;
  genre: string | null;
  tags: string[] | null;
  status: "draft" | "published" | "archived";
  createdAt: string;
  updatedAt: string;
}

export type StoryboardMetaDto = Omit<StoryboardDto, "content">;

export interface CreateStoryboardDto {
  name: string;
  description?: string;
  genre?: string;
}

export interface StoryboardNodeData {
  title: string;
  description?: string;
  tags?: string[];
  color?: string;
  choices?: Array<{ id: string; label: string }>;
}

export interface StoryboardNode {
  id: string;
  type: "scene" | "event" | "branch" | "group";
  position: { x: number; y: number };
  width?: number;
  height?: number;
  parentId?: string;
  data: StoryboardNodeData;
}

export interface StoryboardEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  label?: string;
}

export interface StoryboardContentV1 {
  version: 1;
  viewport: { x: number; y: number; zoom: number };
  nodes: StoryboardNode[];
  edges: StoryboardEdge[];
}

export interface UpdateStoryboardDto {
  name?: string;
  description?: string;
  genre?: string;
  tags?: string[];
  content?: StoryboardContentV1;
  contentVersion?: number;
}
