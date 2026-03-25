import Link from "next/link";
import { Button } from "@/components/ui/button";

export function CtaSection() {
  return (
    <section className="px-6 py-16 text-center">
      <h2 className="text-2xl font-bold">지금 바로 시작하세요</h2>
      <p className="mt-2 text-muted-foreground">
        무료로 시작하고, 팀과 함께 성장하세요.
      </p>
      <Button asChild size="lg" className="mt-6">
        <Link href="/login">무료로 시작하기</Link>
      </Button>
    </section>
  );
}
