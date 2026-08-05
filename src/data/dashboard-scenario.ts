import rawLipilouScenario from "../../lipilou_dashboard_scenario.json";
import rawTamivirScenario from "../../tamivir_dashboard_scenario.json";
import type { RiskLevel } from "@/data/scm";

type RawRegion = {
  region: string;
  current_stock: number;
  target_stock: number;
  stock_ratio: number;
  stockRatioLabel?: string;
  status: string;
};

export type DashboardRegion = RawRegion & {
  id: string;
  riskLevel: RiskLevel;
  riskText: string;
};

export type DashboardRecommendation = {
  id: string;
  title: string;
  description: string;
  fromRegion?: string;
  toRegion?: string;
  transferAmount?: number;
  projectedTotalInventory?: number;
  projectedStatus?: string;
  affectedRegions?: string[];
  projectedRegions?: Record<string, DashboardRegion>;
  approvalButtonText: string;
};

export type ProductDashboardScenario = {
  date: string;
  sceneName: string;
  regions: Record<string, DashboardRegion>;
  recommendations: DashboardRecommendation[];
  totalInventory?: number;
  utilization?: number;
  inventoryLevel?: RiskLevel;
  externalSignal?: {
    title: string;
    value: string;
    detail: string;
  };
};

const regionIdByZone: Record<string, string> = {
  Zone1: "Seoul",
  Zone2: "Gyeonggi",
  Zone3: "Gangwon",
  Zone4: "Chungcheong",
  Zone5: "Honam",
  Zone6: "Daegu",
  Zone7: "Busan",
  Zone8: "Jeju",
};

function toRegionId(regionName: string) {
  return regionIdByZone[regionName.split("_")[0]];
}

function toRiskLevel(status: string, stockRatio: number): RiskLevel {
  const normalized = status.toUpperCase();
  // Explicit status from the source takes priority. Some feeds use percent ratios,
  // while Tamivir reports multiples (e.g. 24.1x), so ratio alone is not comparable.
  if (normalized === "DANGER" || status === "위험" || status === "부족")
    return "danger";
  if (status === "과잉") return "warning";
  if (status === "적정") return "safe";
  if (
    normalized === "WARNING" ||
    status === "주의" ||
    stockRatio >= 130
  )
    return "warning";
  if (stockRatio < 100) return "danger";
  return "safe";
}

function normalizeRegions(regions: RawRegion[] = []) {
  return Object.fromEntries(
    regions.map((item) => {
      const id = toRegionId(item.region);
      const riskLevel = toRiskLevel(item.status, item.stock_ratio);
      return [
        id,
        {
          ...item,
          id,
          riskLevel,
          riskText:
            riskLevel === "danger"
              ? "부족"
              : riskLevel === "warning"
                ? "과잉"
                : "적정",
        } satisfies DashboardRegion,
      ];
    }),
  ) as Record<string, DashboardRegion>;
}

type LipilouRaw = {
  scenarios: Array<{
    date: string;
    scene_name: string;
    map_monitoring?: RawRegion[];
    ai_solutions?: Array<{
      id: string;
      title: string;
      summary?: string;
      reason: string;
      xai_explanation?: string;
      transfer_amount?: number;
      from_region?: string;
      to_region?: string;
      approval_action: { initial_button_text: string };
    }>;
  }>;
};

const lipilouRaw = rawLipilouScenario as LipilouRaw;
const lipilouLatest = [...lipilouRaw.scenarios]
  .filter((scenario) => scenario.map_monitoring?.length)
  .sort((a, b) => b.date.localeCompare(a.date))[0];
const lipilouRegions = normalizeRegions(lipilouLatest?.map_monitoring);
const lipilouTotalTarget = Object.values(lipilouRegions).reduce(
  (sum, region) => sum + region.target_stock,
  0,
);
const lipilouTotalInventory = Object.values(lipilouRegions).reduce(
  (sum, region) => sum + region.current_stock,
  0,
);

export const lipilouDashboard: ProductDashboardScenario | null = lipilouLatest
  ? {
      date: "2026-10-01",
      sceneName: lipilouLatest.scene_name,
      regions: lipilouRegions,
      totalInventory: lipilouTotalInventory,
      inventoryLevel:
        lipilouTotalInventory < lipilouTotalTarget
          ? "danger"
          : lipilouTotalInventory >= lipilouTotalTarget * 1.3
            ? "warning"
            : "safe",
      recommendations: (lipilouLatest.ai_solutions ?? []).map((solution) => ({
        id: solution.id,
        title: solution.summary ?? solution.title,
        description: solution.xai_explanation ?? solution.reason,
        fromRegion: solution.from_region ? toRegionId(solution.from_region) : undefined,
        toRegion: solution.to_region ? toRegionId(solution.to_region) : undefined,
        transferAmount: solution.transfer_amount,
        approvalButtonText: solution.approval_action.initial_button_text,
      })),
    }
  : null;

type TamivirScenario = {
  date: string;
  scene_name: string;
  summary: {
    f2a_target: number;
    ai_target: number;
    current_stock: number;
    ratio: number;
    dead_stock_quantity: number;
    status: string;
    risk_score: number;
  };
  map_monitoring?: Array<{
    region: string;
    f2a_target: number;
    target_stock: number;
    current_stock: number;
    stock_ratio: number;
    status: string;
  }>;
  regions_stock?: Array<{
    region: string;
    f2a_target: number;
    target_stock: number;
    current_stock: number;
    stock_ratio: number;
    status: string;
  }>;
  ai_solutions: Array<{
    id: string;
    title: string;
    summary?: string;
    reason: string;
    xai_explanation: string;
    expected_effect: string[];
    approval_action: { initial_button_text: string };
    after_apply: {
      current_stock: number;
      stock_ratio: number;
      status: string;
      dead_stock_quantity: number;
      map_monitoring: RawRegion[];
    };
  }>;
  xai_cards: Array<{ title: string; value: string; description: string }>;
};

type TamivirRaw = { project: string; scenarios: TamivirScenario[] };

const tamivirRaw = rawTamivirScenario as TamivirRaw;
const tamivirLatest = [...tamivirRaw.scenarios].sort((a, b) => b.date.localeCompare(a.date))[0];
const tamivirLatestRegions = tamivirLatest.map_monitoring ?? tamivirLatest.regions_stock ?? [];
const tamivirZoneRegions = normalizeRegions(
  tamivirLatestRegions.map((region) => ({
    region: region.region,
    current_stock: region.current_stock,
    target_stock: region.target_stock,
    stock_ratio: region.stock_ratio,
    stockRatioLabel: `${region.stock_ratio.toFixed(1)}배`,
    status: region.status,
  })),
);
const tamivirNationalRisk = tamivirLatest.summary.status === "과잉"
  ? "warning"
  : tamivirLatest.summary.status === "부족" ? "danger" : "safe";
const tamivirRegions: Record<string, DashboardRegion> = {
  National: {
    id: "National",
    region: "National_전국 통합",
    current_stock: tamivirLatest.summary.current_stock,
    target_stock: tamivirLatest.summary.ai_target,
    stock_ratio: tamivirLatest.summary.ratio,
    stockRatioLabel: `${tamivirLatest.summary.ratio.toFixed(1)}배`,
    status: tamivirLatest.summary.status,
    riskLevel: tamivirNationalRisk,
    riskText: tamivirLatest.summary.status,
  },
  ...tamivirZoneRegions,
};
const operationRateText = tamivirLatest.xai_cards.find((card) =>
  card.title.includes("생산 관성"),
)?.value;
const operationRate = Number(operationRateText?.match(/[\d.]+/)?.[0] ?? 97);
const demandXai = tamivirLatest.xai_cards.find((card) => card.title.includes("수요 예측"));

type TamivirForecast = {
  forecast: number;
  currentStock: number;
  yoy: number;
  operationRate: number;
  status: string;
  paths: { actual: string; prediction: string };
};

function createTamivirPaths(actualTrend: number[], forecastTrend: number[]) {
  const actualValues = actualTrend.slice(-3);
  const predictionValues = [actualValues.at(-1) ?? 0, ...forecastTrend.slice(-3)];
  const allValues = [...actualValues, ...predictionValues];
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  const range = max - min || 1;
  const point = (value: number, x: number) => `${x},${170 - ((value - min) / range) * 130}`;
  return {
    actual: actualValues.map((value, index) => `${index ? "L" : "M"}${point(value, index * 80)}`).join(" "),
    prediction: predictionValues.map((value, index) => `${index ? "L" : "M"}${point(value, 160 + index * 80)}`).join(" "),
  };
}

const tamivirForecastEntries = tamivirLatestRegions.map((region) => {
  const id = toRegionId(region.region);
  const forecastCard = (region as typeof region & {
    forecast_card?: { forecast: number; current_stock: number; yoy: number; actual_trend: number[]; forecast_trend: number[]; status: string; operation_rate: number };
  }).forecast_card;
  if (!forecastCard) return null;
  return [id, {
    forecast: forecastCard.forecast,
    currentStock: forecastCard.current_stock,
    yoy: forecastCard.yoy,
    operationRate: forecastCard.operation_rate,
    status: forecastCard.status,
    paths: createTamivirPaths(forecastCard.actual_trend, forecastCard.forecast_trend),
  } satisfies TamivirForecast] as const;
}).filter((entry): entry is NonNullable<typeof entry> => entry !== null);

const normalTamivirScenario = [...tamivirRaw.scenarios].sort((a, b) => a.date.localeCompare(b.date))[0];
const nationalActualTrend = [0, 1, 2].map((index) => tamivirLatestRegions.reduce((sum, region) => {
  const card = (region as typeof region & { forecast_card?: { actual_trend: number[] } }).forecast_card;
  return sum + (card?.actual_trend[index] ?? 0);
}, 0));
const nationalForecastTrend = [0, 1, 2].map((index) => tamivirLatestRegions.reduce((sum, region) => {
  const card = (region as typeof region & { forecast_card?: { forecast_trend: number[] } }).forecast_card;
  return sum + (card?.forecast_trend[index] ?? 0);
}, 0));

export const tamivirForecastByRegion: Record<string, TamivirForecast> = {
  National: {
    forecast: tamivirLatest.summary.ai_target,
    currentStock: tamivirLatest.summary.current_stock,
    yoy: ((tamivirLatest.summary.ai_target / normalTamivirScenario.summary.ai_target) - 1) * 100,
    operationRate,
    status: tamivirLatest.summary.status,
    paths: createTamivirPaths(nationalActualTrend, nationalForecastTrend),
  },
  ...Object.fromEntries(tamivirForecastEntries),
};

export const tamivirAnnualF2aTarget = tamivirLatest.summary.f2a_target;

export const tamivirDashboard: ProductDashboardScenario = {
  date: "2026-10-01",
  sceneName: tamivirLatest.scene_name,
  regions: tamivirRegions,
  totalInventory: tamivirLatest.summary.current_stock,
  utilization: operationRate,
  inventoryLevel: tamivirNationalRisk,
  externalSignal: {
    title: "인플루엔자 수요 급감 예측",
    value: `현재 ${tamivirLatest.summary.current_stock.toLocaleString()}EA · AI 목표 ${tamivirLatest.summary.ai_target.toLocaleString()}EA`,
    detail: demandXai?.description ?? `전국 재고가 AI 목표의 ${tamivirLatest.summary.ratio.toFixed(1)}배로 예측되었습니다.`,
  },
  recommendations: tamivirLatest.ai_solutions.map((recommendation) => ({
    id: `TAMIVIR-${recommendation.id}`,
    title: recommendation.summary ?? recommendation.title.replace(/^[①②③④⑤]\s*/, ""),
    description: `${recommendation.reason} · 기대효과: ${recommendation.expected_effect.join(", ")} · XAI 근거: ${recommendation.xai_explanation}`,
    projectedTotalInventory: recommendation.after_apply.current_stock,
    projectedStatus: recommendation.after_apply.status,
    affectedRegions: recommendation.after_apply.map_monitoring.map((region) => toRegionId(region.region)),
    projectedRegions: normalizeRegions(recommendation.after_apply.map_monitoring),
    approvalButtonText: recommendation.approval_action.initial_button_text,
  })),
};
