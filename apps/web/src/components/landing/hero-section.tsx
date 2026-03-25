import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export function HeroSection() {
  return (
    <section className="flex flex-col items-center justify-center px-6 py-24 text-center">
      <h1 className="max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
        게임 스토리보드를{" "}
        <span className="text-primary">시각적으로 설계</span>하고{" "}
        <span className="text-primary">팀과 협업</span>하세요
      </h1>
      <p className="mt-6 max-w-xl text-lg text-muted-foreground">
        Boardinary는 게임 기획자를 위한 스토리보드 협업 도구입니다.
        복잡한 게임 흐름을 직관적으로 설계하고, 팀과 실시간으로 작업하세요.
      </p>
      <div className="mt-8 flex gap-4">
        <Button asChild size="lg">
          <Link href="/login">
            시작하기
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>
    </section>
  );
}
