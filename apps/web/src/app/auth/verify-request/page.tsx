import Link from "next/link";
import { Mail, Monitor, Smartphone, Tablet } from "lucide-react";
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
      <div className="w-full max-w-md space-y-6">
        {/* Logo */}
        <div className="text-center">
          <Link href="/">
            <h1 className="text-3xl font-bold text-primary">Boardinary</h1>
          </Link>
        </div>

        <Card className="text-center">
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
            {/* Cross-device info */}
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
              <p className="mb-3 text-sm font-medium text-foreground">
                어떤 기기에서든 로그인할 수 있습니다
              </p>
              <div className="flex items-center justify-center gap-6 text-muted-foreground">
                <div className="flex flex-col items-center gap-1">
                  <Monitor className="h-5 w-5" />
                  <span className="text-xs">PC</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <Tablet className="h-5 w-5" />
                  <span className="text-xs">태블릿</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <Smartphone className="h-5 w-5" />
                  <span className="text-xs">모바일</span>
                </div>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                이메일의 로그인 링크를 원하는 기기의 브라우저에서 열어주세요.
                <br />
                현재 브라우저가 아닌 다른 브라우저에서도 사용 가능합니다.
              </p>
            </div>

            {/* Spam notice */}
            <div className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
              메일이 보이지 않으면 스팸함을 확인해주세요.
              <br />
              링크는 발송 후 24시간 동안 유효하며, 한 번만 사용 가능합니다.
            </div>

            <Button variant="outline" asChild className="w-full">
              <Link href="/login">다른 방법으로 로그인하기</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
