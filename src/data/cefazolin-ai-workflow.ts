import rawDashboard from "@/data/cefazolin-dashboard.json";
import { formatScmQuantity } from "@/data/cefazolin-dashboard";
import {
  createWorkflowRunState,
  isScenarioValid,
  selectRecommendedScenario,
  type ExecutionStatus,
  type HitlStatus,
  type ScenarioMetrics,
} from "@/services/scm-workflow-orchestrator";

export type WorkflowGroup =
  "데이터 준비" | "탐지·영향" | "분석·시뮬레이션" | "의사결정" | "승인·실행";

export type CefazolinWorkflowStep = {
  id: string;
  order: number;
  group: WorkflowGroup;
  title: string;
  shortTitle: string;
  purpose: string;
  description?: string;
  status?: string;
  icon: string;
  ruleIds: string[];
  dataAsOf: string;
  evidence: string[];
  warnings: string[];
  nextAction: string;
  synthetic: true;
};

export type ReadinessCheck = {
  id: string;
  label: string;
  status: "pass" | "warning" | "fail";
  evidence: string;
};

export type ScenarioComparisonRow = ScenarioMetrics & {
  displayId: string;
  response: string;
  baseline: boolean;
  comparisonTarget: boolean;
  constraintPassed: boolean;
};

export type VirtualExecutionAction = {
  id: string;
  actionType: "원료 긴급발주" | "생산계획 재산정" | "재고이동";
  title: string;
  source: string;
  target: string;
  quantity: number | null;
  unit: "API 환산단위" | "완제품 환산단위" | "계획";
  ruleId: string;
  basis: string;
  synthetic: true;
};

const national = rawDashboard.regions.find((region) => region.id === "National");
const regionalRows = rawDashboard.regions.filter((region) => region.id !== "National");
const s1 = rawDashboard.scenarios.find((scenario) => scenario.id === "S1_무대응");
const shortageRegionCount = regionalRows.filter(
  (region) => region.stockStatusCode === "danger",
).length;
const topRiskCauses = [...(national?.policyRisk.causes ?? [])]
  .sort((a, b) => b.score - a.score)
  .slice(0, 3);
const caseId = "CEFA-SUPPLY-20261028-01";

if (!national || !s1) {
  throw new Error("SCM 실행 콘솔 구성에 필요한 전국·S1 데이터가 없습니다.");
}

const expectedSystems = ["ERP", "MES", "WMS"];
const requiredScenarioIds = ["S0_정상", "S1_무대응", "S2_내부대응", "S3_통합대응"];
const integrationDates = [
  ...new Set(rawDashboard.integration.map((record) => record.updatedAt)),
].sort();
const systemSummaries = expectedSystems.map((system) => {
  const records = rawDashboard.integration.filter((record) => record.system === system);
  return {
    system,
    recordCount: records.length,
    syncedCount: records.filter((record) => record.status === "동기화 완료").length,
    dataAsOf: [...new Set(records.map((record) => record.updatedAt))].join(", "),
  };
});
const latestDataAsOf = integrationDates.at(-1) ?? national.policyRisk.asOf;
const systemDateSummary = systemSummaries
  .map((summary) => `${summary.system} ${summary.dataAsOf}`)
  .join(" · ");
const dataAsOfLabel = `${systemDateSummary} · 정책 ${national.policyRisk.asOf}`;
const scenarioIds = rawDashboard.scenarios.map((scenario) => scenario.id);
const modelValidated =
  rawDashboard.modelValidation.trainingRows > 0 &&
  rawDashboard.modelValidation.rocAuc > 0 &&
  rawDashboard.modelValidation.f1 > 0 &&
  rawDashboard.modelValidation.topFeatures.length > 0;
const integrationComplete =
  rawDashboard.integration.length === 24 &&
  systemSummaries.every(
    (summary) =>
      summary.recordCount === regionalRows.length && summary.syncedCount === summary.recordCount,
  );
const regionalDemandComplete =
  regionalRows.length === 8 && rawDashboard.regionalMonthly.length === 96;
const scenariosComplete = requiredScenarioIds.every((scenarioId) =>
  scenarioIds.includes(scenarioId),
);

const requiredNumericValues = [
  rawDashboard.overview.annualForecastDemand,
  rawDashboard.overview.nationalCurrentStock,
  rawDashboard.overview.nationalSafetyStock,
  rawDashboard.overview.nationalTargetStock,
  ...rawDashboard.regions.flatMap((region) => [
    region.currentStock,
    region.safetyStock,
    region.targetStock,
    region.annualForecastDemand,
  ]),
  ...rawDashboard.regionalMonthly.flatMap((row) => [
    row.forecastDemand,
    row.safetyStock,
    row.targetStock,
  ]),
  ...rawDashboard.scenarios.flatMap((scenario) => [
    scenario.serviceRatePct,
    scenario.totalUnmetDemand,
    scenario.shortageWeeks,
    scenario.minimumRegionalServiceRatePct,
    scenario.emergencyProcurementQuantity,
    scenario.totalProcurementCostKrw,
  ]),
];
const numericValuesValid = requiredNumericValues.every(
  (value) => Number.isFinite(value) && value >= 0,
);
const regionalCurrentStockSum = regionalRows.reduce((sum, region) => sum + region.currentStock, 0);
const regionalTargetStockSum = regionalRows.reduce((sum, region) => sum + region.targetStock, 0);
const aggregateMatches =
  Math.abs(regionalCurrentStockSum - national.currentStock) <= 1 &&
  Math.abs(regionalTargetStockSum - national.targetStock) <= 1;
const regionSystemKeyMatches = regionalRows.every((region) =>
  expectedSystems.every((system) =>
    rawDashboard.integration.some(
      (record) => record.regionId === region.id && record.system === system,
    ),
  ),
);
const dataQualityErrorCount = [
  integrationComplete,
  regionSystemKeyMatches,
  regionalRows.length === 8,
  numericValuesValid,
  aggregateMatches,
].filter((passed) => !passed).length;
const dataQualityWarningCount = integrationDates.length > 1 ? 1 : 0;

export const cefazolinReadinessChecks: ReadinessCheck[] = [
  {
    id: "READY-INTEGRATION-001",
    label: "ERP·MES·WMS 완전성",
    status: integrationComplete ? "pass" : "fail",
    evidence: `${rawDashboard.integration.filter((record) => record.status === "동기화 완료").length}/${rawDashboard.integration.length}건 동기화 완료`,
  },
  {
    id: "READY-DEMAND-001",
    label: "8개 권역 × 12개월 수요 데이터",
    status: regionalDemandComplete ? "pass" : "fail",
    evidence: `${regionalRows.length}개 권역 · ${rawDashboard.regionalMonthly.length}건`,
  },
  {
    id: "READY-SCENARIO-001",
    label: "S0~S3 결과 존재",
    status: scenariosComplete ? "pass" : "fail",
    evidence: scenarioIds.join(" · "),
  },
  {
    id: "READY-MODEL-001",
    label: "XGBoost·SHAP 검증 결과",
    status: modelValidated ? "pass" : "fail",
    evidence: `ROC-AUC ${rawDashboard.modelValidation.rocAuc.toFixed(3)} · F1 ${rawDashboard.modelValidation.f1.toFixed(3)}`,
  },
  {
    id: "READY-ASOF-001",
    label: "기준일 일치 여부",
    status: integrationDates.length === 1 ? "pass" : "warning",
    evidence:
      integrationDates.length === 1
        ? integrationDates[0]
        : `${systemDateSummary} · 기준일 차이 확인 필요`,
  },
  {
    id: "READY-NUMERIC-001",
    label: "필수 수치 음수·결측·비정상값",
    status: numericValuesValid ? "pass" : "fail",
    evidence: numericValuesValid
      ? `${requiredNumericValues.length}개 필수 수치 이상 없음`
      : "음수·결측 또는 비정상값 존재",
  },
  {
    id: "READY-AGGREGATE-001",
    label: "전국 집계와 권역 합계 일치",
    status: aggregateMatches ? "pass" : "fail",
    evidence: `현재고 차이 ${Math.abs(regionalCurrentStockSum - national.currentStock).toFixed(3)} · 목표재고 차이 ${Math.abs(regionalTargetStockSum - national.targetStock).toFixed(3)}`,
  },
];

const readinessPassCount = cefazolinReadinessChecks.filter(
  (check) => check.status === "pass",
).length;
const readinessWarningCount = cefazolinReadinessChecks.filter(
  (check) => check.status === "warning",
).length;
const readinessFailureCount = cefazolinReadinessChecks.filter(
  (check) => check.status === "fail",
).length;

export const cefazolinAnalysisReadiness = {
  verdict:
    readinessFailureCount > 0
      ? ("분석 중단" as const)
      : readinessWarningCount > 0
        ? ("조건부 분석 가능" as const)
        : ("분석 가능" as const),
  score: Math.round((readinessPassCount / cefazolinReadinessChecks.length) * 100),
  passedChecks: readinessPassCount,
  warningChecks: readinessWarningCount,
  failedChecks: readinessFailureCount,
  totalChecks: cefazolinReadinessChecks.length,
  scope: "합성 데이터 기반 PoC 패키지",
};

const scenarioResponse: Record<string, string> = {
  S0_정상: "정상 공급 기준선",
  S1_무대응: "확정 기본입고 유지",
  S2_내부대응: "권역 재고 재배분",
  S3_통합대응: "권역 재배분 + 원료 추가 발주",
};

export const cefazolinScenarioComparison: ScenarioComparisonRow[] = rawDashboard.scenarios.map(
  (scenario) => ({
    ...scenario,
    displayId: scenario.id.replace("_", " "),
    response: scenarioResponse[scenario.id] ?? "대응 방식 미정의",
    baseline: scenario.id === "S0_정상",
    comparisonTarget: /^S[1-3](?:_|$)/.test(scenario.id),
    constraintPassed: isScenarioValid(scenario),
  }),
);

export const cefazolinScenarioRecommendation = selectRecommendedScenario(rawDashboard.scenarios);
const recommendedScenario = rawDashboard.scenarios.find(
  (scenario) => scenario.id === cefazolinScenarioRecommendation.recommendedScenarioId,
);

export const cefazolinWorkflowRunMeta = {
  runId: `SCM-CEFA-${latestDataAsOf.replaceAll("-", "")}-001`,
  productName: rawDashboard.product,
  dataAsOf: dataAsOfLabel,
  dataType: "합성 PoC 데이터",
  latestSnapshotDate: latestDataAsOf,
  synthetic: true,
};

export const cefazolinDataCollectionSummary = {
  systems: systemSummaries,
  supplierCount: new Set(rawDashboard.procurement.map((record) => record.supplierId)).size,
  regionalDemandRows: rawDashboard.regionalMonthly.length,
  dataType: "합성 PoC 데이터",
  dataAsOf: dataAsOfLabel,
};

export const cefazolinDataQualitySummary = {
  syncedCount: rawDashboard.integration.filter((record) => record.status === "동기화 완료").length,
  totalCount: rawDashboard.integration.length,
  systemKeyMatches: regionSystemKeyMatches,
  regionKeyNormalized: regionalRows.length === 8,
  requiredNumericValuesValid: numericValuesValid,
  errorCount: dataQualityErrorCount,
  warningCount: dataQualityWarningCount,
  warnings: integrationDates.length > 1 ? [`시스템별 기준일 차이: ${systemDateSummary}`] : [],
};

const supplyRiskCause = national.policyRisk.causes.find((cause) =>
  cause.label.includes("원자재 공급 차질"),
);
const supplyEvidenceRecord = rawDashboard.integration.find(
  (record) => record.system === "ERP" && record.note.includes("공급이행률"),
);
const supplyFulfillmentMatch = supplyEvidenceRecord?.note.match(/공급이행률\s*([\d.]+)%/);
const supplyEventIdMatch = supplyEvidenceRecord?.note.match(/EVT-\d+/);

export const cefazolinDetectionContext = {
  caseId,
  detectedAt: latestDataAsOf,
  directSignal: supplyRiskCause?.label ?? "원자재 공급 상태 이상",
  directSignalScore: supplyRiskCause?.score ?? 0,
  eventId: supplyEventIdMatch?.[0] ?? null,
  supplyFulfillmentPct: supplyFulfillmentMatch ? Number(supplyFulfillmentMatch[1]) : null,
  source: "ERP 공급 배분 · 정책형 수급 위험 신호",
  evidenceNote:
    [
      supplyEventIdMatch?.[0] ?? null,
      supplyEvidenceRecord?.note.includes("부분회복") ? "부분회복 반영" : null,
      supplyFulfillmentMatch ? `공급이행률 ${Number(supplyFulfillmentMatch[1]).toFixed(1)}%` : null,
    ]
      .filter((item): item is string => Boolean(item))
      .join(" · ") || null,
  affectedRegions: regionalRows
    .filter((region) => region.stockStatusCode === "danger")
    .map((region) => region.name),
  synthetic: true as const,
};

const forecastMonths = [...new Set(rawDashboard.regionalMonthly.map((row) => row.month))].sort();

export const cefazolinForecastRiskSummary = {
  forecast: {
    target: "세파졸린 권역별 월간 수요",
    regionCount: regionalRows.length,
    period: `${forecastMonths[0]}~${forecastMonths.at(-1)}`,
    dataAsOf: latestDataAsOf,
  },
  riskModel: {
    model: rawDashboard.modelValidation.model,
    trainingRows: rawDashboard.modelValidation.trainingRows,
    rocAuc: rawDashboard.modelValidation.rocAuc,
    f1: rawDashboard.modelValidation.f1,
    topFeatures: rawDashboard.modelValidation.topFeatures,
    modelVersion: null,
  },
  notice: "사전 계산된 합성 시나리오 기반 모델 검증 결과",
};

export const cefazolinDecisionEvidence = {
  model: [
    `부족위험 모델 ${rawDashboard.modelValidation.model}`,
    `TreeSHAP 상위 변수 ${rawDashboard.modelValidation.topFeatures.map((feature) => feature.label).join(" · ")}`,
    "모델 버전·실행 ID: 원천 데이터 미제공",
  ],
  simulation: recommendedScenario
    ? [
        `서비스율 ${recommendedScenario.serviceRatePct.toFixed(2)}%`,
        `미충족 수요 ${formatScmQuantity(recommendedScenario.totalUnmetDemand, "demand")}`,
        `부족 발생 ${recommendedScenario.shortageWeeks}주`,
        `최저 권역 서비스율 ${recommendedScenario.minimumRegionalServiceRatePct.toFixed(2)}%`,
      ]
    : ["유효한 권고 시나리오 없음"],
  rules: [
    ...cefazolinScenarioRecommendation.appliedRuleIds,
    "RULE-SHAP-TRACE-001",
    "RULE-SCENARIO-CONSTRAINT-001",
  ],
  dataAsOf: dataAsOfLabel,
};

const recommendationTitle = cefazolinScenarioRecommendation.recommendationTitle;
const recommendedScenarioId = cefazolinScenarioRecommendation.recommendedScenarioId;

export const cefazolinWorkflowSteps: CefazolinWorkflowStep[] = [
  {
    id: "FLOW-01-DATA",
    order: 1,
    group: "데이터 준비",
    title: "ERP·MES·WMS·수요 데이터 확인",
    shortTitle: "데이터 수집",
    purpose: "분석 실행에 사용할 합성 데이터 스냅샷의 범위와 기준일을 확인합니다.",
    icon: "database",
    ruleIds: ["RULE-DATA-SCOPE-001"],
    dataAsOf: dataAsOfLabel,
    evidence: [
      `ERP·MES·WMS ${rawDashboard.integration.length}건`,
      `권역 월별 수요 ${rawDashboard.regionalMonthly.length}건`,
      `공급사 ${cefazolinDataCollectionSummary.supplierCount}곳`,
      "데이터 유형: 합성 PoC 데이터",
    ],
    warnings: cefazolinDataQualitySummary.warnings,
    nextAction: "통합·품질 검사 결과를 확인합니다.",
    synthetic: true,
  },
  {
    id: "FLOW-02-QUALITY",
    order: 2,
    group: "데이터 준비",
    title: "데이터 통합·품질 검사",
    shortTitle: "통합·품질 검사",
    purpose: "정형 변환, 시스템·권역 키 정합성, 필수 수치 유효성을 검사합니다.",
    icon: "account_tree",
    ruleIds: ["RULE-DQ-SYNC-001", "RULE-DQ-REGION-001"],
    dataAsOf: dataAsOfLabel,
    evidence: [
      `동기화 완료 ${cefazolinDataQualitySummary.syncedCount}/${cefazolinDataQualitySummary.totalCount}건`,
      `시스템 키 정합성 ${regionSystemKeyMatches ? "통과" : "실패"}`,
      `권역 키 정규화 ${cefazolinDataQualitySummary.regionKeyNormalized ? "통과" : "실패"}`,
      `오류 ${cefazolinDataQualitySummary.errorCount}건 · 경고 ${cefazolinDataQualitySummary.warningCount}건`,
    ],
    warnings: cefazolinDataQualitySummary.warnings,
    nextAction: "경고를 확인한 뒤 분석 준비성 판정을 검토합니다.",
    synthetic: true,
  },
  {
    id: "FLOW-03-DETECTION",
    order: 3,
    group: "탐지·영향",
    title: "수급 이상 탐지·Case 생성",
    shortTitle: "위험 탐지",
    purpose:
      "통합된 수요·재고·생산·공급 신호를 종합해 수급 이상을 판정하고 의사결정 Case를 생성합니다.",
    icon: "radar",
    ruleIds: ["RULE-RISK-DETECTION-001", ...cefazolinReadinessChecks.map((check) => check.id)],
    dataAsOf: national.policyRisk.asOf,
    evidence: [
      `직접 공급 신호 ${cefazolinDetectionContext.directSignal}${cefazolinDetectionContext.eventId ? ` · ${cefazolinDetectionContext.eventId}` : ""}`,
      cefazolinDetectionContext.supplyFulfillmentPct !== null
        ? `ERP 공급이행률 ${cefazolinDetectionContext.supplyFulfillmentPct.toFixed(1)}%`
        : `공급 위험 신호 ${cefazolinDetectionContext.directSignalScore}/100`,
      `전국 수급 위험 ${national.policyRisk.score}/100 · ${national.policyRisk.grade}`,
      `Case ${caseId}`,
    ],
    warnings: cefazolinReadinessChecks
      .filter((check) => check.status === "fail")
      .map((check) => `${check.label}: ${check.evidence}`),
    nextAction: "생성된 Case의 권역·재고·수요 영향을 확인합니다.",
    synthetic: true,
  },
  {
    id: "FLOW-04-IMPACT",
    order: 4,
    group: "탐지·영향",
    title: "Case 영향 분석",
    shortTitle: "영향 분석",
    purpose:
      "탐지된 수급 이상이 권역별 재고와 목표재고 충족률, 영향 범위에 미치는 결과를 사건 단위로 정리합니다.",
    icon: "monitoring",
    ruleIds: ["RULE-MODEL-VALID-001", "RULE-SHAP-TRACE-001", "RULE-CASE-IMPACT-001"],
    dataAsOf: latestDataAsOf,
    evidence: [
      `영향 권역 ${shortageRegionCount}개 · 전국 목표재고 충족률 ${national.targetStockCoveragePct.toFixed(2)}%`,
      `현재 재고 ${formatScmQuantity(rawDashboard.overview.nationalCurrentStock, "finishedInventory")} · 목표재고 ${formatScmQuantity(rawDashboard.overview.nationalTargetStock, "finishedInventory")}`,
      "위험 전파 경로: 공급 이행 저하 → 재고 압박 → 권역 부족 → 서비스 위험",
      ...topRiskCauses
        .filter((cause) => cause.label !== cefazolinDetectionContext.directSignal)
        .map((cause) => `${cause.label} ${cause.score}/100`),
    ],
    warnings: [],
    nextAction: "동일 Case Snapshot을 기준으로 S0~S3 대응 시나리오를 실행합니다.",
    synthetic: true,
  },
  {
    id: "FLOW-05-SIMULATION",
    order: 5,
    group: "분석·시뮬레이션",
    title: "S0~S3 시뮬레이션",
    shortTitle: "S0~S3 시뮬레이션",
    purpose: "정상 기준선과 세 가지 대응안을 서비스·부족·조달·비용 지표로 비교합니다.",
    icon: "science",
    ruleIds: ["RULE-SCENARIO-CONSTRAINT-001"],
    dataAsOf: national.policyRisk.asOf,
    evidence: [
      `시나리오 ${cefazolinScenarioComparison.length}건`,
      `제약 통과 ${cefazolinScenarioComparison.filter((scenario) => scenario.constraintPassed).length}/${cefazolinScenarioComparison.length}건`,
    ],
    warnings: [],
    nextAction: "S1~S3 권고안 선택 결과와 제외 사유를 확인합니다.",
    synthetic: true,
  },
  {
    id: "FLOW-06-RECOMMENDATION",
    order: 6,
    group: "의사결정",
    title: "S1~S3 대응안 비교·권고",
    shortTitle: "시나리오 비교·권고",
    purpose: "유효성, 미충족 수요, 부족 주차, 권역 서비스율, 비용 순으로 권고안을 계산합니다.",
    icon: "recommend",
    ruleIds: cefazolinScenarioRecommendation.appliedRuleIds,
    dataAsOf: national.policyRisk.asOf,
    evidence: recommendedScenarioId
      ? [`계산된 권고안 ${recommendationTitle}`, ...cefazolinScenarioRecommendation.decisionReasons]
      : ["유효한 권고안이 없습니다."],
    warnings: cefazolinScenarioRecommendation.excludedScenarios
      .filter((scenario) => !scenario.valid)
      .map((scenario) => `${scenario.scenarioId}: ${scenario.reason}`),
    nextAction: "권고 근거와 다른 시나리오의 제외 사유를 검토합니다.",
    synthetic: true,
  },
  {
    id: "FLOW-07-EVIDENCE",
    order: 7,
    group: "의사결정",
    title: "의사결정 근거",
    shortTitle: "의사결정 근거",
    purpose: "모델·시뮬레이션·규칙 근거를 분리해 권고안의 추적 가능성을 확인합니다.",
    icon: "psychology",
    ruleIds: cefazolinDecisionEvidence.rules,
    dataAsOf: dataAsOfLabel,
    evidence: [
      ...cefazolinDecisionEvidence.model.slice(0, 2),
      ...cefazolinDecisionEvidence.simulation,
    ],
    warnings: ["모델 결과와 정책형 리스크를 동일 지표로 합산하지 않습니다."],
    nextAction: "비용·일정·품질·재배분 조건을 확인하고 담당자 승인 여부를 결정합니다.",
    synthetic: true,
  },
  {
    id: "FLOW-08-HITL",
    order: 8,
    group: "승인·실행",
    title: "담당자 검토·승인",
    shortTitle: "담당자 승인",
    purpose: "담당자가 필수 운영 전제를 확인하고 권고안의 가상 실행을 승인하거나 보류합니다.",
    icon: "verified_user",
    ruleIds: ["RULE-HITL-APPROVAL-001"],
    dataAsOf: national.policyRisk.asOf,
    evidence: [
      `승인 대상 ${recommendationTitle}`,
      "추가 조달비·공급사 일정·품질 승인·재배분 가능량 확인 필요",
      "승인 기록은 현재 브라우저 세션에만 유지",
    ],
    warnings: ["실제 시스템 승인이나 전자결재 기록이 아닙니다."],
    nextAction: "필수 체크와 검토자 정보를 입력해 승인 또는 보류합니다.",
    synthetic: true,
  },
  {
    id: "FLOW-09-EXECUTION",
    order: 9,
    group: "승인·실행",
    title: "가상 발주·생산·재고이동",
    shortTitle: "가상 실행",
    purpose: "승인된 권고안의 실행 작업을 가상 명령으로 처리합니다.",
    icon: "play_circle",
    ruleIds: ["RULE-VIRTUAL-EXEC-001"],
    dataAsOf: national.policyRisk.asOf,
    evidence: [
      `가상 작업 ${recommendedScenarioId ? "권고안 기준 생성" : "생성 불가"}`,
      "실제 ERP·MES·WMS 전송 없음",
    ],
    warnings: ["인증·권한·외부 시스템 API가 연결되지 않은 PoC 기능입니다."],
    nextAction: "담당자 승인 후 가상 실행하고 예상효과를 확인합니다.",
    synthetic: true,
  },
  {
    id: "FLOW-10-EFFECT",
    order: 10,
    group: "승인·실행",
    title: "가상 실행 예상효과",
    shortTitle: "예상효과 확인",
    purpose: "S1 기준 대비 계산된 권고 시나리오의 시뮬레이션 예상효과를 확인합니다.",
    icon: "monitoring",
    ruleIds: ["RULE-SIMULATED-EFFECT-001"],
    dataAsOf: national.policyRisk.asOf,
    evidence: recommendedScenario
      ? [
          `S1 대비 ${recommendedScenario.id.replace("_", " ")} 예상효과`,
          `서비스율 ${s1.serviceRatePct.toFixed(2)}% → ${recommendedScenario.serviceRatePct.toFixed(2)}%`,
          `미충족 수요 ${formatScmQuantity(s1.totalUnmetDemand, "demand")} → ${formatScmQuantity(recommendedScenario.totalUnmetDemand, "demand")}`,
        ]
      : ["권고 시나리오가 없어 예상효과를 계산할 수 없습니다."],
    warnings: ["이 결과는 실제 운영성과가 아니라 합성 데이터 기반 시뮬레이션 예상값입니다."],
    nextAction: "실제 연계 시 동일 지표로 예상값과 운영 실적의 편차를 비교합니다.",
    synthetic: true,
  },
];

const procurementPlans = recommendedScenarioId
  ? rawDashboard.procurement.filter(
      (record) => record.scenarioId === recommendedScenarioId && record.receiptType === "긴급조달",
    )
  : [];
const usesTransfer =
  recommendedScenarioId === "S2_내부대응" || recommendedScenarioId === "S3_통합대응";
const transferableRegions = usesTransfer
  ? regionalRows.filter((region) => region.transferableQuantity > 0)
  : [];

const procurementActions: VirtualExecutionAction[] = procurementPlans.map((plan) => ({
  id: `VPO-${plan.supplierId}`,
  actionType: "원료 긴급발주",
  title: `공급사 ${plan.supplierId} 원료 추가 발주`,
  source: `공급사 ${plan.supplierId}`,
  target: "천안공장 원료 입고",
  quantity: plan.totalReceiptQuantity,
  unit: "API 환산단위",
  ruleId: "RULE-EMERGENCY-001",
  basis: `${plan.firstReceiptWeek}~${plan.lastReceiptWeek} · ${plan.receiptCount}회 입고 계획`,
  synthetic: true,
}));
const productionActions: VirtualExecutionAction[] =
  recommendedScenario && recommendedScenario.emergencyProcurementQuantity > 0
    ? [
        {
          id: `VPROD-${recommendedScenario.id.split("_")[0]}`,
          actionType: "생산계획 재산정",
          title: "추가 원료 기준 생산계획 재산정",
          source: "승인된 API 환산 수량",
          target: "천안공장 MES 생산계획",
          quantity: null,
          unit: "계획",
          ruleId: "RULE-PRODUCTION-REPLAN-001",
          basis: `전국 MES 가동률 ${rawDashboard.overview.averageUtilizationPct.toFixed(2)}% · 추가조달 ${formatScmQuantity(recommendedScenario.emergencyProcurementQuantity, "apiProcurement")}`,
          synthetic: true,
        },
      ]
    : [];
const transferActions: VirtualExecutionAction[] = transferableRegions.map((region) => ({
  id: `VTR-${region.id}`,
  actionType: "재고이동",
  title: `${region.name} 과잉재고 우선배분`,
  source: region.name,
  target: "부족 권역 우선배분 풀",
  quantity: region.transferableQuantity,
  unit: "완제품 환산단위",
  ruleId: "RULE-TRANSFER-001",
  basis: `현재고 ${formatScmQuantity(region.currentStock, "finishedInventory")} · 목표재고 충족률 ${region.targetStockCoveragePct.toFixed(2)}%`,
  synthetic: true,
}));

export const cefazolinVirtualExecutionActions: VirtualExecutionAction[] = [
  ...procurementActions,
  ...productionActions,
  ...transferActions,
];

const effectTarget = recommendedScenario ?? s1;

export const cefazolinWorkflowEffect = {
  baselineScenario: s1.id,
  targetScenario: effectTarget.id,
  serviceRateBefore: s1.serviceRatePct,
  serviceRateAfter: effectTarget.serviceRatePct,
  minimumRegionalServiceRateBefore: s1.minimumRegionalServiceRatePct,
  minimumRegionalServiceRateAfter: effectTarget.minimumRegionalServiceRatePct,
  unmetDemandBefore: s1.totalUnmetDemand,
  unmetDemandAfter: effectTarget.totalUnmetDemand,
  shortageWeeksBefore: s1.shortageWeeks,
  shortageWeeksAfter: effectTarget.shortageWeeks,
  procurementCostDeltaKrw: effectTarget.totalProcurementCostKrw - s1.totalProcurementCostKrw,
  dataAsOf: national.policyRisk.asOf,
  synthetic: true,
};

export function getCefazolinWorkflowRunState(input: {
  hitlStatus: HitlStatus;
  executionStatus: ExecutionStatus;
  lastUpdatedAt: string;
}) {
  return createWorkflowRunState({
    runId: cefazolinWorkflowRunMeta.runId,
    scenarios: rawDashboard.scenarios,
    dataReady: integrationComplete && regionalDemandComplete,
    qualityProcessed: dataQualityErrorCount === 0,
    analysisAvailable: cefazolinAnalysisReadiness.verdict !== "분석 중단",
    modelValidated,
    simulationReady: scenariosComplete,
    hitlStatus: input.hitlStatus,
    executionStatus: input.executionStatus,
    lastUpdatedAt: input.lastUpdatedAt,
  });
}
