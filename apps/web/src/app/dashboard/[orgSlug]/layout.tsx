import { notFound } from "next/navigation";
import { getCurrentUserId } from "@/lib/auth";
import { apiClient } from "@/lib/api-client";
import type {
  OrganizationWithRoleDto,
  OrganizationDto,
  ProjectDto,
} from "@repo/types";
import { Sidebar } from "@/components/dashboard/sidebar";

export default async function OrgLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const userId = await getCurrentUserId();

  try {
    await apiClient<OrganizationDto>(
      `/api/organizations/${orgSlug}`,
      { userId },
    );
  } catch {
    notFound();
  }

  const orgs = await apiClient<OrganizationWithRoleDto[]>(
    "/api/organizations",
    { userId },
  );
  const projects = await apiClient<ProjectDto[]>(
    `/api/organizations/${orgSlug}/projects`,
    { userId },
  );

  return (
    <div className="flex flex-1 overflow-hidden">
      <Sidebar
        organizations={orgs.map((o) => ({
          id: o.id,
          name: o.name,
          slug: o.slug,
          isPersonal: o.isPersonal,
        }))}
        currentOrgSlug={orgSlug}
        projects={projects.map((p) => ({
          id: p.id,
          name: p.name,
          slug: p.slug,
        }))}
      />
      <main className="flex-1 overflow-y-auto p-6">{children}</main>
    </div>
  );
}
