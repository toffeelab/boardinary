import { auth } from "@/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { User } from "lucide-react";

export default async function SettingsPage() {
  const session = await auth();
  const user = session?.user;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">설정</h1>

      {/* 프로필 */}
      <Card>
        <CardHeader>
          <CardTitle>프로필</CardTitle>
          <CardDescription>계정 정보를 확인합니다.</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-4">
          <Avatar className="h-16 w-16">
            <AvatarImage src={user?.image ?? undefined} />
            <AvatarFallback>
              <User className="h-8 w-8" />
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="text-lg font-medium">{user?.name ?? "사용자"}</p>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
          </div>
        </CardContent>
      </Card>

      {/* 테마 */}
      <Card>
        <CardHeader>
          <CardTitle>테마</CardTitle>
          <CardDescription>라이트/다크 모드를 전환합니다.</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-4">
          <ThemeToggle />
          <span className="text-sm text-muted-foreground">
            시스템 설정에 따라 자동 전환되거나, 수동으로 전환할 수 있습니다.
          </span>
        </CardContent>
      </Card>
    </div>
  );
}
