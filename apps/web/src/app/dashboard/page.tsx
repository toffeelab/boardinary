import { redirect } from "next/navigation";
import { getCurrentUserId } from "@/lib/auth";
import { getPersonalOrganization } from "@/data-access/organizations";

export default async function DashboardPage() {
  const userId = await getCurrentUserId();
  const personalOrg = await getPersonalOrganization(userId);

  if (personalOrg) {
    redirect(`/dashboard/${personalOrg.slug}`);
  }

  // 개인 조직이 없는 경우 (비정상 상태)
  return (
    <div className="flex items-center justify-center py-16">
      <p className="text-muted-foreground">워크스페이스를 초기화하는 중...</p>
    </div>
  );
}
