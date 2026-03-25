import Link from "next/link";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function VerifyRequestPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader className="pb-4">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Mail className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold">
            이메일을 확인해주세요
          </CardTitle>
          <CardDescription className="text-base">
            로그인 링크가 이메일로 전송되었습니다.
            <br />
            메일함을 확인하고 링크를 클릭해주세요.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">
            메일이 보이지 않으면 스팸함을 확인해주세요.
            <br />
            링크는 발송 후 24시간 동안 유효합니다.
          </div>
          <Button variant="outline" asChild className="w-full">
            <Link href="/login">로그인 페이지로 돌아가기</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
