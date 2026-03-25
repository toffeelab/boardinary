export interface OrganizationDto {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  ownerId: string;
  isPersonal: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationWithRoleDto extends OrganizationDto {
  role: "owner" | "admin" | "member";
}

export interface SetupUserDto {
  userId: string;
  name: string | null;
}
