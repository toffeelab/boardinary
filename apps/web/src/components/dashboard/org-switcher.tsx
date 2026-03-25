"use client";

import { useRouter } from "next/navigation";
import { Building2, ChevronDown, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface OrgItem {
  id: string;
  name: string;
  slug: string;
  isPersonal: boolean;
}

interface OrgSwitcherProps {
  organizations: OrgItem[];
  currentOrgSlug: string;
}

export function OrgSwitcher({ organizations, currentOrgSlug }: OrgSwitcherProps) {
  const router = useRouter();
  const currentOrg = organizations.find((o) => o.slug === currentOrgSlug);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="w-full justify-between px-3">
          <div className="flex items-center gap-2 truncate">
            <Building2 className="h-4 w-4 shrink-0" />
            <span className="truncate text-sm font-medium">
              {currentOrg?.name ?? "조직 선택"}
            </span>
          </div>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {organizations.map((org) => (
          <DropdownMenuItem
            key={org.id}
            onClick={() => router.push(`/dashboard/${org.slug}`)}
            className={org.slug === currentOrgSlug ? "bg-accent" : ""}
          >
            <Building2 className="mr-2 h-4 w-4" />
            <span className="truncate">{org.name}</span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled>
          <Plus className="mr-2 h-4 w-4" />
          새 조직 (추후 지원)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
