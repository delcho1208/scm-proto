import rawDashboard from "@/data/cefazolin-dashboard.json";
import type { DashboardRegion, ProductDashboardScenario } from "@/data/dashboard-scenario";
import type { RiskLevel, SystemKey, SystemRecord } from "@/data/scm";

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

function formatCostDelta(value: number) {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}${(Math.abs(value) / 100_000_000).toFixed(2)}억 원`;
}

function feasibilityLabel(score: number) {
  return score >= 80 ? "높음" : score >= 50 ? "중간" : "낮음";
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
const gangwon = rawDashboard.regions.find((region) => region.id === "Gangwon");
if (!gangwon) throw new Error("세파졸린 강원권 데이터가 없습니다.");

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
);
const nationalMonthly = monthlyOrder.map((month) => {
  const rows = rawDashboard.regionalMonthly.filter((item) => item.month === month);
  return {
    month,
    forecastDemand: rows.reduce((sum, item) => sum + item.forecastDemand, 0),
    targetStock: rows.reduce((sum, item) => sum + item.targetStock, 0),
    averageLeadTimeHours: 0,
  };
});
const regionalMonthly = { National: nationalMonthly, ...monthlyByRegion };
const chartByRegion = Object.fromEntries(
  Object.entries(regionalMonthly).map(([regionId, metrics]) => {
    const forecast = metrics.map((item) => item.forecastDemand);
    const target = metrics.map((item) => item.targetStock);
    const values = [...forecast, ...target];
    return [regionId, { actual: createChartPath(forecast, values), prediction: createChartPath(target, values) }];
  }),
) as Record<string, { actual: string; prediction: string }>;
const emergencyProcurement = rawDashboard.overview.integratedResponse.emergencyProcurementQuantity;
const s0 = rawDashboard.scenarios.find((scenario) => scenario.id === "S0_정상");
const s1 = rawDashboard.scenarios.find((scenario) => scenario.id === "S1_무대응");
const s2 = rawDashboard.scenarios.find((scenario) => scenario.id === "S2_내부대응");
const s3 = rawDashboard.scenarios.find((scenario) => scenario.id === "S3_통합대응");
if (!s0 || !s1 || !s2 || !s3) throw new Error("세파졸린 추천 평가에 필요한 S0, S1, S2, S3가 없습니다.");
const emergencyPlans = rawDashboard.procurement.filter(
  (item) => item.scenarioId === "S3_통합대응" && item.receiptType === "긴급조달",
);
const emergencyPlannedQuantity = emergencyPlans.reduce((sum, item) => sum + item.totalReceiptQuantity, 0);
const emergencyPlanCoveragePct = Math.min(100, (emergencyPlannedQuantity / emergencyProcurement) * 100);
const addedCostVsS1 = s3.totalProcurementCostKrw - s1.totalProcurementCostKrw;
const costDeltaVsS0 = s3.totalProcurementCostKrw - s0.totalProcurementCostKrw;
const s3FeasibilityScore = Math.min(
  s3.serviceRatePct,
  s3.minimumRegionalServiceRatePct,
  s3.shortageWeeks === 0 ? 100 : 0,
);

const dashboardScenario: ProductDashboardScenario = {
  date: "2026-03-10",
  sceneName: rawDashboard.overview.baselineScenario,
  regions,
  totalInventory: rawDashboard.overview.nationalCurrentStock,
  utilization: rawDashboard.overview.averageUtilizationPct,
  inventoryLevel: toRiskLevel(national.stockStatusCode),
  externalSignal: {
    title: "세파졸린 통합 공급 현황",
    value: `전국 재고 충족률 ${national.targetStockCoveragePct}%`,
    detail: `S3 서비스율 ${rawDashboard.overview.integratedResponse.serviceRatePct}% · 원료 추가 발주 ${Math.round(emergencyProcurement).toLocaleString("ko-KR")} BOX`,
  },
  recommendations: national.recommendations.map((recommendation, index) => ({
    id: `CEFAZOLIN-${index + 1}`,
    title: recommendation,
    description: `전국 재고 충족률 ${national.targetStockCoveragePct}% · 긴급조달 ${Math.round(emergencyProcurement).toLocaleString("ko-KR")} BOX`,
    approvalButtonText: "S3 통합대응 적용",
  })),
};

export function getCefazolinIntegrationRecords(regionId: string): SystemRecord[] {
  const latestMetric = regionalMonthly[regionId as keyof typeof regionalMonthly]?.at(-1);
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
  integration: rawDashboard.integration,
  scenarios: rawDashboard.scenarios,
  modelValidation: rawDashboard.modelValidation,
  source: rawDashboard.source,
  recommendationEvaluations: [
    {
      id: "CEFAZOLIN-S1-NO-RESPONSE",
      regionId: undefined,
      scenarioId: "S1_무대응",
      title: "S1 무대응",
      description: "별도 대응을 실행하지 않고 기존 조달·배분 정책을 유지하는 비교 시나리오",
      costKpi: { label: "S0 대비 조달비 차이", value: formatCostDelta(s1.totalProcurementCostKrw - s0.totalProcurementCostKrw) },
      feasibility: { label: feasibilityLabel(s1.minimumRegionalServiceRatePct), score: s1.minimumRegionalServiceRatePct, metric: "최저 권역 서비스율" },
      xai: {
        summary: "추가 대응 비용은 적지만 공급 차질 시 미충족 수요와 권역별 서비스 저하가 발생하는 비교안입니다.",
        evidence: [
          `전체 서비스율 ${s1.serviceRatePct.toFixed(2)}% · 최저 권역 서비스율 ${s1.minimumRegionalServiceRatePct.toFixed(2)}%`,
          `미충족 수요 ${Math.round(s1.totalUnmetDemand).toLocaleString("ko-KR")} BOX`,
          `부족 발생 ${s1.shortageWeeks}주`,
        ],
        limitation: "무대응 시나리오는 실행 권고안이 아니라 다른 대응안의 효과를 비교하기 위한 기준안입니다.",
      },
    },
    {
      id: "CEFAZOLIN-S2-INTERNAL-RESPONSE",
      regionId: undefined,
      scenarioId: "S2_내부대응",
      title: "S2 내부대응",
      description: "보유 재고와 권역 간 내부 배분을 활용해 공급 차질에 대응하는 시나리오",
      costKpi: { label: "S1 대비 조달비 차이", value: formatCostDelta(s2.totalProcurementCostKrw - s1.totalProcurementCostKrw) },
      feasibility: { label: feasibilityLabel(s2.minimumRegionalServiceRatePct), score: s2.minimumRegionalServiceRatePct, metric: "최저 권역 서비스율" },
      xai: {
        summary: "추가 조달 없이 내부 재고를 재배분해 최저 권역 서비스율을 개선하지만 부족을 완전히 제거하지는 못하는 대응안입니다.",
        evidence: [
          `최저 권역 서비스율 ${s1.minimumRegionalServiceRatePct.toFixed(2)}% → ${s2.minimumRegionalServiceRatePct.toFixed(2)}%`,
          `미충족 수요 ${Math.round(s1.totalUnmetDemand).toLocaleString("ko-KR")} BOX → ${Math.round(s2.totalUnmetDemand).toLocaleString("ko-KR")} BOX`,
          `추가 긴급조달 ${Math.round(s2.emergencyProcurementQuantity).toLocaleString("ko-KR")} BOX`,
        ],
        limitation: "내부 재배분만으로는 20주의 부족 발생 기간이 해소되지 않아 외부 조달과의 결합 검토가 필요합니다.",
      },
    },
    {
      id: "CEFAZOLIN-EMERGENCY-PROCUREMENT",
      regionId: undefined,
      scenarioId: "S3_통합대응",
      title: national.recommendations[0] ?? "긴급조달·위험기반 우선배분 유지",
      description: `긴급조달 ${Math.round(emergencyProcurement).toLocaleString("ko-KR")} BOX로 미충족 수요를 제거하는 실행안`,
      costKpi: { label: "S1 대비 추가 조달비", value: formatCostDelta(addedCostVsS1) },
      feasibility: { label: feasibilityLabel(emergencyPlanCoveragePct), score: emergencyPlanCoveragePct, metric: "긴급조달 계획량 충족률" },
      xai: {
        summary: "추가 조달비를 투입해 품절과 미충족 수요를 회피하는 실행안입니다.",
        evidence: [
          `S1 대비 추가 조달비 ${formatCostDelta(addedCostVsS1)}`,
          `미충족 수요 ${Math.round(s1.totalUnmetDemand).toLocaleString("ko-KR")} BOX → 0 BOX`,
          `서비스율 ${s1.serviceRatePct.toFixed(2)}% → ${s3.serviceRatePct.toFixed(2)}%`,
        ],
        limitation: "판매손실 단가와 품절 페널티가 없어 순편익은 추가 데이터 반영 예정입니다.",
      },
    },
    {
      id: "CEFAZOLIN-S3-INTEGRATED-RESPONSE",
      regionId: undefined,
      scenarioId: "S3_통합대응",
      title: "S3 통합대응",
      description: "실행 내용: 원료 추가 발주 + 권역 재배분",
      costKpi: { label: "S0 대비 총조달비 차이", value: formatCostDelta(costDeltaVsS0) },
      feasibility: { label: feasibilityLabel(s3FeasibilityScore), score: s3FeasibilityScore, metric: "시뮬레이션 실현성" },
      xai: {
        summary: "S3는 원료 추가 발주와 권역 재배분을 함께 적용해 미충족 수요와 부족 주차를 제거하는 대응안입니다.",
        evidence: [
          `S0 대비 총조달비 차이 ${formatCostDelta(costDeltaVsS0)}`,
          `서비스율 ${s3.serviceRatePct.toFixed(2)}%, 최저 권역 서비스율 ${s3.minimumRegionalServiceRatePct.toFixed(2)}%`,
          `부족 발생 ${s3.shortageWeeks}주, 미충족 수요 ${Math.round(s3.totalUnmetDemand).toLocaleString("ko-KR")} BOX`,
        ],
        limitation: "정상 시나리오와의 비용 차이는 동일 위험 조건의 인과적 절감액이 아닙니다.",
      },
    },
    {
      id: "CEFAZOLIN-GANGWON-CENTRAL-STOCK",
      regionId: "Gangwon",
      scenarioId: undefined,
      title: gangwon.recommendations[0] ?? "중앙재고 우선배분·입고일 모니터링",
      description: "강원권 입고 일정과 재고 흐름을 확인해 중앙재고 배분 우선순위를 조정하는 실행안",
      costKpi: { label: "비용 영향", value: "추가 예정" },
      feasibility: undefined,
      xai: {
        summary: "강원권의 권역별 추천 데이터에 포함된 중앙재고 우선배분 및 입고일 모니터링 실행안입니다.",
        evidence: [
          `현재 재고 ${Math.round(gangwon.currentStock).toLocaleString("ko-KR")} BOX`,
          `목표 재고 ${Math.round(gangwon.targetStock).toLocaleString("ko-KR")} BOX · 충족률 ${gangwon.targetStockCoveragePct}%`,
          `평균 리드타임 ${gangwon.averageLeadTimeHours.toFixed(2)}시간`,
        ],
        limitation: "배분 수량, 비용 효과, 실행 일정의 상세 산정 데이터는 추가 예정입니다.",
      },
    },
  ],
};
