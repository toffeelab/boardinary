export interface ProjectDto {
  id: string;
  orgId: string;
  name: string;
  description: string | null;
  slug: string;
  status: "active" | "archived";
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectDto {
  name: string;
  description?: string;
}

export interface UpdateProjectDto {
  name?: string;
  description?: string;
}
