import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";
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

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Boardinary</CardTitle>
          <CardDescription>
            게임 스토리보드를 설계하고 협업하세요
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* OAuth Providers */}
          <form
            action={async () => {
              "use server";
              await signIn("google", { redirectTo: "/dashboard" });
            }}
          >
            <Button variant="outline" className="w-full" type="submit">
              Google로 계속하기
            </Button>
          </form>

          <form
            action={async () => {
              "use server";
              await signIn("github", { redirectTo: "/dashboard" });
            }}
          >
            <Button variant="outline" className="w-full" type="submit">
              GitHub로 계속하기
            </Button>
          </form>

          <div className="relative">
            <Separator />
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground">
              또는
            </span>
          </div>

          {/* Magic Link */}
          <form
            action={async (formData: FormData) => {
              "use server";
              const email = formData.get("email") as string;
              await signIn("resend", { email, redirectTo: "/dashboard" });
            }}
            className="space-y-2"
          >
            <Label htmlFor="email">이메일</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="your@email.com"
              required
            />
            <Button className="w-full" type="submit">
              매직 링크로 로그인
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
