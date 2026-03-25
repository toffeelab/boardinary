import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { HeroSection } from "@/components/landing/hero-section";
import { FeaturesSection } from "@/components/landing/features-section";
import { CtaSection } from "@/components/landing/cta-section";
import { ThemeToggle } from "@/components/shared/theme-toggle";

export default async function Home() {
  const session = await auth();
  if (session?.user) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between px-6 py-4">
        <span className="text-xl font-bold text-primary">Boardinary</span>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link
            href="/login"
            className="text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            로그인
          </Link>
        </div>
      </header>
      <HeroSection />
      <FeaturesSection />
      <CtaSection />
      <footer className="px-6 py-8 text-center text-sm text-muted-foreground">
        &copy; 2026 Boardinary. All rights reserved.
      </footer>
    </div>
  );
}
