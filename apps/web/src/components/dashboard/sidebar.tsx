import Link from "next/link";
import { FolderOpen, Settings, LayoutDashboard } from "lucide-react";
import { OrgSwitcher } from "./org-switcher";
import { Separator } from "@/components/ui/separator";

interface ProjectItem {
  id: string;
  name: string;
  slug: string;
}

interface OrgItem {
  id: string;
  name: string;
  slug: string;
  isPersonal: boolean;
}

interface SidebarProps {
  organizations: OrgItem[];
  currentOrgSlug: string;
  projects: ProjectItem[];
}

export function Sidebar({ organizations, currentOrgSlug, projects }: SidebarProps) {
  return (
    <aside className="flex h-full w-64 flex-col border-r border-sidebar-border bg-sidebar-background">
      {/* 조직 전환 */}
      <div className="p-3">
        <OrgSwitcher
          organizations={organizations}
          currentOrgSlug={currentOrgSlug}
        />
      </div>

      <Separator />

      {/* 네비게이션 */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        <Link
          href={`/dashboard/${currentOrgSlug}`}
          className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent"
        >
          <LayoutDashboard className="h-4 w-4" />
          대시보드
        </Link>

        <div className="pt-4">
          <p className="mb-2 px-3 text-xs font-semibold uppercase text-muted-foreground">
            프로젝트
          </p>
          {projects.map((project) => (
            <Link
              key={project.id}
              href={`/dashboard/${currentOrgSlug}/projects/${project.slug}`}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent"
            >
              <FolderOpen className="h-4 w-4" />
              <span className="truncate">{project.name}</span>
            </Link>
          ))}
        </div>
      </nav>

      <Separator />

      {/* 하단 설정 */}
      <div className="p-3">
        <Link
          href="/dashboard/settings"
          className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent"
        >
          <Settings className="h-4 w-4" />
          설정
        </Link>
      </div>
    </aside>
  );
}
