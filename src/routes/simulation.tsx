import { createFileRoute } from "@tanstack/react-router";
import { ScmShell } from "@/components/ScmShell";
import { DashboardView } from "@/components/DashboardView";

export const Route = createFileRoute("/simulation")({
  head: () => ({
    meta: [
      { title: "시뮬레이션 — Digital Twin SCM Portal" },
      {
        name: "description",
        content:
          "디지털 트윈 기반 공급망 시뮬레이션: 권역 선택에 따른 재고, 수요 예측, 리스크 시나리오를 확인합니다.",
      },
      { property: "og:title", content: "시뮬레이션 — Digital Twin SCM Portal" },
      {
        property: "og:description",
        content: "권역별 수요·재고 시나리오를 디지털 트윈으로 시뮬레이션합니다.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <ScmShell>{(product) => <DashboardView product={product} />}</ScmShell>,
});
