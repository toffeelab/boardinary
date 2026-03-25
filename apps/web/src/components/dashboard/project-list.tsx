import Link from "next/link";
import { FolderOpen } from "lucide-react";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface ProjectItem {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  updatedAt: Date;
}

interface ProjectListProps {
  projects: ProjectItem[];
  orgSlug: string;
}

export function ProjectList({ projects, orgSlug }: ProjectListProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {projects.map((project) => (
        <Link
          key={project.id}
          href={`/dashboard/${orgSlug}/projects/${project.slug}`}
        >
          <Card className="transition-colors hover:border-primary/50">
            <CardHeader>
              <div className="flex items-center gap-2">
                <FolderOpen className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">{project.name}</CardTitle>
              </div>
              {project.description && (
                <CardDescription className="line-clamp-2">
                  {project.description}
                </CardDescription>
              )}
            </CardHeader>
          </Card>
        </Link>
      ))}
    </div>
  );
}
