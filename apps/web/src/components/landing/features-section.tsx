import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Workflow, Users, Sparkles, GitBranch } from "lucide-react";

const features = [
  {
    icon: Workflow,
    title: "비주얼 스토리보드",
    description:
      "드래그 앤 드롭으로 게임 흐름을 설계하세요. 씬, 이벤트, 분기를 시각적으로 연결합니다.",
  },
  {
    icon: Users,
    title: "실시간 협업",
    description:
      "팀원과 동시에 스토리보드를 편집하세요. 변경 사항이 즉시 반영됩니다.",
  },
  {
    icon: GitBranch,
    title: "버전 관리",
    description:
      "모든 변경 이력을 추적하고, 이전 버전으로 손쉽게 되돌릴 수 있습니다.",
  },
  {
    icon: Sparkles,
    title: "AI 어시스턴트",
    description:
      "AI가 스토리 흐름을 분석하고, 누락된 요소를 찾아 개선점을 제안합니다.",
  },
];

export function FeaturesSection() {
  return (
    <section className="mx-auto max-w-5xl px-6 py-16">
      <h2 className="mb-12 text-center text-3xl font-bold">
        게임 기획을 위한 모든 것
      </h2>
      <div className="grid gap-6 sm:grid-cols-2">
        {features.map((feature) => (
          <Card key={feature.title}>
            <CardHeader>
              <feature.icon className="mb-2 h-8 w-8 text-primary" />
              <CardTitle>{feature.title}</CardTitle>
              <CardDescription>{feature.description}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>
    </section>
  );
}
