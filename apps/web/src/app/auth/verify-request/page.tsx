import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Mail, Monitor, Smartphone, Tablet, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

export default async function VerifyRequestPage() {
  const cookieStore = await cookies();
  const email = cookieStore.get("verify-email")?.value;

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
              {email ? (
                <>
                  <span className="font-medium text-foreground">{email}</span>
                  로 로그인 링크를 보냈습니다.
                </>
              ) : (
                "로그인 링크가 이메일로 전송되었습니다."
              )}
              <br />
              메일함을 확인하고 링크를 클릭하거나, 아래에 인증 코드를 입력해주세요.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Token input for cross-browser login */}
            {email && (
              <>
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                  <div className="mb-3 flex items-center justify-center gap-2">
                    <KeyRound className="h-4 w-4 text-primary" />
                    <p className="text-sm font-medium text-foreground">
                      다른 브라우저에서 열었나요?
                    </p>
                  </div>
                  <p className="mb-3 text-xs text-muted-foreground">
                    이메일의 인증 코드를 복사해서 아래에 붙여넣으세요.
                  </p>
                  <form
                    action={async (formData: FormData) => {
                      "use server";
                      const token = (
                        formData.get("token") as string
                      )?.trim();
                      const cookieStore = await cookies();
                      const storedEmail =
                        cookieStore.get("verify-email")?.value;

                      if (!token || !storedEmail) {
                        redirect("/auth/verify-request");
                      }

                      // Auth.js 콜백 URL 조합
                      const callbackUrl = new URL(
                        "/api/auth/callback/resend",
                        process.env.NEXT_PUBLIC_APP_URL ??
                          "http://localhost:4000",
                      );
                      callbackUrl.searchParams.set("token", token);
                      callbackUrl.searchParams.set("email", storedEmail);
                      callbackUrl.searchParams.set(
                        "callbackUrl",
                        "/dashboard",
                      );

                      // 쿠키 정리
                      cookieStore.delete("verify-email");

                      redirect(callbackUrl.toString());
                    }}
                    className="space-y-2"
                  >
                    <Label htmlFor="token" className="sr-only">
                      인증 코드
                    </Label>
                    <Input
                      id="token"
                      name="token"
                      type="text"
                      placeholder="이메일에서 인증 코드를 붙여넣으세요"
                      required
                      autoComplete="off"
                      className="font-mono text-center text-sm"
                    />
                    <Button type="submit" className="w-full" size="sm">
                      인증하기
                    </Button>
                  </form>
                </div>

                <Separator />
              </>
            )}

            {/* Cross-device info */}
            <div className="flex items-center justify-center gap-6 py-2 text-muted-foreground">
              <div className="flex flex-col items-center gap-1">
                <Monitor className="h-4 w-4" />
                <span className="text-[10px]">PC</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <Tablet className="h-4 w-4" />
                <span className="text-[10px]">태블릿</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <Smartphone className="h-4 w-4" />
                <span className="text-[10px]">모바일</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              어떤 기기에서든 이메일 링크를 클릭하거나 인증 코드를 입력해서 로그인할 수 있습니다.
            </p>

            {/* Spam notice */}
            <div className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
              메일이 보이지 않으면 스팸함을 확인해주세요.
              <br />
              링크는 24시간 유효, 한 번만 사용 가능합니다.
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
