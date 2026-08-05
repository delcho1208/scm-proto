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

const monthlyForecast = rawDashboard.monthlyFlow.map((item) => item.forecastDemand);
const monthlyShipments = rawDashboard.monthlyFlow.map((item) => item.regionalShipment);
const monthlyValues = [...monthlyForecast, ...monthlyShipments];
const emergencyProcurement = rawDashboard.overview.integratedResponse.emergencyProcurementQuantity;

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
    detail: `S3 서비스율 ${rawDashboard.overview.integratedResponse.serviceRatePct}% · 긴급조달 ${Math.round(emergencyProcurement).toLocaleString("ko-KR")} BOX`,
  },
  recommendations: national.recommendations.map((recommendation, index) => ({
    id: `CEFAZOLIN-${index + 1}`,
    title: recommendation,
    description: `전국 재고 충족률 ${national.targetStockCoveragePct}% · 긴급조달 ${Math.round(emergencyProcurement).toLocaleString("ko-KR")} BOX`,
    approvalButtonText: "S3 통합대응 적용",
  })),
};

export function getCefazolinIntegrationRecords(regionId: string): SystemRecord[] {
  return rawDashboard.integration
    .filter((record) => record.regionId === regionId)
    .map((record) => ({
      system: record.system as SystemKey,
      docNo: record.documentNumber,
      status: toIntegrationStatus(record.status),
      qty: Math.round(record.quantity).toLocaleString("ko-KR"),
      updatedAt: "2026-03-10",
      note: `${record.unit} · 세파졸린 실데이터`,
    }));
}

export const cefazolinDashboard = {
  ...dashboardScenario,
  productKey: rawDashboard.product,
  annualForecastDemand: rawDashboard.overview.annualForecastDemand,
  annualForecastDemandByRegion: Object.fromEntries(
    Object.entries(sourceRegions).map(([id, region]) => [id, region.annualForecastDemand]),
  ) as Record<string, number>,
  serviceRatePct: rawDashboard.overview.integratedResponse.serviceRatePct,
  unmetDemandRatePct: rawDashboard.overview.integratedResponse.unmetDemandRatePct,
  policyRiskByRegion: Object.fromEntries(
    Object.entries(sourceRegions).map(([id, region]) => [id, region.policyRisk]),
  ),
  chart: {
    actual: createChartPath(monthlyShipments, monthlyValues),
    prediction: createChartPath(monthlyForecast, monthlyValues),
  },
  monthlyFlow: rawDashboard.monthlyFlow,
  integration: rawDashboard.integration,
  scenarios: rawDashboard.scenarios,
  modelValidation: rawDashboard.modelValidation,
  source: rawDashboard.source,
};
