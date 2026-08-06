import rawDashboard from "@/data/cefazolin-dashboard.json";
import type { DashboardRegion, ProductDashboardScenario } from "@/data/dashboard-scenario";
import type { RiskLevel, SystemKey, SystemRecord } from "@/data/scm";
import { selectRecommendedScenario } from "@/services/scm-workflow-orchestrator";

export type ScmQuantityType = "demand" | "finishedInventory" | "transfer" | "apiProcurement";

const scmQuantityUnits: Record<ScmQuantityType, string> = {
  demand: "수요 환산단위",
  finishedInventory: "완제품 환산단위",
  transfer: "완제품 환산단위",
  apiProcurement: "API 환산단위",
};

export function getScmQuantityUnit(quantityType: ScmQuantityType): string {
  return scmQuantityUnits[quantityType];
}

export function formatScmQuantity(
  value: number,
  quantityType: ScmQuantityType,
  maximumFractionDigits = 0,
): string {
  return `${value.toLocaleString("ko-KR", {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  })} ${getScmQuantityUnit(quantityType)}`;
}

function toRiskLevel(status: string): RiskLevel {
  if (status === "danger") return "danger";
  if (status === "warning") return "warning";
  return "safe";
}

function toIntegrationStatus(status: string): SystemRecord["status"] {
  if (status === "지연") return "지연";
  if (status === "처리중") return "처리중";
  return "동기화 완료";
}

function createChartPath(values: number[], allValues: number[]): string {
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  const range = max - min || 1;

  return values
    .map((value, index) => {
      const x = (index / Math.max(values.length - 1, 1)) * 400;
      const y = 170 - ((value - min) / range) * 130;
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

function formatCostDelta(value: number): string {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}${(Math.abs(value) / 100_000_000).toFixed(2)}억 원`;
}

function formatCost(value: number): string {
  return `${(value / 100_000_000).toFixed(2)}억 원`;
}

function feasibilityLabel(score: number): string {
  if (score >= 80) return "높음";
  if (score >= 50) return "중간";
  return "낮음";
}

const sourceRegions = Object.fromEntries(rawDashboard.regions.map((region) => [region.id, region]));

const regions = Object.fromEntries(
  rawDashboard.regions.map((region) => {
    const riskLevel = toRiskLevel(region.stockStatusCode);
    const dashboardRegion: DashboardRegion = {
      region: `${region.code}_${region.name}`,
      current_stock: region.currentStock,
      target_stock: region.targetStock,
      stock_ratio: region.targetStockCoveragePct,
      stockRatioLabel: `${region.targetStockCoveragePct}%`,
      status: region.inventoryStatus,
      id: region.id,
      riskLevel,
      riskText: region.inventoryStatus,
    };
    return [region.id, dashboardRegion];
  }),
) as Record<string, DashboardRegion>;

const national = rawDashboard.regions.find((region) => region.id === "National");
if (!national) throw new Error("세파졸린 전국 통합 데이터가 없습니다.");

const monthlyOrder = [...new Set(rawDashboard.regionalMonthly.map((item) => item.month))].sort();
const monthlyByRegion = Object.fromEntries(
  rawDashboard.regions
    .filter((region) => region.id !== "National")
    .map((region) => [
      region.id,
      monthlyOrder.map((month) => {
        const metric = rawDashboard.regionalMonthly.find(
          (item) => item.regionId === region.id && item.month === month,
        );
        if (!metric) throw new Error(`${region.id} ${month} 월별 권역 데이터가 없습니다.`);
        return metric;
      }),
    ]),
) as Record<string, (typeof rawDashboard.regionalMonthly)[number][]>;

const nationalMonthly = monthlyOrder.map((month) => {
  const rows = rawDashboard.regionalMonthly.filter((item) => item.month === month);
  return {
    month,
    regionId: "National",
    regionCode: "National",
    regionName: "전국 통합",
    forecastDemand: rows.reduce((sum, item) => sum + item.forecastDemand, 0),
    safetyStock: rows.reduce((sum, item) => sum + item.safetyStock, 0),
    targetStock: rows.reduce((sum, item) => sum + item.targetStock, 0),
    averageLeadTimeHours: 0,
    unit: rows[0]?.unit ?? "완제품 환산단위",
    dataType: "권역 합계",
  };
});

const regionalMonthly = {
  National: nationalMonthly,
  ...monthlyByRegion,
};

const chartByRegion = Object.fromEntries(
  Object.entries(regionalMonthly).map(([regionId, metrics]) => {
    const forecast = metrics.map((item) => item.forecastDemand);
    const target = metrics.map((item) => item.targetStock);
    const values = [...forecast, ...target];
    return [
      regionId,
      {
        actual: createChartPath(forecast, values),
        prediction: createChartPath(target, values),
      },
    ];
  }),
) as Record<string, { actual: string; prediction: string }>;
const emergencyProcurement = rawDashboard.overview.integratedResponse.emergencyProcurementQuantity;
const s1 = rawDashboard.scenarios.find((scenario) => scenario.id === "S1_무대응");
const s2 = rawDashboard.scenarios.find((scenario) => scenario.id === "S2_내부대응");
const s3 = rawDashboard.scenarios.find((scenario) => scenario.id === "S3_통합대응");
if (!s1 || !s2 || !s3) throw new Error("실행안 비교에 필요한 S1, S2, S3가 없습니다.");

const emergencyPlans = rawDashboard.procurement.filter(
  (item) => item.scenarioId === "S3_통합대응" && item.receiptType === "긴급조달",
);
const emergencySupplierCount = new Set(emergencyPlans.map((item) => item.supplierId)).size;
const emergencyReceiptCount = emergencyPlans.reduce((sum, item) => sum + item.receiptCount, 0);
const emergencyFirstReceipt = [...emergencyPlans].map((item) => item.firstReceiptWeek).sort()[0];
const emergencyLastReceipt = [...emergencyPlans]
  .map((item) => item.lastReceiptWeek)
  .sort()
  .at(-1);
const addedCostVsS1 = s3.totalProcurementCostKrw - s1.totalProcurementCostKrw;
const scenarioRecommendation = selectRecommendedScenario(rawDashboard.scenarios);
const s2UnmetDemandReduction = s1.totalUnmetDemand - s2.totalUnmetDemand;
const s2UnmetDemandReductionPct = (s2UnmetDemandReduction / s1.totalUnmetDemand) * 100;
const transferableRegions = rawDashboard.regions.filter(
  (region) => region.id !== "National" && region.transferableQuantity > 0,
);
const transferableSummary = transferableRegions
  .map((region) => `${region.name} ${formatScmQuantity(region.transferableQuantity, "transfer")}`)
  .join(" + ");

export function getCefazolinIntegrationRecords(regionId: string): SystemRecord[] {
  const latestMetric = regionalMonthly[regionId]?.at(-1);
  return rawDashboard.integration
    .filter((record) => record.regionId === regionId)
    .map((record) => ({
      system: record.system as SystemKey,
      docNo: record.documentNumber,
      status: toIntegrationStatus(record.status),
      qty: Math.round(record.quantity).toLocaleString("ko-KR"),
      updatedAt: record.updatedAt,
      note: record.note,
      dataType: record.dataType,
      calculationBasis: record.calculationBasis,
      leadTimeHours: record.system === "WMS" ? latestMetric?.averageLeadTimeHours : undefined,
    }));
}

const dashboardScenario: ProductDashboardScenario = {
  date: national.policyRisk.asOf,
  sceneName: rawDashboard.overview.baselineScenario,
  regions,
  totalInventory: rawDashboard.overview.nationalCurrentStock,
  utilization: rawDashboard.overview.averageUtilizationPct,
  riskScore: rawDashboard.overview.policyRisk.score,
  inventoryLevel: toRiskLevel(national.stockStatusCode),
  externalSignal: {
    title: "세파졸린 통합 공급 리스크",
    value: `정책 리스크 ${rawDashboard.overview.policyRisk.score}/100`,
    detail: `S3 서비스율 ${rawDashboard.overview.integratedResponse.serviceRatePct}% · 긴급조달 ${formatScmQuantity(emergencyProcurement, "apiProcurement")}`,
  },
  recommendations: [
    {
      id: "CEFAZOLIN-S1-NO-RESPONSE",
      title: "S1 무대응",
      description: "추가 조치 없이 확정 기본입고만 유지하는 비교 기준안",
      approvalButtonText: "비교 기준 확인",
    },
    {
      id: "CEFAZOLIN-S2-INTERNAL-RESPONSE",
      title: "S2 내부대응",
      description: "권역 재고 재배분 추천",
      approvalButtonText: "재배분안 검토",
    },
    {
      id: "CEFAZOLIN-S3-INTEGRATED-RESPONSE",
      title: "S3 통합대응",
      description: "권역 재고 재배분 및 원료 추가 발주 추천",
      approvalButtonText: "S3 실행안 검토",
    },
  ],
};

export const cefazolinDashboard = {
  ...dashboardScenario,
  productKey: rawDashboard.product,
  annualForecastDemand: rawDashboard.overview.annualForecastDemand,
  annualForecastDemandByRegion: Object.fromEntries(
    Object.entries(sourceRegions).map(([id, region]) => [id, region.annualForecastDemand]),
  ) as Record<string, number>,
  transferableQuantityByRegion: Object.fromEntries(
    Object.entries(sourceRegions).map(([id, region]) => [id, region.transferableQuantity]),
  ) as Record<string, number>,
  serviceRatePct: rawDashboard.overview.integratedResponse.serviceRatePct,
  unmetDemandRatePct: rawDashboard.overview.integratedResponse.unmetDemandRatePct,
  policyRiskByRegion: Object.fromEntries(
    Object.entries(sourceRegions).map(([id, region]) => [id, region.policyRisk]),
  ),
  chart: chartByRegion.National,
  chartByRegion,
  regionalMonthly,
  monthlyFlow: rawDashboard.monthlyFlow,
  scenarios: rawDashboard.scenarios,
  modelValidation: rawDashboard.modelValidation,
  source: rawDashboard.source,
  recommendationEvaluations: [
    {
      id: "CEFAZOLIN-S1-NO-RESPONSE",
      scenarioId: "S1",
      roleLabel:
        scenarioRecommendation.recommendedScenarioId === s1.id ? "최종 권고안" : "비교 기준",
      recommended: scenarioRecommendation.recommendedScenarioId === s1.id,
      ruleIds: ["RULE-BASELINE-S1-001"],
      dataAsOf: national.policyRisk.asOf,
      title: "S1 무대응",
      description: "추가 조치 없이 확정 기본입고만 유지하는 비교 기준안",
      costKpi: {
        label: "총 조달비",
        value: formatCost(s1.totalProcurementCostKrw),
        direction: "neutral" as const,
      },
      feasibility: {
        label: feasibilityLabel(s1.minimumRegionalServiceRatePct),
        score: s1.minimumRegionalServiceRatePct,
        metric: "최저 권역 서비스율",
      },
      executionPeriod: `추가 조치 없음 · ${s1.firstShortageWeek}부터 부족 발생`,
      supplyImpact: `서비스율 ${s1.serviceRatePct.toFixed(2)}% · 미충족 ${formatScmQuantity(s1.totalUnmetDemand, "demand")} · 부족 ${s1.shortageWeeks}주`,
      xai: {
        summary:
          "추가 비용과 실행 부담은 없지만 공급 차질을 흡수하지 못하므로 실행 권고안이 아니라 S2·S3 효과를 비교하기 위한 기준안입니다.",
        evidence: [
          `전체 서비스율 ${s1.serviceRatePct.toFixed(2)}%, 최저 권역 서비스율 ${s1.minimumRegionalServiceRatePct.toFixed(2)}%`,
          `미충족 수요 ${formatScmQuantity(s1.totalUnmetDemand, "demand")}`,
          `최초 부족 ${s1.firstShortageWeek}, 부족 발생 ${s1.shortageWeeks}주`,
          `최대 주간 부족 ${formatScmQuantity(s1.maxWeeklyShortage, "demand")}`,
        ],
        conditions: [
          "확정 기본입고 일정과 현재 권역 배분을 변경하지 않음",
          "부족 발생과 권역별 서비스 저하를 운영 리스크로 수용",
        ],
        constraints: [
          `최저 권역 서비스율이 ${s1.minimumRegionalServiceRatePct.toFixed(2)}%까지 하락`,
          `${s1.shortageWeeks}주 동안 부족이 지속되어 실행 권고 대상으로 사용할 수 없음`,
        ],
        limitation:
          "판매손실 단가와 품절 페널티가 원천 데이터에 없어 무대응의 총 손실액은 계산할 수 없습니다.",
      },
    },
    {
      id: "CEFAZOLIN-S2-INTERNAL-RESPONSE",
      scenarioId: "S2",
      roleLabel:
        scenarioRecommendation.recommendedScenarioId === s2.id ? "최종 권고안" : "단기 보조안",
      recommended: scenarioRecommendation.recommendedScenarioId === s2.id,
      ruleIds: ["RULE-TRANSFER-001", "RULE-SERVICE-BALANCE-001"],
      dataAsOf: national.policyRisk.asOf,
      title: "S2 내부대응",
      description: "권역 재고 재배분 추천",
      costKpi: {
        label: "S1 대비 추가 조달비",
        value: formatCostDelta(s2.totalProcurementCostKrw - s1.totalProcurementCostKrw),
        direction: "neutral" as const,
      },
      feasibility: {
        label: feasibilityLabel(s2.minimumRegionalServiceRatePct),
        score: s2.minimumRegionalServiceRatePct,
        metric: "최저 권역 서비스율",
      },
      executionPeriod: `즉시 재배분 · 부족 발생은 ${s2.shortageWeeks}주 지속`,
      supplyImpact: `서비스율 ${s2.serviceRatePct.toFixed(2)}% · 미충족 ${formatScmQuantity(s2.totalUnmetDemand, "demand")} · 부족 ${s2.shortageWeeks}주`,
      xai: {
        summary:
          "추가 발주 없이 과잉 권역 재고를 부족 권역으로 이동해 S1보다 권역 형평성을 개선합니다. 다만 전체 부족을 제거하지 못하므로 단기 보조안입니다.",
        evidence: [
          `재배분 가능량 ${formatScmQuantity(rawDashboard.overview.excessTransferableQuantity, "transfer")} (${transferableSummary})`,
          `S1 대비 미충족 수요 ${formatScmQuantity(s2UnmetDemandReduction, "demand")} 감소 (${s2UnmetDemandReductionPct.toFixed(2)}%)`,
          `최저 권역 서비스율 ${s1.minimumRegionalServiceRatePct.toFixed(2)}% → ${s2.minimumRegionalServiceRatePct.toFixed(2)}%`,
          `추가 조달비 ${formatCostDelta(s2.totalProcurementCostKrw - s1.totalProcurementCostKrw)}`,
        ],
        conditions: [
          `WMS 재배분 가능 재고 ${formatScmQuantity(rawDashboard.overview.excessTransferableQuantity, "transfer")} 확보`,
          "과잉 권역 출고 승인, 부족 권역 우선순위 확정, 권역 간 운송 슬롯 확보",
        ],
        constraints: [
          `미충족 수요 ${formatScmQuantity(s2.totalUnmetDemand, "demand")}가 남음`,
          `부족 발생 기간이 S1과 동일한 ${s2.shortageWeeks}주이므로 재배분만으로 공급 차질 해소 불가`,
        ],
        limitation:
          "운송비와 권역 간 실제 배차 가능 시간은 원천 데이터에 없어 재배분 실행비용에는 반영되지 않았습니다.",
      },
    },
    {
      id: "CEFAZOLIN-S3-INTEGRATED-RESPONSE",
      scenarioId: "S3",
      roleLabel:
        scenarioRecommendation.recommendedScenarioId === s3.id ? "최종 권고안" : "통합대응안",
      recommended: scenarioRecommendation.recommendedScenarioId === s3.id,
      ruleIds: ["RULE-TRANSFER-001", "RULE-EMERGENCY-001", "RULE-SERVICE-100-001"],
      dataAsOf: national.policyRisk.asOf,
      title: "S3 통합대응",
      description: "권역 재고 재배분 및 원료 추가 발주 추천",
      costKpi: {
        label: "S1 대비 추가 조달비",
        value: formatCostDelta(addedCostVsS1),
        direction: "increase" as const,
      },
      feasibility: {
        label: feasibilityLabel(s3.minimumRegionalServiceRatePct),
        score: s3.minimumRegionalServiceRatePct,
        metric: "최저 권역 서비스율",
      },
      executionPeriod: `${emergencyFirstReceipt}~${emergencyLastReceipt} 추가 입고`,
      supplyImpact: `서비스율 ${s3.serviceRatePct.toFixed(2)}% · 미충족 ${formatScmQuantity(s3.totalUnmetDemand, "demand")} · 부족 0주`,
      xai: {
        summary:
          "S2 재배분에 원료 추가 발주를 결합한 시나리오입니다. 최종 권고 여부는 S1~S3 시뮬레이션 지표의 동적 비교 규칙으로 결정합니다.",
        evidence: [
          `원료 추가 발주 ${formatScmQuantity(emergencyProcurement, "apiProcurement")}`,
          `S1 대비 추가 조달비 ${formatCostDelta(addedCostVsS1)}`,
          `미충족 수요 ${formatScmQuantity(s1.totalUnmetDemand, "demand")} → ${formatScmQuantity(s3.totalUnmetDemand, "demand")}`,
          `서비스율 ${s1.serviceRatePct.toFixed(2)}% → ${s3.serviceRatePct.toFixed(2)}%, 최저 권역 ${s3.minimumRegionalServiceRatePct.toFixed(2)}%`,
        ],
        conditions: [
          `S2 권역 재배분과 공급사 ${emergencySupplierCount}곳 원료 추가 발주를 동시 승인`,
          `${emergencyFirstReceipt}~${emergencyLastReceipt} 총 ${emergencyReceiptCount}회 긴급 입고 일정 확보`,
          "입고 원료의 MES 생산 투입과 품질검사·출하승인 완료",
        ],
        constraints: [
          `S1 대비 조달비 ${formatCostDelta(addedCostVsS1)} 증가`,
          "공급사 입고 일정과 품질 승인 완료를 전제로 한 시뮬레이션 결과",
        ],
        limitation:
          "판매손실 회피액과 품절 페널티가 없어 추가 조달비를 차감한 순편익은 계산할 수 없습니다.",
      },
    },
  ],
};
