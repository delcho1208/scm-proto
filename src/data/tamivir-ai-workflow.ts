import type {
  ExecutionStatus,
  HitlStatus,
  WorkflowRunState,
  WorkflowRuntimeStatus,
} from "@/services/scm-workflow-orchestrator";

type TamivirWorkflowRunInput = {
  hitlStatus: HitlStatus;
  executionStatus: ExecutionStatus;
  lastUpdatedAt: string;
};

const TAMIVIR_RUN_ID = "SCM-TAMI-20261115-001";

/**
 * 타미비어 S2(신규 발주 보류·핀셋 생산 감축) 전용 Workflow 상태 계산.
 * 상태 전이 구조는 공통 10단계를 따르되, 세파졸린 부족 대응 추천 규칙에는 의존하지 않는다.
 */
export function getTamivirWorkflowRunState({
  hitlStatus,
  executionStatus,
  lastUpdatedAt,
}: TamivirWorkflowRunInput): WorkflowRunState {
  const stepStatuses: Record<number, WorkflowRuntimeStatus> = {
    1: "verified",
    2: "verified",
    3: "verified",
    4: "verified",
    5: "verified",
    6: "verified",
    7: "verified",
    8:
      hitlStatus === "approved"
        ? "approved"
        : hitlStatus === "held"
          ? "held"
          : "approval_pending",
    9:
      executionStatus === "executed"
        ? "executed"
        : hitlStatus === "approved"
          ? "available"
          : "locked",
    10: executionStatus === "executed" ? "available" : "locked",
  };

  const completedSteps = Object.entries(stepStatuses)
    .filter(([, status]) => ["verified", "approved", "executed"].includes(status))
    .map(([step]) => Number(step));

  const blockedSteps = Object.entries(stepStatuses)
    .filter(([, status]) => status === "locked")
    .map(([step]) => Number(step));

  let currentStep = 8;
  if (hitlStatus === "held") currentStep = 8;
  else if (hitlStatus === "approved") currentStep = 9;
  if (executionStatus === "executed") currentStep = 10;

  return {
    runId: TAMIVIR_RUN_ID,
    currentStep,
    completedSteps,
    blockedSteps,
    stepStatuses,
    recommendation: {
      recommendedScenarioId: "S2_내부대응",
      recommendationTitle: "S2 핀셋 감축",
      decisionReasons: [
        "현재 전국 재고 1,280,777 EA · AI 목표 90,785 EA · 재고 비율 14.1배",
        "S2 적용 후 예상 재고 745,570 EA",
        "S2 적용 후 잔여 과잉재고 654,785 EA",
        "S2 위험점수 45 · 예상 비용 18~22% 절감 · 실행가능성 94%",
      ],
      excludedScenarios: [],
      appliedRuleIds: ["RULE-TAMI-RECOMMEND-001"],
    },
    hitlStatus,
    executionStatus,
    feedbackStatus: executionStatus === "executed" ? "ready" : "locked",
    lastUpdatedAt,
  };
}
