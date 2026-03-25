export interface StoryboardDto {
  id: string;
  projectId: string;
  createdBy: string | null;
  updatedBy: string | null;
  name: string;
  description: string | null;
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

export interface UpdateStoryboardDto {
  name?: string;
  description?: string;
  genre?: string;
  tags?: string[];
}
