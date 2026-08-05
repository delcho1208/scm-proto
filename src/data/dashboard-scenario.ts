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
      date: lipilouLatest.date,
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

type TamivirRaw = {
  scenario: string;
  summary: {
    f2a_target: number;
    ai_target: number;
    current_stock: number;
    ratio: number;
    dead_stock_quantity: number;
    dead_stock_cost_billion_str: string;
    status: string;
    risk_score: number;
  };
  recommendations: Array<{
    id: number;
    title: string;
    name: string;
    priority: string;
    recommendation: string;
    expected_effect: string[];
    xai_reason: { title: string; description: string };
  }>;
  trace_log: string[];
  xai_cards: Array<{ title: string; value: string; description: string }>;
  zone_details: Array<{
    zone_name: string;
    f2a_target: number;
    ai_target: number;
    current_stock: number;
    ratio: number;
    status: string;
  }>;
};

const tamivirRaw = rawTamivirScenario as TamivirRaw;
const tamivirRegions = normalizeRegions(
  tamivirRaw.zone_details.map((region) => ({
    region: region.zone_name,
    current_stock: region.current_stock,
    target_stock: region.ai_target,
    stock_ratio: region.ratio,
    stockRatioLabel: `${region.ratio.toFixed(1)}배`,
    status: region.status,
  })),
);
const operationRateText = tamivirRaw.xai_cards.find((card) =>
  card.title.includes("생산 관성"),
)?.value;
const operationRate = Number(operationRateText?.match(/[\d.]+/)?.[0] ?? 97);
const externalShock = tamivirRaw.xai_cards.find((card) => card.title.includes("외부 이벤트"));
const inventoryXai = tamivirRaw.xai_cards.find((card) => card.title.includes("재고 상태"));

export const tamivirDashboard: ProductDashboardScenario = {
  date: "2026-03-10",
  sceneName: tamivirRaw.scenario,
  regions: tamivirRegions,
  totalInventory: tamivirRaw.summary.current_stock,
  utilization: operationRate,
  inventoryLevel: tamivirRaw.summary.status === "과잉" ? "warning" : tamivirRaw.summary.status === "부족" ? "danger" : "safe",
  externalSignal: {
    title: "인플루엔자 시장 충격 감지",
    value: `현재 ${tamivirRaw.summary.current_stock.toLocaleString()}EA · AI 목표 ${tamivirRaw.summary.ai_target.toLocaleString()}EA`,
    detail: externalShock?.description ?? tamivirRaw.trace_log[0],
  },
  recommendations: tamivirRaw.recommendations.map((recommendation) => ({
    id: `TAMIVIR-${recommendation.id}`,
    title: recommendation.name,
    description: `${recommendation.recommendation} · 기대효과: ${recommendation.expected_effect.join(", ")} · ${recommendation.xai_reason.description}${recommendation.id === 1 ? ` · Dead Stock ${tamivirRaw.summary.dead_stock_quantity.toLocaleString()}정 · 예상 손실 ${tamivirRaw.summary.dead_stock_cost_billion_str} · ${inventoryXai?.description ?? ""}` : ""}`,
    approvalButtonText: recommendation.id === 1 ? "생산 감축 승인" : "CDC 비축 전환 검토",
  })),
};
