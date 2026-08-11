export type ScenarioMetrics = {
  id: string;
  serviceRatePct: number;
  totalUnmetDemand: number;
  shortageWeeks: number;
  minimumRegionalServiceRatePct: number;
  emergencyProcurementQuantity: number;
  totalProcurementCostKrw: number;
  constraintPassed?: boolean;
};

export type ScenarioExclusion = {
  scenarioId: string;
  reason: string;
  valid: boolean;
};

export type ScenarioRecommendation = {
  recommendedScenarioId: string | null;
  recommendationTitle: string;
  decisionReasons: string[];
  excludedScenarios: ScenarioExclusion[];
  appliedRuleIds: string[];
};

export type HitlStatus = "pending" | "approved" | "held";
export type ExecutionStatus = "locked" | "ready" | "executed";
export type FeedbackStatus = "locked" | "ready";
export type WorkflowRuntimeStatus =
  | "verified"
  | "available"
  | "review_required"
  | "approval_pending"
  | "approved"
  | "held"
  | "locked"
  | "executed";

export type WorkflowRunState = {
  runId: string;
  currentStep: number;
  completedSteps: number[];
  blockedSteps: number[];
  stepStatuses: Record<number, WorkflowRuntimeStatus>;
  recommendation: ScenarioRecommendation | null;
  hitlStatus: HitlStatus;
  executionStatus: ExecutionStatus;
  feedbackStatus: FeedbackStatus;
  lastUpdatedAt: string;
};

export type WorkflowRunInput = {
  runId: string;
  scenarios: ScenarioMetrics[];
  dataReady: boolean;
  qualityProcessed: boolean;
  analysisAvailable: boolean;
  modelValidated: boolean;
  simulationReady: boolean;
  hitlStatus: HitlStatus;
  executionStatus: ExecutionStatus;
  kpiConfirmed?: boolean;
  lastUpdatedAt: string;
};

const recommendationRuleIds = [
  "RULE-RECOMMEND-VALID-001",
  "RULE-RECOMMEND-UNMET-001",
  "RULE-RECOMMEND-SHORTAGE-001",
  "RULE-RECOMMEND-MIN-SERVICE-001",
  "RULE-RECOMMEND-COST-001",
];

function getScenarioLabel(scenarioId: string): string {
  return scenarioId.replace("_", " ");
}

function getValidationIssues(scenario: ScenarioMetrics): string[] {
  const numericEntries: Array<[string, number]> = [
    ["서비스율", scenario.serviceRatePct],
    ["미충족 수요", scenario.totalUnmetDemand],
    ["부족 주차", scenario.shortageWeeks],
    ["최저 권역 서비스율", scenario.minimumRegionalServiceRatePct],
    ["추가 조달", scenario.emergencyProcurementQuantity],
    ["비용", scenario.totalProcurementCostKrw],
  ];
  const issues = numericEntries
    .filter(([, value]) => !Number.isFinite(value) || value < 0)
    .map(([label]) => `${label} 값 오류`);

  if (scenario.serviceRatePct > 100) issues.push("서비스율 범위 오류");
  if (scenario.minimumRegionalServiceRatePct > 100) issues.push("최저 권역 서비스율 범위 오류");
  if (scenario.constraintPassed === false) issues.push("제약 평가 미통과");

  return issues;
}

export function isScenarioValid(scenario: ScenarioMetrics): boolean {
  return getValidationIssues(scenario).length === 0;
}

function compareScenarios(a: ScenarioMetrics, b: ScenarioMetrics): number {
  return (
    a.totalUnmetDemand - b.totalUnmetDemand ||
    a.shortageWeeks - b.shortageWeeks ||
    b.minimumRegionalServiceRatePct - a.minimumRegionalServiceRatePct ||
    a.totalProcurementCostKrw - b.totalProcurementCostKrw ||
    a.id.localeCompare(b.id, "ko")
  );
}

function getExclusionReason(scenario: ScenarioMetrics, recommended: ScenarioMetrics): string {
  const issues = getValidationIssues(scenario);
  if (issues.length > 0) return `유효성 제외: ${issues.join(" · ")}`;
  if (scenario.totalUnmetDemand > recommended.totalUnmetDemand) {
    return `미충족 수요 ${Math.round(scenario.totalUnmetDemand).toLocaleString("ko-KR")} > ${Math.round(recommended.totalUnmetDemand).toLocaleString("ko-KR")}`;
  }
  if (scenario.shortageWeeks > recommended.shortageWeeks) {
    return `부족 주차 ${scenario.shortageWeeks}주 > ${recommended.shortageWeeks}주`;
  }
  if (scenario.minimumRegionalServiceRatePct < recommended.minimumRegionalServiceRatePct) {
    return `최저 권역 서비스율 ${scenario.minimumRegionalServiceRatePct.toFixed(2)}% < ${recommended.minimumRegionalServiceRatePct.toFixed(2)}%`;
  }
  if (scenario.totalProcurementCostKrw > recommended.totalProcurementCostKrw) {
    return "상위 공급 안정성 조건이 동일하고 조달비가 더 높음";
  }
  return "정의된 우선순위와 시나리오 ID 동률 해소 규칙에 따라 후순위";
}

export function selectRecommendedScenario(scenarios: ScenarioMetrics[]): ScenarioRecommendation {
  const comparisonScenarios = scenarios.filter((scenario) => /^S[1-3](?:_|$)/.test(scenario.id));
  const validScenarios = comparisonScenarios.filter(isScenarioValid).sort(compareScenarios);
  const recommended = validScenarios[0];

  if (!recommended) {
    return {
      recommendedScenarioId: null,
      recommendationTitle: "권고안 산출 불가",
      decisionReasons: ["유효한 S1~S3 시뮬레이션 결과가 없습니다."],
      excludedScenarios: comparisonScenarios.map((scenario) => ({
        scenarioId: scenario.id,
        reason: `유효성 제외: ${getValidationIssues(scenario).join(" · ")}`,
        valid: false,
      })),
      appliedRuleIds: recommendationRuleIds,
    };
  }

  return {
    recommendedScenarioId: recommended.id,
    recommendationTitle: getScenarioLabel(recommended.id),
    decisionReasons: [
      `미충족 수요 ${Math.round(recommended.totalUnmetDemand).toLocaleString("ko-KR")} 수요 환산단위`,
      `부족 발생 ${recommended.shortageWeeks}주`,
      `최저 권역 서비스율 ${recommended.minimumRegionalServiceRatePct.toFixed(2)}%`,
      `동률 시 총 조달비가 낮은 시나리오 우선`,
    ],
    excludedScenarios: comparisonScenarios
      .filter((scenario) => scenario.id !== recommended.id)
      .map((scenario) => ({
        scenarioId: scenario.id,
        reason: getExclusionReason(scenario, recommended),
        valid: isScenarioValid(scenario),
      })),
    appliedRuleIds: recommendationRuleIds,
  };
}

export function createWorkflowRunState(input: WorkflowRunInput): WorkflowRunState {
  const recommendation = input.simulationReady ? selectRecommendedScenario(input.scenarios) : null;
  const hasRecommendation = Boolean(recommendation?.recommendedScenarioId);
  const stepStatuses: Record<number, WorkflowRuntimeStatus> = {
    1: input.dataReady ? "verified" : "review_required",
    2:
      input.dataReady && input.qualityProcessed
        ? "verified"
        : input.dataReady
          ? "review_required"
          : "locked",
    3: input.analysisAvailable ? "verified" : "review_required",
    4: input.modelValidated ? "verified" : "locked",
    5: input.simulationReady ? "verified" : "locked",
    6: hasRecommendation ? "verified" : "locked",
    7: hasRecommendation ? "verified" : "locked",
    8:
      input.hitlStatus === "approved"
        ? "approved"
        : input.hitlStatus === "held"
          ? "held"
          : hasRecommendation
            ? "approval_pending"
            : "locked",
    9:
      input.executionStatus === "executed"
        ? "executed"
        : input.hitlStatus === "approved"
          ? "available"
          : "locked",
    10: input.kpiConfirmed
      ? "verified"
      : input.executionStatus === "executed"
        ? "available"
        : "locked",
  };

  const completedSteps = Object.entries(stepStatuses)
    .filter(([, status]) => ["verified", "approved", "executed"].includes(status))
    .map(([step]) => Number(step));
  const blockedSteps = Object.entries(stepStatuses)
    .filter(([, status]) => status === "locked")
    .map(([step]) => Number(step));

  let currentStep = 8;
  if (!input.dataReady) currentStep = 1;
  else if (!input.qualityProcessed) currentStep = 2;
  else if (!input.analysisAvailable) currentStep = 3;
  else if (!input.modelValidated) currentStep = 4;
  else if (!input.simulationReady) currentStep = 5;
  else if (!hasRecommendation) currentStep = 6;
  else if (input.hitlStatus === "held") currentStep = 8;
  else if (input.hitlStatus === "approved") currentStep = 9;
  if (input.executionStatus === "executed") currentStep = 10;

  return {
    runId: input.runId,
    currentStep,
    completedSteps,
    blockedSteps,
    stepStatuses,
    recommendation,
    hitlStatus: input.hitlStatus,
    executionStatus: input.executionStatus,
    feedbackStatus: input.executionStatus === "executed" ? "ready" : "locked",
    lastUpdatedAt: input.lastUpdatedAt,
  };
}
