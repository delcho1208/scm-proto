import { createFileRoute } from "@tanstack/react-router";
import { ScmShell } from "@/components/ScmShell";
import { DashboardView } from "@/components/DashboardView";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Digital Twin SCM Portal — 통합 모니터링" },
      {
        name: "description",
        content:
          "실시간 공급망 가시성 대시보드: 권역별 재고, 수요 예측, 리스크 지수와 AI 추천 실행안을 한 화면에서 모니터링합니다.",
      },
      { property: "og:title", content: "Digital Twin SCM Portal — 통합 모니터링" },
      {
        property: "og:description",
        content: "권역별 재고와 수요 예측, 리스크 지수를 한 화면에서 모니터링하는 SCM 대시보드.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <ScmShell>{(product) => <DashboardView product={product} />}</ScmShell>,
});
