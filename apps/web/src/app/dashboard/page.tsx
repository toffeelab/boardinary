import { redirect } from "next/navigation";
import { getCurrentUserId } from "@/lib/auth";
import { apiClient } from "@/lib/api-client";
import type { OrganizationWithRoleDto } from "@repo/types";

export default async function DashboardPage() {
  const userId = await getCurrentUserId();
  const orgs = await apiClient<OrganizationWithRoleDto[]>(
    "/api/organizations",
    { userId },
  );
  const personalOrg = orgs.find((o) => o.isPersonal);

  if (personalOrg) {
    redirect(`/dashboard/${personalOrg.slug}`);
  }

  if (orgs.length > 0) {
    redirect(`/dashboard/${orgs[0]!.slug}`);
  }

  return (
    <div className="flex items-center justify-center py-16">
      <p className="text-muted-foreground">워크스페이스를 초기화하는 중...</p>
    </div>
  );
}
