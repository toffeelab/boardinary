import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const ERROR_MESSAGES: Record<string, { title: string; description: string }> = {
  Configuration: {
    title: "서버 설정 오류",
    description: "인증 서버 설정에 문제가 있습니다. 관리자에게 문의해주세요.",
  },
  AccessDenied: {
    title: "접근이 거부되었습니다",
    description: "이 계정으로는 로그인할 수 없습니다.",
  },
  Verification: {
    title: "링크가 만료되었습니다",
    description:
      "매직 링크가 이미 사용되었거나 만료되었습니다. 다시 로그인해주세요.",
  },
  Default: {
    title: "로그인 중 오류가 발생했습니다",
    description: "잠시 후 다시 시도해주세요.",
  },
};

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const errorInfo = ERROR_MESSAGES[error ?? "Default"] ?? ERROR_MESSAGES["Default"]!;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader className="pb-4">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>
          <CardTitle className="text-2xl font-bold">
            {errorInfo.title}
          </CardTitle>
          <CardDescription className="text-base">
            {errorInfo.description}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="w-full">
            <Link href="/login">다시 로그인하기</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
