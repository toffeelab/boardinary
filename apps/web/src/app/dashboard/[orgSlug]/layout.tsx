import { notFound } from "next/navigation";
import { getCurrentUserId } from "@/lib/auth";
import {
  getOrganizationsByUserId,
  getOrganizationBySlug,
  isOrgMember,
} from "@/data-access/organizations";
import { getProjectsByOrgId } from "@/data-access/projects";
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

  const org = await getOrganizationBySlug(orgSlug);
  if (!org) notFound();

  const isMember = await isOrgMember(org.id, userId);
  if (!isMember) notFound();

  const orgs = await getOrganizationsByUserId(userId);
  const projects = await getProjectsByOrgId(org.id);

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
