import { createFileRoute } from "@tanstack/react-router";
import { ScmShell } from "@/components/ScmShell";
import { CefazolinDecisionExecutionView } from "@/components/CefazolinDecisionExecutionView";

export const Route = createFileRoute("/decision-execution")({
  head: () => ({
    meta: [
      { title: "의사결정 실행 — Digital Twin SCM Portal" },
      {
        name: "description",
        content: "공급망 사건의 영향, 대응 시나리오, 승인 및 시스템 실행지시를 관리합니다.",
      },
    ],
  }),
  component: () => (
    <ScmShell>{(product) => <CefazolinDecisionExecutionView product={product} />}</ScmShell>
  ),
});
