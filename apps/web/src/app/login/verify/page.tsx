import { cookies } from "next/headers";
import Link from "next/link";
import { Mail, KeyRound } from "lucide-react";
import { verifyTokenAction } from "@/actions/verify-token-action";
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

        {/* Main card */}
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <Mail className="h-7 w-7 text-primary" />
            </div>
            <CardTitle className="text-xl">이메일을 확인해주세요</CardTitle>
            <CardDescription>
              {email ? (
                <>
                  <span className="font-medium text-foreground">{email}</span>
                  로 로그인 링크를 보냈습니다.
                </>
              ) : (
                "로그인 링크가 이메일로 전송되었습니다."
              )}
            </CardDescription>
          </CardHeader>

          {email && (
            <CardContent className="space-y-4">
              {/* Token input — primary action */}
              <form
                action={verifyTokenAction}
                className="space-y-3"
              >
                <div className="space-y-2">
                  <Label htmlFor="token" className="flex items-center gap-1.5 text-sm font-medium">
                    <KeyRound className="h-3.5 w-3.5" />
                    인증 코드
                  </Label>
                  <Input
                    id="token"
                    name="token"
                    type="text"
                    placeholder="이메일의 인증 코드를 붙여넣으세요"
                    required
                    autoComplete="off"
                    className="h-11 font-mono text-center tracking-wider"
                  />
                </div>
                <Button type="submit" className="w-full">
                  인증하기
                </Button>
              </form>

              <p className="text-center text-xs text-muted-foreground">
                이메일에서 링크를 직접 클릭해도 로그인됩니다.
                <br />
                다른 브라우저나 기기에서도 사용 가능합니다.
              </p>
            </CardContent>
          )}

          {!email && (
            <CardContent>
              <p className="text-center text-sm text-muted-foreground">
                메일함을 확인하고 링크를 클릭해주세요.
              </p>
            </CardContent>
          )}
        </Card>

        {/* Bottom info */}
        <div className="space-y-3 text-center">
          <p className="text-xs text-muted-foreground">
            메일이 보이지 않으면 스팸함을 확인해주세요.
            <br />
            링크는 24시간 유효, 한 번만 사용 가능합니다.
          </p>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/login">다른 방법으로 로그인하기</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
